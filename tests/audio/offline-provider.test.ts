/**
 * DeterministicOfflineTtsAdapter tests: exact durations, seeded determinism,
 * per-speaker stability, WAV shape. The canonical credential-free path.
 */

import { describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { DeterministicOfflineTtsAdapter, OFFLINE_SAMPLE_RATE } from '../../src/providers/audio/deterministic-offline';
import { decodeWav } from '../../src/audio/mixing/wav';
import type { SpeakerVoiceProfile } from '../../src/providers/audio/port';

const VOICES = new Map<string, SpeakerVoiceProfile>([
  ['host-a', { speakerId: 'host-a', voice: 'female-warm-analytical/en', rate: 1, pitch: 1, volume: 1 }],
  ['host-b', { speakerId: 'host-b', voice: 'male-grounded-analytical/en', rate: 0.98, pitch: 0.94, volume: 1 }],
]);

function adapter(seed: string | number = 'seed-1') {
  return new DeterministicOfflineTtsAdapter({ seed });
}

function request(overrides: Partial<{ turnId: string; speakerId: string; text: string; targetSeconds: number }> = {}) {
  return {
    turnId: 'turn-1',
    speakerId: 'host-a',
    text: 'The catalog also includes open-source media projects.',
    targetSeconds: 2.5,
    ...overrides,
  };
}

describe('DeterministicOfflineTtsAdapter', () => {
  test('produces exactly the requested duration at 44.1 kHz mono 16-bit', async () => {
    const result = await adapter().synthesizeTurn(request(), VOICES);
    expect(result.durationSeconds).toBe(2.5);
    expect(result.audio.sampleRate).toBe(OFFLINE_SAMPLE_RATE);
    expect(result.audio.channels).toBe(1);
    expect(result.audio.bitsPerSample).toBe(16);
    expect(result.audio.container).toBe('wav');
    expect(result.audio.data.byteLength).toBe(44 + Math.round(2.5 * OFFLINE_SAMPLE_RATE) * 2);
    const decoded = decodeWav(result.audio.data);
    expect(decoded.samples.length).toBe(Math.round(2.5 * OFFLINE_SAMPLE_RATE));
  });

  test('same seed -> byte-identical WAV; different seed -> different bytes', async () => {
    const a = await adapter('seed-1').synthesizeTurn(request(), VOICES);
    const b = await adapter('seed-1').synthesizeTurn(request(), VOICES);
    const c = await adapter('seed-2').synthesizeTurn(request(), VOICES);
    expect(Buffer.compare(Buffer.from(a.audio.data), Buffer.from(b.audio.data))).toBe(0);
    expect(Buffer.compare(Buffer.from(a.audio.data), Buffer.from(c.audio.data))).not.toBe(0);
  });

  test('different turns/speakers/text produce different audio (audible placeholders)', async () => {
    const provider = adapter();
    const base = await provider.synthesizeTurn(request(), VOICES);
    const otherTurn = await provider.synthesizeTurn(request({ turnId: 'turn-2' }), VOICES);
    const otherSpeaker = await provider.synthesizeTurn(request({ speakerId: 'host-b' }), VOICES);
    const otherText = await provider.synthesizeTurn(request({ text: 'Something else entirely.' }), VOICES);
    const sha = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
    const baseSha = sha(base.audio.data);
    expect(sha(otherTurn.audio.data)).not.toBe(baseSha);
    expect(sha(otherSpeaker.audio.data)).not.toBe(baseSha);
    expect(sha(otherText.audio.data)).not.toBe(baseSha);
  });

  test('effective voice params are stable per speaker across turns (H-A-08)', async () => {
    const provider = adapter();
    const a1 = await provider.synthesizeTurn(request({ turnId: 't1' }), VOICES);
    const a2 = await provider.synthesizeTurn(request({ turnId: 't2' }), VOICES);
    const b1 = await provider.synthesizeTurn(request({ turnId: 't3', speakerId: 'host-b' }), VOICES);
    expect(a1.effectiveVoiceParams).toEqual(a2.effectiveVoiceParams);
    expect(a1.effectiveVoiceParams).not.toEqual(b1.effectiveVoiceParams);
    expect((a1.effectiveVoiceParams as { voice?: string }).voice).toBe('female-warm-analytical/en');
    expect((b1.effectiveVoiceParams as { voice?: string }).voice).toBe('male-grounded-analytical/en');
  });

  test('missing voice profile rejects with a clear error', async () => {
    await expect(adapter().synthesizeTurn(request({ speakerId: 'ghost' }), VOICES)).rejects.toThrow(
      /no voice profile for speaker 'ghost'/,
    );
  });

  test('synthesizeDialogue synthesizes per turn in order', async () => {
    const provider = adapter();
    const results = await provider.synthesizeDialogue(
      [request({ turnId: 't1' }), request({ turnId: 't2', speakerId: 'host-b' })],
      VOICES,
    );
    expect(results.map((r) => r.turnId)).toEqual(['t1', 't2']);
    expect(results[0]?.durationSeconds).toBe(2.5);
  });

  test('capabilities and credential posture', () => {
    const provider = adapter();
    expect(provider.id).toBe('deterministic-offline-tts');
    expect(provider.kind).toBe('offline-deterministic');
    expect(provider.capabilities().nativeMultiSpeaker).toBe(false);
    expect(provider.capabilities().containers).toEqual(['wav']);
    expect(provider.requiredCredentialKeys()).toEqual([]);
  });

  test('audio is bounded (no clipping) and non-silent', async () => {
    const result = await adapter().synthesizeTurn(request({ targetSeconds: 0.5 }), VOICES);
    const decoded = decodeWav(result.audio.data);
    let peak = 0;
    for (const sample of decoded.samples) peak = Math.max(peak, Math.abs(sample));
    expect(peak).toBeGreaterThan(0.01); // audible placeholder, not silence
    expect(peak).toBeLessThanOrEqual(1.0);
  });
});
