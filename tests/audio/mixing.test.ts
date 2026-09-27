/**
 * Mixing and mastering tests: WAV codec, LUFS measurement sanity, gap
 * assembly, both mastering backends (pure-TS and ffmpeg when on PATH),
 * per-backend determinism and cross-backend loudness agreement.
 */

import { describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import {
  decodeWav,
  encodeWavPcm16,
  pcm16ToFloats,
  resampleLinear,
} from '../../src/audio/mixing/wav';
import {
  measureIntegratedLufs,
  masterSamples,
  samplePeakDb,
  TARGET_LUFS,
} from '../../src/audio/mixing/master';
import { mixTurns, masterTrack } from '../../src/audio/mixing/mix';
import { ffmpegAvailable } from '../../src/audio/mixing/ffmpeg';
import type { TimingManifest } from '../../src/audio/timing/manifest';
import type { AudioPayload } from '../../src/providers/audio/port';

const sha = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

function sine(seconds: number, amplitude: number, sampleRate = 44100, freq = 997): Float64Array {
  const n = Math.round(seconds * sampleRate);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i += 1) {
    out[i] = amplitude * Math.sin((2 * Math.PI * freq * i) / sampleRate);
  }
  return out;
}

function payloadFor(samples: Float64Array, sampleRate = 44100): AudioPayload {
  return {
    data: encodeWavPcm16(samples, sampleRate),
    container: 'wav',
    sampleRate,
    channels: 1,
    bitsPerSample: 16,
  };
}

describe('WAV codec', () => {
  test('encode/decode round-trip preserves samples and format', () => {
    const samples = sine(0.25, 0.5);
    const wav = encodeWavPcm16(samples, 44100);
    const decoded = decodeWav(wav);
    expect(decoded.sampleRate).toBe(44100);
    expect(decoded.channels).toBe(1);
    expect(decoded.bitsPerSample).toBe(16);
    expect(decoded.samples.length).toBe(samples.length);
    let maxError = 0;
    for (let i = 0; i < samples.length; i += 1) {
      maxError = Math.max(maxError, Math.abs((decoded.samples[i] ?? 0) - (samples[i] ?? 0)));
    }
    expect(maxError).toBeLessThan(1 / 32767);
  });

  test('pcm16 interpretation and linear resampling', () => {
    const samples = sine(0.1, 0.3);
    const wav = encodeWavPcm16(samples, 44100);
    const floats = pcm16ToFloats(wav.subarray(44));
    expect(floats.length).toBe(samples.length);
    const resampled = resampleLinear(samples, 44100, 22050);
    expect(resampled.length).toBe(Math.round(samples.length / 2));
    const back = resampleLinear(resampled, 22050, 44100);
    expect(back.length).toBe(samples.length);
  });
});

describe('loudness measurement (BS.1770-4 style)', () => {
  test('doubling amplitude raises LUFS by ~6 dB', () => {
    const quiet = measureIntegratedLufs(sine(3, 0.1), 44100);
    const loud = measureIntegratedLufs(sine(3, 0.2), 44100);
    expect(Number.isFinite(quiet)).toBe(true);
    expect(Number.isFinite(loud)).toBe(true);
    expect(loud - quiet).toBeCloseTo(6.02, 1);
  });

  test('digital silence is unmeasurable', () => {
    expect(measureIntegratedLufs(new Float64Array(48000 * 2), 44100)).toBe(-Infinity);
  });

  test('sample peak in dBFS', () => {
    expect(samplePeakDb(sine(0.1, 0.5))).toBeCloseTo(-6.02, 2);
    expect(samplePeakDb(new Float64Array(10))).toBe(-Infinity);
  });
});

describe('pure-TS mastering', () => {
  test('brings a quiet track to the -16 LUFS target (within 1 LU)', () => {
    const quiet = sine(5, 0.05);
    const master = masterSamples(quiet, 44100, TARGET_LUFS);
    expect(master.finalLufs).toBeCloseTo(TARGET_LUFS, 0); // within 1 LU
    expect(master.limitingApplied).toBe(false);
    expect(master.finalPeakDb).toBeLessThanOrEqual(-1.49);
  });

  test('limits gain at the peak ceiling instead of clipping (honest report)', () => {
    // Sparse-peak signal: integrated loudness far below target, but peaks
    // already near full scale — the honest move is gain limiting, not clip.
    const sparse = sine(3, 0.02);
    for (const pos of [1000, 50000, 100000, 132300]) {
      for (let i = 0; i < 20; i += 1) {
        sparse[pos + i] = 0.95 * Math.sin(i);
      }
    }
    const master = masterSamples(sparse, 44100, TARGET_LUFS);
    expect(master.limitingApplied).toBe(true);
    expect(master.issues.some((issue) => issue.code === 'loudness-limited')).toBe(true);
    let peak = 0;
    for (const sample of master.samples) peak = Math.max(peak, Math.abs(sample));
    expect(peak).toBeLessThanOrEqual(10 ** (-1.5 / 20) + 1e-9);
  });

  test('deterministic: identical input -> identical output bytes', () => {
    const input = sine(1, 0.2);
    const a = masterSamples(input, 44100);
    const b = masterSamples(input, 44100);
    expect(sha(encodeWavPcm16(a.samples, 44100))).toBe(sha(encodeWavPcm16(b.samples, 44100)));
  });
});

function manifestWith(gapMs: number): TimingManifest {
  return {
    planId: 'p',
    planHash: 'h',
    sampleRateHz: 44100,
    entries: [
      { turnId: 't1', index: 0, speakerRole: 'host-a', startMs: 0, endMs: 1000, gapAfterMs: gapMs, boundaryAfter: 'cluster', targetSeconds: 1, actualSeconds: 1 },
      { turnId: 't2', index: 1, speakerRole: 'host-b', startMs: 1000 + gapMs, endMs: 2000 + gapMs, gapAfterMs: 0, boundaryAfter: 'none', targetSeconds: 1, actualSeconds: 1 },
    ],
    totalTurnSeconds: 2,
    totalTargetSeconds: 2,
    gapsTotalMs: gapMs,
    totalDurationMs: 2000 + gapMs,
  };
}

describe('mixTurns assembly', () => {
  test('concatenates turns with exact gap silence between them', () => {
    const manifest = manifestWith(250);
    const mix = mixTurns(
      [
        { turnId: 't1', audio: payloadFor(sine(1, 0.4)) },
        { turnId: 't2', audio: payloadFor(sine(1, 0.4)) },
      ],
      manifest,
    );
    const expectedSamples = 44100 * 2 + Math.round(0.25 * 44100);
    expect(mix.samples.length).toBe(expectedSamples);
    expect(mix.durationSeconds).toBeCloseTo(2.25, 6);
    // Gap region is silent.
    const gapStart = 44100;
    const gapEnd = gapStart + Math.round(0.25 * 44100);
    for (let i = gapStart; i < gapEnd; i += 1) {
      expect(mix.samples[i]).toBe(0);
    }
    // Turn regions are not silent.
    expect(Math.abs(mix.samples[100] ?? 0)).toBeGreaterThan(0.01);
    expect(Math.abs(mix.samples[gapEnd + 100] ?? 0)).toBeGreaterThan(0.01);
    // Measured actual durations come back per turn.
    expect(mix.actualSecondsByTurnId.get('t1')).toBeCloseTo(1, 6);
  });

  test('resamples non-44.1k payloads into the common format', () => {
    const manifest = manifestWith(0);
    const mix = mixTurns(
      [
        { turnId: 't1', audio: payloadFor(sine(1, 0.4, 24000), 24000) },
        { turnId: 't2', audio: payloadFor(sine(1, 0.4, 24000), 24000) },
      ],
      manifest,
    );
    expect(mix.samples.length).toBe(88200);
  });
});

describe('masterTrack backends', () => {
  const mixInput = () => {
    const manifest = manifestWith(200);
    return mixTurns(
      [
        { turnId: 't1', audio: payloadFor(sine(1.5, 0.3)) },
        { turnId: 't2', audio: payloadFor(sine(1.5, 0.25)) },
      ],
      manifest,
    );
  };

  test('pure-ts backend is byte-deterministic', () => {
    const a = masterTrack(mixInput(), { backend: 'pure-ts' });
    const b = masterTrack(mixInput(), { backend: 'pure-ts' });
    expect(a.backend).toBe('pure-ts');
    expect(sha(a.wav)).toBe(sha(b.wav));
    expect(a.lufs).toBeCloseTo(TARGET_LUFS, 0);
  });

  test('ffmpeg backend: deterministic per run and loudness-cross-checked (skip when absent)', () => {
    if (!ffmpegAvailable()) {
      return;
    }
    const pure = masterTrack(mixInput(), { backend: 'pure-ts' });
    const a = masterTrack(mixInput(), { backend: 'ffmpeg', mp3: true });
    const b = masterTrack(mixInput(), { backend: 'ffmpeg' });
    expect(a.backend).toBe('ffmpeg');
    expect(sha(a.wav)).toBe(sha(b.wav));
    // Same duration as the mix.
    const decoded = decodeWav(a.wav);
    expect(decoded.samples.length / decoded.sampleRate).toBeCloseTo(3.2, 1);
    // Cross-backend loudness agreement within 2 LU (fallback cross-check, §7).
    expect(Math.abs(a.lufs - pure.lufs)).toBeLessThanOrEqual(2.0);
    expect(Math.abs(a.lufs - TARGET_LUFS)).toBeLessThanOrEqual(1.0);
    // MP3 emission.
    expect(a.mp3).toBeDefined();
    expect((a.mp3?.byteLength ?? 0)).toBeGreaterThan(1000);
  });

  test('requesting ffmpeg when absent throws honestly', () => {
    if (ffmpegAvailable()) {
      return;
    }
    expect(() => masterTrack(mixInput(), { backend: 'ffmpeg' })).toThrow(/ffmpeg/);
  });
});
