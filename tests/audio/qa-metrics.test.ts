/**
 * QA metric tests: pronunciation risk, number rendering, over-budget
 * emission, per-turn drift detection (with a fake provider), defect scan.
 * All deterministic; no LLM self-assessment anywhere.
 */

import { describe, expect, test } from 'bun:test';
import { compileAudioOverview } from '../../src/audio';
import { numberToWords, scanPronunciationRisks } from '../../src/audio/qa/pronunciation';
import type { SpeechProvider, SpeechTurnRequest, SpeechTurnResult, SpeechProviderCapabilities } from '../../src/providers/audio/port';
import { encodeWavPcm16 } from '../../src/audio/mixing/wav';
import {
  buildShortBenchmarkPlan,
  CANONICAL_GRAPH,
  CANONICAL_SOURCE,
  FIXED_NOW,
  FIXED_SEED,
  mutantOverBudgetTurn,
} from './fixtures';

describe('pronunciation risk scan', () => {
  test('flags acronyms, symbols, digits, camelCase with deterministic hints', () => {
    const risks = scanPronunciationRisks(
      'The LLM stack pairs Postgres/Neon with 24 nodes and a digitalTwin model.',
    );
    const byToken = new Map(risks.map((risk) => [risk.token, risk]));
    expect(byToken.get('LLM')).toEqual({ token: 'LLM', say: 'L L M', reason: 'acronym' });
    expect(byToken.get('Postgres/Neon')?.reason).toBe('symbols');
    expect(byToken.get('Postgres/Neon')?.say).toContain('slash');
    expect(byToken.get('24')).toEqual({ token: '24', say: 'twenty-four', reason: 'digits' });
    expect(byToken.get('digitalTwin')).toEqual({
      token: 'digitalTwin',
      say: 'digital Twin',
      reason: 'mixed-case',
    });
  });

  test('proper nouns mid-sentence are flagged for review (say unchanged)', () => {
    const risks = scanPronunciationRisks('We picked Chatterbox for the runtime.');
    expect(risks.some((risk) => risk.token === 'Chatterbox' && risk.reason === 'proper-noun')).toBe(true);
    // Common sentence words are not flagged.
    const clean = scanPronunciationRisks('This is the thing we talked about.');
    expect(clean.some((risk) => risk.reason === 'proper-noun')).toBe(false);
  });

  test('long technical tokens split on boundaries; symbols expand first', () => {
    // Hyphenated long token without other triggers -> long-token split.
    const risks = scanPronunciationRisks('The digital-twin-world-monitoring-infrastructure stack runs.');
    const long = risks.find((risk) => risk.reason === 'long-token');
    expect(long).toBeDefined();
    expect(long?.say).toBe('digital twin world monitoring infrastructure');

    // A slash inside a long token expands as a symbol first (rule order).
    const slashed = scanPronunciationRisks('The digital-twin/world-monitoring stack runs.');
    const symbol = slashed.find((risk) => risk.reason === 'symbols');
    expect(symbol).toBeDefined();
    expect(symbol?.say).toContain('slash');
  });

  test('number rendering (en)', () => {
    expect(numberToWords(0)).toBe('zero');
    expect(numberToWords(7)).toBe('seven');
    expect(numberToWords(15)).toBe('fifteen');
    expect(numberToWords(42)).toBe('forty-two');
    expect(numberToWords(100)).toBe('one hundred');
    expect(numberToWords(105)).toBe('one hundred five');
    expect(numberToWords(1234)).toBe('one thousand two hundred thirty-four');
    expect(numberToWords(1_000_000)).toBe('one million');
  });
});

describe('over-budget emission (H-A-05 lab predicate 2)', () => {
  test('a turn whose anchors cannot fit emits turn-over-budget naming the turn', async () => {
    const mutant = mutantOverBudgetTurn();
    const result = await compileAudioOverview({
      plan: mutant,
      graph: CANONICAL_GRAPH,
      sources: CANONICAL_SOURCE,
      options: { seed: FIXED_SEED, now: FIXED_NOW, mastering: 'pure-ts' },
    });
    expect(result.qa.status).toBe('failed');
    const overBudget = result.qa.issues.find((issue) => issue.code === 'turn-over-budget');
    expect(overBudget).toBeDefined();
    expect(overBudget?.unitId).toBe('turn-6');
    // The turn still voices ALL its anchors (never silently dropped).
    const turn6 = result.graph.turns.find((turn) => turn.id === 'turn-6');
    const outcome = result.realized.find((r) => r.turnId === 'turn-6');
    expect(turn6?.claimIds.length).toBe(7);
    for (const claimId of turn6?.claimIds ?? []) {
      const claim = CANONICAL_GRAPH.claims.find((c) => c.id === claimId);
      const fragment = claim?.statement.replace(/\s+/g, ' ').trim().slice(0, 20).toLowerCase();
      expect(outcome?.text.toLowerCase().includes(fragment ?? '@@@')).toBe(true);
    }
    expect(outcome?.overBudget).toBe(true);
  }, 60000);
});

describe('turn duration drift (post-synthesis QA)', () => {
  /** Fake provider that doubles every requested duration (drift source). */
  const doubleDurationProvider: SpeechProvider = {
    id: 'fake-double-duration',
    kind: 'offline-deterministic',
    capabilities(): SpeechProviderCapabilities {
      return {
        nativeMultiSpeaker: false,
        maxSpeakers: 2,
        perSpeakerVoiceParams: true,
        supportsPronunciationHints: false,
        supportsCrossTurnConditioning: false,
        containers: ['wav'],
      };
    },
    requiredCredentialKeys: () => [],
    synthesizeTurn(request: SpeechTurnRequest): Promise<SpeechTurnResult> {
      const seconds = (request.targetSeconds ?? 2) * 2;
      const samples = new Float64Array(Math.round(seconds * 44100));
      for (let i = 0; i < samples.length; i += 1) {
        samples[i] = 0.2 * Math.sin((2 * Math.PI * 300 * i) / 44100);
      }
      return Promise.resolve({
        turnId: request.turnId,
        audio: {
          data: encodeWavPcm16(samples, 44100),
          container: 'wav',
          sampleRate: 44100,
          channels: 1,
          bitsPerSample: 16,
        },
        durationSeconds: seconds,
        effectiveVoiceParams: { engine: 'fake-double-duration', voice: request.speakerId },
      });
    },
  };

  test('provider durations 2x off target -> turn-duration-drift issues naming turns', async () => {
    const result = await compileAudioOverview({
      plan: buildShortBenchmarkPlan(),
      graph: CANONICAL_GRAPH,
      sources: CANONICAL_SOURCE,
      options: {
        seed: FIXED_SEED,
        now: FIXED_NOW,
        mastering: 'pure-ts',
        provider: doubleDurationProvider,
      },
    });
    const drifts = result.qa.issues.filter((issue) => issue.code === 'turn-duration-drift');
    expect(drifts.length).toBe(5);
    for (const drift of drifts) {
      expect(drift.unitId).toBeDefined();
    }
    // The manifest reflects the measured (doubled) reality.
    expect(result.timing.totalTurnSeconds).toBeCloseTo(84, 6);
  });
});

describe('defect scan on the canonical offline path', () => {
  test('no clipping, no zero-length turns, container integrity holds', async () => {
    const result = await compileAudioOverview({
      plan: buildShortBenchmarkPlan(),
      graph: CANONICAL_GRAPH,
      sources: CANONICAL_SOURCE,
      options: { seed: FIXED_SEED, now: FIXED_NOW, mastering: 'pure-ts' },
    });
    const codes = result.qa.issues.map((issue) => issue.code);
    expect(codes).not.toContain('clipping');
    expect(codes).not.toContain('zero-length-turn');
    expect(codes).not.toContain('container-integrity');
    expect(codes).not.toContain('long-silence');
  });
});

describe('QA report shape', () => {
  test('report carries the compiler id, plan binding and all 13 metrics', async () => {
    const result = await compileAudioOverview({
      plan: buildShortBenchmarkPlan(),
      graph: CANONICAL_GRAPH,
      sources: CANONICAL_SOURCE,
      options: { seed: FIXED_SEED, now: FIXED_NOW, mastering: 'pure-ts' },
    });
    expect(result.qa.compiler).toBe('AudioOverviewCompiler@0.1.0');
    expect(result.qa.metrics.length).toBe(13);
    expect(result.qa.metrics.map((m) => m.metric)).toEqual([
      'duration_vs_target',
      'turn_duration_drift',
      'speaker_consistency',
      'pause_distribution',
      'groundedness',
      'coverage',
      'turn_taking_naturalness',
      'pronunciation_risk',
      'loudness',
      'defect_scan',
      'mode_semantics',
      'text_density_fit',
      'language',
    ]);
    // QaSummary on the artifact stays consistent with the report.
    expect(result.artifact.qa?.status).toBe(result.qa.status);
    expect(result.artifact.qa?.issues.length).toBe(result.qa.issues.length);
  });
});
