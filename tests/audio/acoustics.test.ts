/**
 * Acoustic measurement primitive tests (WFLX-P1, EV-017): determinism,
 * spectral sanity on synthetic tones (the Goertzel/LTAS estimator), and the
 * speaker-consistency measurement on synthetic two-voice signals.
 */

import { describe, expect, test } from 'bun:test';
import {
  ACOUSTIC_BANDS,
  bandDistance,
  measureSpeakerAcousticConsistency,
  turnAcousticProfile,
  type TurnAcousticProfile,
} from '../../src/audio/qa/acoustics';

const SAMPLE_RATE = 24000;

/** A steady sine tone of `seconds` at `freqHz` (deterministic). */
function tone(seconds: number, freqHz: number, amp = 0.4): Float64Array {
  const n = Math.round(seconds * SAMPLE_RATE);
  const samples = new Float64Array(n);
  for (let i = 0; i < n; i += 1) {
    samples[i] = amp * Math.sin((2 * Math.PI * freqHz * i) / SAMPLE_RATE);
  }
  return samples;
}

/** Band index for a frequency (helper for expectations). */
function bandIndexOf(freqHz: number): number {
  return ACOUSTIC_BANDS.findIndex(
    (band) => freqHz >= band.minHz && freqHz <= band.maxHz,
  );
}

describe('turnAcousticProfile (LTAS estimator)', () => {
  test('deterministic: identical samples -> identical profile', () => {
    const samples = tone(1.0, 180);
    const a = turnAcousticProfile('t1', samples, SAMPLE_RATE);
    const b = turnAcousticProfile('t1', samples, SAMPLE_RATE);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  test('a 150 Hz tone concentrates band energy in the f0 region with centroid near the tone', () => {
    const profile = turnAcousticProfile('t1', tone(1.5, 150), SAMPLE_RATE);
    const f0 = bandIndexOf(150);
    const dominant = profile.bandEnergy.indexOf(Math.max(...profile.bandEnergy));
    expect(dominant).toBe(f0);
    // Centroid within the f0-region band bounds.
    expect(profile.spectralCentroidHz).toBeGreaterThanOrEqual(80);
    expect(profile.spectralCentroidHz).toBeLessThanOrEqual(300);
    expect(profile.activeSeconds).toBeGreaterThan(1.0);
  });

  test('a 1500 Hz tone concentrates band energy in the f2 region', () => {
    const profile = turnAcousticProfile('t2', tone(1.5, 1500), SAMPLE_RATE);
    const f2 = bandIndexOf(1500);
    const dominant = profile.bandEnergy.indexOf(Math.max(...profile.bandEnergy));
    expect(dominant).toBe(f2);
    expect(profile.spectralCentroidHz).toBeGreaterThan(900);
    expect(profile.spectralCentroidHz).toBeLessThan(2500);
  });

  test('band energies are normalized (sum to 1) and silence is gated out', () => {
    // Half silence, half tone: activeSeconds ~ half.
    const silence = new Float64Array(Math.round(1 * SAMPLE_RATE));
    const speech = tone(1, 200);
    const samples = new Float64Array([...silence, ...speech]);
    const profile = turnAcousticProfile('t3', samples, SAMPLE_RATE);
    const sum = profile.bandEnergy.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 5);
    expect(profile.activeSeconds).toBeLessThan(1.3);
    expect(profile.activeSeconds).toBeGreaterThan(0.7);
  });

  test('zero-crossing rate tracks frequency for pure tones', () => {
    const low = turnAcousticProfile('low', tone(1, 150), SAMPLE_RATE);
    const high = turnAcousticProfile('high', tone(1, 1200), SAMPLE_RATE);
    // ZCR ~ 2 x freq for a sine (both crossings per cycle).
    expect(low.zeroCrossingRateHz).toBeGreaterThan(240);
    expect(low.zeroCrossingRateHz).toBeLessThan(360);
    expect(high.zeroCrossingRateHz).toBeGreaterThan(1900);
    expect(high.zeroCrossingRateHz).toBeLessThan(2900);
  });
});

describe('measureSpeakerAcousticConsistency', () => {
  function profilesFor(
    voices: { speaker: string; turns: number; freqHz: number }[],
  ): { profiles: TurnAcousticProfile[]; speakerByTurn: Map<string, string> } {
    const profiles: TurnAcousticProfile[] = [];
    const speakerByTurn = new Map<string, string>();
    let i = 0;
    for (const voice of voices) {
      for (let t = 0; t < voice.turns; t += 1) {
        const turnId = `turn-${(i += 1)}`;
        profiles.push(turnAcousticProfile(turnId, tone(1.2, voice.freqHz), SAMPLE_RATE));
        speakerByTurn.set(turnId, voice.speaker);
      }
    }
    return { profiles, speakerByTurn };
  }

  test('two distinct steady voices: within-speaker stable, between separated (PASS)', () => {
    const { profiles, speakerByTurn } = profilesFor([
      { speaker: 'host-a', turns: 3, freqHz: 150 },
      { speaker: 'host-b', turns: 3, freqHz: 1200 },
    ]);
    const measurement = measureSpeakerAcousticConsistency(profiles, speakerByTurn);
    expect(measurement.maxWithinSpeakerDeviation).toBeLessThan(0.05);
    expect(measurement.minBetweenSpeakerDistance).toBeGreaterThan(0.3);
    expect(measurement.separationRatio).toBeGreaterThan(5);
    expect(measurement.passed).toBe(true);
  });

  test('spectrally drifting same-voice turns violate the within tolerance (honest red)', () => {
    const profiles: TurnAcousticProfile[] = [
      turnAcousticProfile('a1', tone(1.2, 150), SAMPLE_RATE),
      turnAcousticProfile('a2', tone(1.2, 1500), SAMPLE_RATE),
      turnAcousticProfile('a3', tone(1.2, 5000), SAMPLE_RATE),
    ];
    const speakerByTurn = new Map([
      ['a1', 'host-a'],
      ['a2', 'host-a'],
      ['a3', 'host-a'],
    ]);
    const measurement = measureSpeakerAcousticConsistency(profiles, speakerByTurn);
    expect(measurement.maxWithinSpeakerDeviation).toBeGreaterThan(0.2);
    expect(measurement.passed).toBe(false);
  });

  test('bandDistance is a proper L1 metric on normalized vectors', () => {
    expect(bandDistance([0.25, 0.25, 0.25, 0.25], [0.25, 0.25, 0.25, 0.25])).toBe(0);
    expect(bandDistance([1, 0, 0, 0], [0, 1, 0, 0])).toBe(2);
    expect(bandDistance([0.5, 0.5], [0.25, 0.75])).toBeCloseTo(0.5, 6);
  });
});
