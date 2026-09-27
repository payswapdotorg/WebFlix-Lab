/**
 * Gemini multi-speaker adapter tests: PURE mapping functions + typed error
 * posture. No network, no credentials (binding: the offline deterministic
 * adapter is the only provider the suite may depend on).
 */

import { describe, expect, test } from 'bun:test';
import {
  GeminiMultiSpeakerTts,
  GEMINI_ADAPTER_ENV,
  GEMINI_DEFAULT_MODEL,
} from '../../src/providers/audio/gemini-multi-speaker-adapter';
import type { GeminiMultiSpeakerResponse } from '../../src/providers/audio/gemini-multi-speaker';
import type { SpeakerVoiceProfile, SpeechTurnRequest } from '../../src/providers/audio/port';
import { selectSpeechProvider, SPEECH_PROVIDER_ENV_FLAG } from '../../src/providers/audio/factory';

const VOICES = new Map<string, SpeakerVoiceProfile>([
  ['host-a', { speakerId: 'host-a', voice: 'female-warm-analytical/en', rate: 1, pitch: 1 }],
  ['host-b', { speakerId: 'host-b', voice: 'male-grounded-analytical/en', rate: 0.98, pitch: 0.94 }],
]);

const DIALOGUE: readonly SpeechTurnRequest[] = [
  { turnId: 't1', speakerId: 'host-a', text: 'First line.', targetSeconds: 2 },
  { turnId: 't2', speakerId: 'host-b', text: 'Second line.', targetSeconds: 3 },
];

function adapterWith(env: NodeJS.ProcessEnv = {}): GeminiMultiSpeakerTts {
  return new GeminiMultiSpeakerTts({}, env);
}

describe('GeminiMultiSpeakerTts — pure mappings', () => {
  test('buildMultiSpeakerRequest maps voices + dialogue + style', () => {
    const adapter = adapterWith();
    const request = adapter.buildMultiSpeakerRequest(DIALOGUE, VOICES, 'warm two-host banter');
    expect(request.model).toBe(GEMINI_DEFAULT_MODEL);
    expect(request.sampleRate).toBe(24000);
    expect(request.styleInstruction).toBe('warm two-host banter');
    expect(request.speakers.map((s) => s.speakerId)).toEqual(['host-a', 'host-b']);
    // The language-conditioned descriptor maps to the prebuilt name prefix.
    expect(request.speakers[0]?.voiceName).toBe('female-warm-analytical');
    expect(request.dialogue.map((l) => l.speakerId)).toEqual(['host-a', 'host-b']);
    expect(request.dialogue[0]?.text).toBe('First line.');
  });

  test('pronunciation hints ride along as adapter-internal guidance', () => {
    const adapter = adapterWith();
    const withHints: readonly SpeechTurnRequest[] = [
      {
        turnId: 't1',
        speakerId: 'host-a',
        text: 'LLM runtimes',
        pronunciationHints: [{ token: 'LLM', say: 'L L M', reason: 'acronym' }],
      },
    ];
    const request = adapter.buildMultiSpeakerRequest(withHints, VOICES);
    expect(request.dialogue[0]?.pronunciation).toEqual(['LLM -> L L M']);
  });

  test('parseMultiSpeakerResponse carves ordered per-turn results', () => {
    const adapter = adapterWith();
    const pcm = new Uint8Array(24000 * 2 * 5); // 5 s of 16-bit 24 kHz
    const response: GeminiMultiSpeakerResponse = {
      audio: { data: pcm, container: 'pcm-raw', sampleRate: 24000, channels: 1, bitsPerSample: 16 },
      turnSegments: [
        { turnId: 't1', startMs: 0, endMs: 2000 },
        { turnId: 't2', startMs: 2050, endMs: 5000 },
      ],
      model: 'some-model',
    };
    const results = adapter.parseMultiSpeakerResponse(response, DIALOGUE);
    expect(results.map((r) => r.turnId)).toEqual(['t1', 't2']);
    expect(results[0]?.durationSeconds).toBe(2);
    expect(results[1]?.durationSeconds).toBeCloseTo(2.95, 6);
    expect((results[0]?.effectiveVoiceParams as { engine?: string }).engine).toBe(
      'gemini-multi-speaker-tts',
    );
  });

  test('parseMultiSpeakerResponse rejects segment/dialogue mismatch (alignment-mismatch)', () => {
    const adapter = adapterWith();
    const response: GeminiMultiSpeakerResponse = {
      audio: { data: new Uint8Array(100), container: 'pcm-raw', sampleRate: 24000, channels: 1, bitsPerSample: 16 },
      turnSegments: [{ turnId: 't1', startMs: 0, endMs: 1000 }],
    };
    expect(() => adapter.parseMultiSpeakerResponse(response, DIALOGUE)).toThrow(/alignment-mismatch/);
  });
});

describe('GeminiMultiSpeakerTts — credential posture (never fakes audio)', () => {
  test('missing credentials -> typed missing-credentials error', async () => {
    const adapter = adapterWith({}); // no GEMINI_API_KEY
    expect(adapter.requiredCredentialKeys()).toEqual([GEMINI_ADAPTER_ENV.apiKey]);
    await expect(adapter.synthesizeTurn(DIALOGUE[0] as SpeechTurnRequest, VOICES)).rejects.toThrow(
      /missing-credentials.*GEMINI_API_KEY/,
    );
    await expect(adapter.synthesizeDialogue(DIALOGUE, VOICES)).rejects.toThrow(/missing-credentials/);
    const health = await adapter.healthCheck();
    expect(health.ok).toBe(false);
  });

  test('credential VALUES never appear in error messages or required keys', async () => {
    const adapter = adapterWith({ [GEMINI_ADAPTER_ENV.apiKey]: 'super-secret-value' });
    const health = await adapter.healthCheck();
    expect(health.ok).toBe(true);
    expect(JSON.stringify(adapter.requiredCredentialKeys())).not.toContain('super-secret-value');
    expect(health.detail).not.toContain('super-secret-value');
  });

  test('env endpoint/model overrides are honored (no secrets, just routing)', () => {
    const adapter = adapterWith({
      [GEMINI_ADAPTER_ENV.endpoint]: 'http://localhost:9999',
      [GEMINI_ADAPTER_ENV.model]: 'some-tts-model',
    });
    const request = adapter.buildMultiSpeakerRequest(DIALOGUE, VOICES);
    expect(request.model).toBe('some-tts-model');
  });
});

describe('provider factory (env-flag selection)', () => {
  test('default is the offline deterministic provider', () => {
    const selected = selectSpeechProvider({ seed: 's', env: {} });
    expect(selected.choice).toBe('offline');
    expect(selected.provider.id).toBe('deterministic-offline-tts');
  });

  test('WFLX_AUDIO_SPEECH_PROVIDER=gemini selects the real adapter (credentials still required)', () => {
    const selected = selectSpeechProvider({
      seed: 's',
      env: { [SPEECH_PROVIDER_ENV_FLAG]: 'gemini' },
    });
    expect(selected.choice).toBe('gemini');
    expect(selected.provider.id).toBe('gemini-multi-speaker-tts');
  });
});
