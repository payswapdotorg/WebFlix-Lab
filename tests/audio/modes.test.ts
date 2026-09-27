/**
 * Mode-semantics tests (H-A-01/02/03 lab predicates from
 * tests/audio/mode-semantics.md §2).
 *
 * Post-H-2 (2026-09-27): canonical per-mode plans are Director-emitted
 * fixtures (plan-audio-brief-2min / plan-audio-critique-5min /
 * plan-audio-debate-5min, compiled by compileOverviewPlan with fixed seeds).
 * STRUCTURAL predicates (turn skeletons, purpose distributions, coverage
 * compression, end-to-end validation, speaker pairing) run against those.
 *
 * The keyword-heuristic enriched-tag predicates (assessment/limitation/
 * verdict/position/rebuttal registers) still run against the labeled
 * audio-local stand-ins: those heuristics key on brief trigger words the
 * Director does not emit, so they cannot fire on canonical plans
 * (DESIGN.md §16.4 item 1; feeds the consolidated v2 wave per adjudication
 * H-1). Product-level claims stay HYPOTHESIS until EXP-A black-box runs.
 */

import { describe, expect, test } from 'bun:test';
import { compileAudioOverview } from '../../src/audio';
import { buildDialogueGraph } from '../../src/audio/dialogue/engine';
import {
  buildBriefStandinPlan,
  buildCritiqueStandinPlan,
  buildDebateStandinPlan,
  CANONICAL_BRIEF_PLAN,
  CANONICAL_CRITIQUE_PLAN,
  CANONICAL_DEBATE_PLAN,
  CANONICAL_GRAPH,
  CANONICAL_PLAN,
  CANONICAL_SOURCE,
  FIXED_NOW,
  FIXED_SEED,
} from './fixtures';

async function compile(plan: typeof CANONICAL_PLAN) {
  return compileAudioOverview({
    plan,
    graph: CANONICAL_GRAPH,
    sources: CANONICAL_SOURCE,
    options: { seed: FIXED_SEED, now: FIXED_NOW, mastering: 'pure-ts' },
  });
}

describe('H-A-01 — Deep Dive vs Brief (canonical plans)', () => {
  test('canonical brief has no example/connection/question turns; deep dive has all three', () => {
    const briefPurposes = new Set(CANONICAL_BRIEF_PLAN.audioTurns.map((turn) => turn.purpose));
    expect(briefPurposes.has('example')).toBe(false);
    expect(briefPurposes.has('connection')).toBe(false);
    expect(briefPurposes.has('interjection')).toBe(false);
    expect(briefPurposes.has('question')).toBe(false);

    const deepDivePurposes = CANONICAL_PLAN.audioTurns.map((turn) => turn.purpose);
    expect(deepDivePurposes).toContain('example');
    expect(deepDivePurposes).toContain('connection');
    expect(deepDivePurposes).toContain('question');
  });

  test('turn count: deep dive (22) > canonical brief (10) for the same source graph', () => {
    expect(CANONICAL_PLAN.audioTurns.length).toBeGreaterThan(CANONICAL_BRIEF_PLAN.audioTurns.length);
  });

  test('brief coverage is a salience-ranked subset; dropped claims are reported, never silent', async () => {
    const brief = await compile(CANONICAL_BRIEF_PLAN);
    const covered = new Set(brief.plan.coverage.covered.map((entry) => entry.claimId));
    const deepCovered = new Set(
      CANONICAL_PLAN.coverage.covered.map((entry) => entry.claimId),
    );
    // Brief covered set is a strict subset of the deep-dive covered set.
    expect(deepCovered.size).toBe(11);
    expect(covered.size).toBeLessThan(deepCovered.size);
    for (const claimId of covered) {
      expect(deepCovered.has(claimId)).toBe(true);
    }
    // Dropped claims appear in CoverageMap.omitted WITH reasons.
    expect(brief.plan.coverage.omitted.length).toBe(11 - covered.size);
    for (const omitted of brief.plan.coverage.omitted) {
      expect(omitted.reason.length).toBeGreaterThan(0);
    }
    // And W2's coverage QA re-reports the omission honestly (info surface).
    const coverage = brief.qa.metrics.find((m) => m.metric === 'coverage');
    expect(coverage?.value).toContain('omitted');
    expect(brief.qa.issues.some((issue) => issue.code === 'coverage-gap')).toBe(false);
  }, 30000);

  test('both plans validate end-to-end: every factual turn carries existing claim ids', async () => {
    for (const result of [await compile(CANONICAL_PLAN), await compile(CANONICAL_BRIEF_PLAN)]) {
      expect(result.qa.issues.filter((issue) => issue.code === 'unknown-claim-ref')).toEqual([]);
      expect(result.qa.issues.filter((issue) => issue.code === 'ungrounded-factual-turn')).toEqual([]);
    }
  }, 60000);
});

describe('H-A-02 — Deep Dive vs Critique', () => {
  test('critique coverage is near-full (unlike brief), on the canonical plan', async () => {
    const critique = await compile(CANONICAL_CRITIQUE_PLAN);
    const covered = new Set(critique.plan.coverage.covered.map((entry) => entry.claimId));
    expect(covered.size).toBe(11);
  }, 30000);

  // The enriched-tag predicates below are KEYWORD-HEURISTIC (H-1): they run
  // on the labeled stand-in whose briefs carry the trigger words. On
  // canonical Director plans the heuristics do not fire — that gap is
  // asserted honestly in the QA-expectations describe below.
  test('stand-in critique carries assessment/limitation/verdict tags absent from deep dive', async () => {
    const critique = await compile(buildCritiqueStandinPlan());
    const deepDive = buildDialogueGraph({
      plan: CANONICAL_PLAN,
      graph: CANONICAL_GRAPH,
      seed: FIXED_SEED,
    });
    const critiqueTags = new Set(critique.graph.turns.map((turn) => turn.enrichedTag));
    const deepTags = new Set(deepDive.turns.map((turn) => turn.enrichedTag));
    for (const tag of ['assessment', 'limitation', 'verdict'] as const) {
      expect(critiqueTags.has(tag)).toBe(true);
      expect(deepTags.has(tag)).toBe(false);
    }
  });

  test('limitation turns are grounded: the redaction limitation cites the constraint claim; no invented criticism', async () => {
    const critique = await compile(buildCritiqueStandinPlan());
    const limitations = critique.graph.turns.filter((turn) => turn.enrichedTag === 'limitation');
    expect(limitations.length).toBeGreaterThanOrEqual(2);
    // The credentials limitation cites the plan's constraint claim.
    const redactionLimitation = limitations.find((turn) =>
      turn.claimIds.includes('claim-credentials-redacted'),
    );
    expect(redactionLimitation).toBeDefined();
    const redactionText = critique.realized.find((r) => r.turnId === redactionLimitation?.id);
    expect(redactionText?.text.toLowerCase()).toContain('credentials');
    // Every limitation voices its own anchor (no fabricated facts — an
    // unflagged cluster says "the source does not address X" instead).
    for (const limitation of limitations) {
      const outcome = critique.realized.find((r) => r.turnId === limitation.id);
      const voiced = limitation.claimIds.some((claimId) => {
        const claim = CANONICAL_GRAPH.claims.find((c) => c.id === claimId);
        const fragment = claim?.statement.replace(/\s+/g, ' ').trim().slice(0, 20).toLowerCase();
        return fragment !== undefined && outcome?.text.toLowerCase().includes(fragment);
      });
      expect(voiced).toBe(true);
    }
  }, 30000);
});

describe('H-A-03 — Deep Dive vs Debate (stand-in enriched tags)', () => {
  // The argument-graph predicates are keyword-heuristic on the stand-in
  // (H-1); canonical debate structural differences (speaker-purpose
  // inversion) are asserted in tests/contracts/fixtures.test.ts.
  test('debate stand-in creates an argument graph absent from deep dive', async () => {
    const debate = await compile(buildDebateStandinPlan());
    const deepDive = buildDialogueGraph({
      plan: CANONICAL_PLAN,
      graph: CANONICAL_GRAPH,
      seed: FIXED_SEED,
    });
    const debateTags = new Set(debate.graph.turns.map((turn) => turn.enrichedTag));
    const deepTags = new Set(deepDive.turns.map((turn) => turn.enrichedTag));
    for (const tag of ['position_statement', 'rebuttal', 'cross_examination'] as const) {
      expect(debateTags.has(tag)).toBe(true);
      expect(deepTags.has(tag)).toBe(false);
    }
    // Argument wiring: every rebuttal respondsTo a position.
    const rebuttals = debate.graph.turns.filter((turn) => turn.enrichedTag === 'rebuttal');
    for (const rebuttal of rebuttals) {
      expect(rebuttal.links.respondsTo.length).toBeGreaterThan(0);
    }
  }, 30000);

  test('uncontested claims are never debate positions (no fabricated disagreement)', async () => {
    const debate = await compile(buildDebateStandinPlan());
    const positions = debate.graph.turns.filter(
      (turn) => turn.enrichedTag === 'position_statement',
    );
    // Exactly the two opening positions (the motion statement stays framing).
    expect(positions.length).toBe(2);
    expect(positions.map((p) => p.id).sort()).toEqual(['d-turn-2', 'd-turn-3']);
    for (const position of positions) {
      expect(position.claimIds).not.toContain('claim-audits');
      expect(position.claimIds).not.toContain('claim-provider-integrations');
      expect(position.claimIds).not.toContain('claim-deployment-pipelines');
    }
  }, 30000);

  test('closing is an evidence-weighted synthesis, no artificial winner text', async () => {
    const debate = await compile(buildDebateStandinPlan());
    const closing = debate.graph.turns.filter((turn) => turn.purpose === 'conclusion');
    expect(closing.length).toBe(1);
    const outcome = debate.realized.find((r) => r.turnId === closing[0]?.id);
    expect(outcome?.text.toLowerCase()).not.toContain('winner');
    expect(outcome?.text.toLowerCase()).not.toContain('definitively wins');
  }, 30000);
});

describe('mode-semantics QA expectations', () => {
  test('deep dive compile satisfies its mode expectations (question/example/connection present)', async () => {
    const result = await compile(CANONICAL_PLAN);
    expect(result.qa.issues.some((issue) => issue.code === 'mode-semantics-missing')).toBe(false);
  }, 60000);

  test('critique/debate stand-ins satisfy their keyword-heuristic expectations', async () => {
    for (const plan of [buildCritiqueStandinPlan(), buildDebateStandinPlan()]) {
      const result = await compile(plan);
      expect(result.qa.issues.some((issue) => issue.code === 'mode-semantics-missing')).toBe(false);
    }
  }, 60000);

  test('HONEST GAP (H-1): canonical critique/debate plans flag the keyword heuristics as missing', async () => {
    // The Director emits mode-agnostic briefs (no assess/limitation/verdict/
    // position trigger words), so the HYPOTHESIS-grade enriched-tag heuristics
    // cannot fire on canonical plans and the QA machinery honestly reports
    // mode-semantics-missing. This documents the integration finding that
    // feeds the consolidated v2 contract wave (adjudication H-1): plan-level
    // stance/contestedness signals, not brief keywords.
    for (const plan of [CANONICAL_CRITIQUE_PLAN, CANONICAL_DEBATE_PLAN]) {
      const result = await compile(plan);
      expect(result.qa.issues.some((issue) => issue.code === 'mode-semantics-missing')).toBe(true);
    }
    // The canonical brief (no enriched-tag expectations) stays clean.
    const brief = await compile(CANONICAL_BRIEF_PLAN);
    expect(brief.qa.issues.some((issue) => issue.code === 'mode-semantics-missing')).toBe(false);
  }, 60000);

  test('purpose distributions differ across modes for the same source graph', () => {
    // Honest post-H-2 form: brief is distributionally distinct (compression
    // drops the exploration purposes); critique and critique-vs-debate share
    // the purpose multiset and differ in the SPEAKER-PURPOSE SIGNATURE
    // (host-a interrogates in critique, host-b in debate) — asserted on the
    // canonical plans; the stand-ins remain distributionally distinct too.
    const dist = (plan: typeof CANONICAL_PLAN): string =>
      [...plan.audioTurns.map((turn) => turn.purpose)].sort().join(',');
    expect(dist(CANONICAL_BRIEF_PLAN)).not.toBe(dist(CANONICAL_PLAN));
    expect(dist(CANONICAL_CRITIQUE_PLAN)).not.toBe(dist(CANONICAL_PLAN));
    expect(dist(CANONICAL_DEBATE_PLAN)).not.toBe(dist(CANONICAL_PLAN));
    expect(dist(CANONICAL_CRITIQUE_PLAN)).toBe(dist(CANONICAL_DEBATE_PLAN)); // same multiset...
    const signature = (plan: typeof CANONICAL_PLAN): string =>
      plan.audioTurns.map((turn) => `${turn.speakerRole}:${turn.purpose}`).join(' ');
    expect(signature(CANONICAL_CRITIQUE_PLAN)).not.toBe(signature(CANONICAL_DEBATE_PLAN)); // ...different pairing
    const standins = new Set([
      dist(buildBriefStandinPlan()),
      dist(buildCritiqueStandinPlan()),
      dist(buildDebateStandinPlan()),
    ]);
    expect(standins.size).toBe(3);
  });
});
