/**
 * ZaiLiveTts provider tests (WFLX-P1, EV-016): pure mapping helpers, text
 * chunking, env-gated factory selection, and the transport path against an
 * INJECTED fake client (no network in tests — the live service path is
 * exercised for real by experiments/run-exp-l-01.ts, whose artifacts carry
 * the real-run evidence).
 */

import { describe, expect, test } from 'bun:test';
import { encodeWavPcm16 } from '../../src/audio/mixing/wav';
import {
  DeterministicOfflineTtsAdapter,
} from '../../src/providers/audio/deterministic-offline';
import { GeminiMultiSpeakerTts } from '../../src/providers/audio/gemini-multi-speaker-adapter';
import {
  selectSpeechProvider,
  SPEECH_PROVIDER_ENV_FLAG,
  TTS_PROVIDER_ENV_FLAG,
} from '../../src/providers/audio/factory';
import {
  ZaiLiveTts,
  ZAI_TTS_MAX_INPUT_CHARS,
  ZAI_TTS_SAMPLE_RATE,
  clampSpeed,
  splitTextForService,
  zaiVoiceForDescriptor,
  ZAI_VOICE_BY_DESCRIPTOR,
} from '../../src/providers/audio/zai-live';
import type { SpeakerVoiceProfile } from '../../src/providers/audio/port';

const VOICES = new Map<string, SpeakerVoiceProfile>([
  ['host-a', { speakerId: 'host-a', voice: 'female-warm-analytical/en', rate: 1, pitch: 1, volume: 1 }],
  ['host-b', { speakerId: 'host-b', voice: 'male-grounded-analytical/en', rate: 0.98, pitch: 0.94, volume: 1 }],
]);

/** Build a small valid WAV payload (sine) for the fake service. */
function fakeWav(seconds: number, freqHz = 200): Uint8Array {
  const n = Math.round(seconds * ZAI_TTS_SAMPLE_RATE);
  const samples = new Float64Array(n);
  for (let i = 0; i < n; i += 1) {
    samples[i] = 0.4 * Math.sin((2 * Math.PI * freqHz * i) / ZAI_TTS_SAMPLE_RATE);
  }
  return encodeWavPcm16(samples, ZAI_TTS_SAMPLE_RATE);
}

/** Fake SDK client factory: WAV responses, scriptable failures. */
function fakeClient(script: { seconds?: number; status?: number; failTimes?: number }[] = []) {
  let call = 0;
  const calls: string[] = [];
  const client = {
    audio: {
      tts: {
        create: async (body: { input: string; voice?: string; speed?: number }) => {
          calls.push(body.input);
          const step = script[Math.min(call, script.length - 1)] ?? { seconds: 0.5 };
          call += 1;
          if (step.failTimes && call <= step.failTimes) {
            throw new Error('network down');
          }
          const status = step.status ?? 200;
          return new Response(status === 200 ? fakeWav(step.seconds ?? 0.5) : new Uint8Array([1]), {
            status,
          });
        },
      },
    },
  };
  return { client, calls: () => calls };
}

describe('zai-live-tts pure helpers', () => {
  test('voice descriptor mapping is deterministic and covers the persona descriptors', () => {
    expect(zaiVoiceForDescriptor('female-warm-analytical/en')).toBe(
      ZAI_VOICE_BY_DESCRIPTOR['female-warm-analytical'] as string,
    );
    expect(zaiVoiceForDescriptor('male-grounded-analytical/es')).toBe(
      ZAI_VOICE_BY_DESCRIPTOR['male-grounded-analytical'] as string,
    );
    expect(zaiVoiceForDescriptor('neutral-narrator/en')).toBe(
      ZAI_VOICE_BY_DESCRIPTOR['neutral-narrator'] as string,
    );
    expect(zaiVoiceForDescriptor('unknown-voice')).toBe(zaiVoiceForDescriptor('unknown-voice'));
  });

  test('clampSpeed enforces the service bounds', () => {
    expect(clampSpeed(undefined)).toBe(1);
    expect(clampSpeed(0.98)).toBe(0.98);
    expect(clampSpeed(0.1)).toBe(0.5);
    expect(clampSpeed(3)).toBe(2);
    expect(clampSpeed(Number.NaN)).toBe(1);
  });

  test('splitTextForService: short text is one chunk; empty text none', () => {
    expect(splitTextForService('Hello world.')).toEqual(['Hello world.']);
    expect(splitTextForService('   ')).toEqual([]);
    expect(splitTextForService('One. Two. Three.', 1024).length).toBe(1);
  });

  test('splitTextForService packs sentences and hard-splits oversized ones', () => {
    const sentence = 'This is one sentence of fixed length for packing tests. ';
    const long = sentence.repeat(40); // ~2,800 chars
    const chunks = splitTextForService(long, 200);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(200);
    }
    // Oversized single sentence without spaces gets hard-split.
    const giant = 'x'.repeat(250);
    const hard = splitTextForService(giant, 100);
    expect(hard.every((chunk) => chunk.length <= 100)).toBe(true);
    expect(hard.join('')).toBe(giant);
  });
});

describe('speech provider factory: WFLX_TTS_PROVIDER gating (EV-016)', () => {
  test('WFLX_TTS_PROVIDER=live-zai selects the ZaiLiveTts adapter', () => {
    const selected = selectSpeechProvider({
      env: { [TTS_PROVIDER_ENV_FLAG]: 'live-zai' },
      seed: 's',
    });
    expect(selected.choice).toBe('live-zai');
    expect(selected.provider).toBeInstanceOf(ZaiLiveTts);
    expect(selected.provider.kind).toBe('remote-single-speaker');
  });

  test('flag unset keeps the offline deterministic default (zero behavior change)', () => {
    const selected = selectSpeechProvider({ env: {}, seed: 's' });
    expect(selected.choice).toBe('offline');
    expect(selected.provider).toBeInstanceOf(DeterministicOfflineTtsAdapter);
  });

  test('other flag values fall through to the pre-existing logic', () => {
    const gemini = selectSpeechProvider({
      env: { [TTS_PROVIDER_ENV_FLAG]: 'something-else', [SPEECH_PROVIDER_ENV_FLAG]: 'gemini' },
    });
    expect(gemini.provider).toBeInstanceOf(GeminiMultiSpeakerTts);

    const offline = selectSpeechProvider({
      env: { [TTS_PROVIDER_ENV_FLAG]: 'gemini' },
    });
    expect(offline.choice).toBe('offline');
  });
});

describe('ZaiLiveTts adapter (injected fake client; no network)', () => {
  test('synthesizeTurn returns a valid WAV payload with measured duration', async () => {
    const fake = fakeClient([{ seconds: 1.25 }]);
    const provider = new ZaiLiveTts({ clientFactory: async () => fake.client });
    const result = await provider.synthesizeTurn(
      { turnId: 't1', speakerId: 'host-a', text: 'A real sentence.' },
      VOICES,
    );
    expect(result.turnId).toBe('t1');
    expect(result.audio.container).toBe('wav');
    expect(result.audio.sampleRate).toBe(ZAI_TTS_SAMPLE_RATE);
    expect(result.audio.channels).toBe(1);
    expect(result.audio.bitsPerSample).toBe(16);
    expect(result.durationSeconds).toBeCloseTo(1.25, 2);
  });

  test('long text is chunked and PCM-concatenated into ONE payload', async () => {
    const fake = fakeClient([{ seconds: 0.5 }]);
    const provider = new ZaiLiveTts({ clientFactory: async () => fake.client });
    // > 2x the 1024-char service limit so the packer must emit > 1 chunk.
    const text = `${'Alpha sentence here. '.repeat(60)}${'Beta sentence there. '.repeat(60)}`;
    expect(text.length).toBeGreaterThan(2 * ZAI_TTS_MAX_INPUT_CHARS);
    const result = await provider.synthesizeTurn(
      { turnId: 't2', speakerId: 'host-b', text },
      VOICES,
    );
    const chunkCount = fake.calls().length;
    expect(chunkCount).toBeGreaterThanOrEqual(2);
    expect(result.durationSeconds).toBeCloseTo(chunkCount * 0.5, 2);
    // One payload, one contiguous WAV (not a concatenation of headers).
    expect(result.audio.data.byteLength).toBe(
      44 + Math.round(chunkCount * 0.5 * ZAI_TTS_SAMPLE_RATE) * 2,
    );
  });

  test('effective voice params are STABLE per speaker (no per-turn fields)', async () => {
    const fake = fakeClient([{ seconds: 0.4 }, { seconds: 0.7 }]);
    const provider = new ZaiLiveTts({ clientFactory: async () => fake.client });
    const a = await provider.synthesizeTurn(
      { turnId: 't-a', speakerId: 'host-a', text: 'First turn.' },
      VOICES,
    );
    const b = await provider.synthesizeTurn(
      { turnId: 't-b', speakerId: 'host-a', text: 'A considerably longer second turn with more words than the first.' },
      VOICES,
    );
    expect(JSON.stringify(a.effectiveVoiceParams)).toBe(JSON.stringify(b.effectiveVoiceParams));
    expect(a.effectiveVoiceParams.engine).toBe('zai-live-tts');
    expect(a.effectiveVoiceParams.voice).toBe(ZAI_VOICE_BY_DESCRIPTOR['female-warm-analytical']);
  });

  test('per-speaker distinct voices and speed clamping', async () => {
    const fake = fakeClient([{ seconds: 0.3 }, { seconds: 0.3 }]);
    const provider = new ZaiLiveTts({ clientFactory: async () => fake.client });
    const a = await provider.synthesizeTurn(
      { turnId: 't-a', speakerId: 'host-a', text: 'A.' },
      VOICES,
    );
    const b = await provider.synthesizeTurn(
      { turnId: 't-b', speakerId: 'host-b', text: 'B.' },
      VOICES,
    );
    expect(a.effectiveVoiceParams.voice).not.toBe(b.effectiveVoiceParams.voice);
    // host-b rate 0.98 stays in-bounds untouched.
    expect(b.effectiveVoiceParams.speed).toBe(0.98);
  });

  test('transport failures retry then surface a typed error (never fake audio)', async () => {
    const fake = fakeClient([{ failTimes: 99 }]);
    const provider = new ZaiLiveTts({ clientFactory: async () => fake.client, maxRetries: 1 });
    expect(
      provider.synthesizeTurn({ turnId: 't', speakerId: 'host-a', text: 'x' }, VOICES),
    ).rejects.toThrow(/zai-live-tts: transport/);
  });

  test('non-2xx responses reject with provider-rejected', async () => {
    const fake = fakeClient([{ status: 429 }]);
    const provider = new ZaiLiveTts({ clientFactory: async () => fake.client, maxRetries: 0 });
    await expect(
      provider.synthesizeTurn({ turnId: 't', speakerId: 'host-a', text: 'x' }, VOICES),
    ).rejects.toThrow(/provider-rejected: HTTP 429/);
  });

  test('missing voice profile rejects with a typed error', async () => {
    const provider = new ZaiLiveTts({ clientFactory: async () => fakeClient().client });
    await expect(
      provider.synthesizeTurn({ turnId: 't', speakerId: 'ghost', text: 'x' }, VOICES),
    ).rejects.toThrow(/missing-voice-profile/);
  });

  test('capabilities and credential posture', () => {
    const provider = new ZaiLiveTts({ clientFactory: async () => fakeClient().client });
    const caps = provider.capabilities();
    expect(caps.nativeMultiSpeaker).toBe(false);
    expect(caps.perSpeakerVoiceParams).toBe(true);
    expect(caps.containers).toContain('wav');
    expect(provider.requiredCredentialKeys()).toEqual([]);
    expect(provider.modelId).toBe('zai-tts-1');
  });

  test('synthesizeDialogue synthesizes per turn in order', async () => {
    const fake = fakeClient([{ seconds: 0.3 }]);
    const provider = new ZaiLiveTts({ clientFactory: async () => fake.client });
    const results = await provider.synthesizeDialogue(
      [
        { turnId: 't1', speakerId: 'host-a', text: 'One.' },
        { turnId: 't2', speakerId: 'host-b', text: 'Two.' },
      ],
      VOICES,
    );
    expect(results.map((r) => r.turnId)).toEqual(['t1', 't2']);
  });
});

describe('ZAI service constraints (documented contract)', () => {
  test('chunking respects the 1024-character service limit', () => {
    const text = 'Word '.repeat(600); // ~3,000 chars
    for (const chunk of splitTextForService(text)) {
      expect(chunk.length).toBeLessThanOrEqual(ZAI_TTS_MAX_INPUT_CHARS);
    }
  });
});
