/**
 * Mode-semantics tests (H-A-01/02/03 lab predicates from
 * tests/audio/mode-semantics.md §2).
 *
 * Post-freeze: structural differences live in the PLANS; these tests compile
 * per-mode plans (canonical deep-dive + audio-local stand-ins labeled
 * non-canonical per DESIGN.md §16.4 item 2) and assert realization +
 * validation semantics and mode-conditioned QA. Product-level claims stay
 * HYPOTHESIS until EXP-A black-box runs.
 */

import { describe, expect, test } from 'bun:test';
import { compileAudioOverview } from '../../src/audio';
import { buildDialogueGraph } from '../../src/audio/dialogue/engine';
import {
  buildBriefPlan,
  buildCritiquePlan,
  buildDebatePlan,
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

describe('H-A-01 — Deep Dive vs Brief', () => {
  test('brief stand-in has no example/connection turns; deep dive has both', () => {
    const brief = buildBriefPlan();
    const briefPurposes = new Set(brief.audioTurns.map((turn) => turn.purpose));
    expect(briefPurposes.has('example')).toBe(false);
    expect(briefPurposes.has('connection')).toBe(false);
    expect(briefPurposes.has('interjection')).toBe(false);

    const deepDivePurposes = CANONICAL_PLAN.audioTurns.map((turn) => turn.purpose);
    expect(deepDivePurposes).toContain('example');
    expect(deepDivePurposes).toContain('connection');
    expect(deepDivePurposes).toContain('question');
  });

  test('turn count: deep dive (22) > brief (7) for the same source graph', () => {
    expect(CANONICAL_PLAN.audioTurns.length).toBeGreaterThan(buildBriefPlan().audioTurns.length);
  });

  test('brief coverage is a salience-ranked subset; dropped claims are reported, never silent', async () => {
    const brief = await compile(buildBriefPlan());
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
    for (const result of [await compile(CANONICAL_PLAN), await compile(buildBriefPlan())]) {
      expect(result.qa.issues.filter((issue) => issue.code === 'unknown-claim-ref')).toEqual([]);
      expect(result.qa.issues.filter((issue) => issue.code === 'ungrounded-factual-turn')).toEqual([]);
    }
  }, 60000);
});

describe('H-A-02 — Deep Dive vs Critique', () => {
  test('critique carries assessment/limitation/verdict tags absent from deep dive', async () => {
    const critique = await compile(buildCritiquePlan());
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

  test('critique coverage is near-full (unlike brief)', async () => {
    const critique = await compile(buildCritiquePlan());
    const covered = new Set(critique.plan.coverage.covered.map((entry) => entry.claimId));
    expect(covered.size).toBe(11);
  });

  test('limitation turns are grounded: the redaction limitation cites the constraint claim; no invented criticism', async () => {
    const critique = await compile(buildCritiquePlan());
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

describe('H-A-03 — Deep Dive vs Debate', () => {
  test('debate creates an argument graph absent from deep dive', async () => {
    const debate = await compile(buildDebatePlan());
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
    const debate = await compile(buildDebatePlan());
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
    const debate = await compile(buildDebatePlan());
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

  test('critique/debate stand-ins satisfy their expectations', async () => {
    for (const plan of [buildCritiquePlan(), buildDebatePlan()]) {
      const result = await compile(plan);
      expect(result.qa.issues.some((issue) => issue.code === 'mode-semantics-missing')).toBe(false);
    }
  }, 60000);

  test('purpose distributions differ across modes for the same source graph', async () => {
    const [brief, critique, debate] = [buildBriefPlan(), buildCritiquePlan(), buildDebatePlan()];
    const dist = (plan: typeof CANONICAL_PLAN): string =>
      [...plan.audioTurns.map((turn) => turn.purpose)].sort().join(',');
    const all = new Set([dist(brief), dist(critique), dist(debate), dist(CANONICAL_PLAN)]);
    expect(all.size).toBe(4);
  });
});
