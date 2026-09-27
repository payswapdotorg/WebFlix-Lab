/**
 * Turn-taking naturalness tests (H-A-04 lab predicates).
 *
 * The plan's turn structure is authoritative: these tests assert the
 * ANALYSIS and the QA feedback loop, never a rewrite. The canonical fixture's
 * known gaps (near-parity walk, zero interjections — DESIGN.md §16.4 item 3)
 * are honestly surfaced as QA issues.
 *
 * The product-level naturalness claim stays HYPOTHESIS until EXP-A runs.
 */

import { describe, expect, test } from 'bun:test';
import { analyzeTurnTaking } from '../../src/audio/dialogue/turn-taking';
import { buildDialogueGraph } from '../../src/audio/dialogue/engine';
import { compileAudioOverview } from '../../src/audio';
import {
  CANONICAL_GRAPH,
  CANONICAL_PLAN,
  CANONICAL_SOURCE,
  FIXED_NOW,
  FIXED_SEED,
  buildShortBenchmarkPlan,
  mutantParityRigid,
} from './fixtures';

function canonicalStats() {
  return analyzeTurnTaking(
    buildDialogueGraph({ plan: CANONICAL_PLAN, graph: CANONICAL_GRAPH, seed: FIXED_SEED }),
  );
}

describe('turn-taking analysis (H-A-04)', () => {
  test('canonical: speaker turn-share inside the 35–65% band (not forced 50/50)', () => {
    const stats = canonicalStats();
    expect(stats.turnCount).toBe(22);
    expect(stats.speakerShares['host-a']).toBeCloseTo(12 / 22, 10);
    expect(stats.speakerShares['host-b']).toBeCloseTo(10 / 22, 10);
    expect(stats.parityBalanced).toBe(true);
  });

  test('canonical: same-speaker runs bounded at <= 2 (justified units)', () => {
    const stats = canonicalStats();
    expect(stats.longestSameSpeakerRun).toBe(2);
  });

  test('canonical: question->answer links exist', () => {
    const stats = canonicalStats();
    expect(stats.questionAnswerPairs).toBeGreaterThanOrEqual(3);
  });

  test('canonical: no backchannel turns — the documented fixture gap', () => {
    const stats = canonicalStats();
    expect(stats.backchannelTurns).toBe(0);
  });

  test('canonical: near-parity walk is detected (19/22 strict alternation)', () => {
    const stats = canonicalStats();
    expect(stats.longestAlternationRun).toBe(19);
    // The QA layer surfaces this honestly against the plan (no rewrite).
  });

  test('RED-ish: strict ABAB mutant spikes the alternation run to 22', () => {
    const mutant = mutantParityRigid();
    const stats = analyzeTurnTaking(
      buildDialogueGraph({ plan: mutant, graph: CANONICAL_GRAPH, seed: FIXED_SEED }),
    );
    expect(stats.longestAlternationRun).toBe(22);
    expect(stats.parityBalanced).toBe(true); // 50/50 is inside the band…
  });
});

describe('turn-taking QA feedback (compile-level)', () => {
  test('canonical compile surfaces alternation-run-long + no-interjection-turns', async () => {
    const result = await compileAudioOverview({
      plan: CANONICAL_PLAN,
      graph: CANONICAL_GRAPH,
      sources: CANONICAL_SOURCE,
      options: { seed: FIXED_SEED, now: FIXED_NOW, mastering: 'pure-ts' },
    });
    const codes = result.qa.issues.map((issue) => issue.code);
    expect(codes).toContain('alternation-run-long');
    expect(codes).toContain('no-interjection-turns');
    // Warnings only — the plan stays authoritative, status is honest.
    expect(result.qa.status).toBe('passed-with-issues');
  }, 60000);

  test('parity-rigid mutant compile flags the near-parity walk', async () => {
    const result = await compileAudioOverview({
      plan: mutantParityRigid(),
      graph: CANONICAL_GRAPH,
      sources: CANONICAL_SOURCE,
      options: { seed: FIXED_SEED, now: FIXED_NOW, mastering: 'pure-ts' },
    });
    const run = result.qa.issues.find((issue) => issue.code === 'alternation-run-long');
    expect(run).toBeDefined();
    expect(run?.message).toContain('22/22');
  }, 60000);

  test('speaker consistency metric: zero variance on the offline path (H-A-08)', async () => {
    const result = await compileAudioOverview({
      plan: buildShortBenchmarkPlan(),
      graph: CANONICAL_GRAPH,
      sources: CANONICAL_SOURCE,
      options: { seed: FIXED_SEED, now: FIXED_NOW, mastering: 'pure-ts' },
    });
    const consistency = result.qa.metrics.find((m) => m.metric === 'speaker_consistency');
    expect(consistency?.value).toContain('0 with parameter variance');
    expect(result.qa.issues.some((issue) => issue.code === 'speaker-voice-variance')).toBe(false);
  });
});
