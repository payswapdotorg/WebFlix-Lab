/**
 * Canonical per-mode integration tests (H-2, Phase 3 TL integration
 * 2026-09-27; adjudication docs/handoff/handoff-adjudications-001.md).
 *
 * The three Director-emitted canonical plans (plan-audio-brief-2min /
 * plan-audio-critique-5min / plan-audio-debate-5min, frozen in
 * fixtures/contracts with pinned fingerprints in fixtures.test.ts) are
 * compiled through the FULL W2 audio pipeline (DialogueGraph -> realized
 * text -> mix/master -> QA). These are the EXP-A structural re-run anchors:
 * every future experiment on per-mode structure cites these plan
 * fingerprints, not audio-local stand-ins.
 *
 * Fixture-only success is NOT product parity evidence (AGENTS.md): these
 * tests establish that the canonical plans integrate with the audio surface
 * and that the pipeline's mode machinery behaves deterministically on them.
 */

import { describe, expect, test } from 'bun:test';
import { compileAudioOverview } from '../../src/audio';
import { compileOverviewPlan } from '../../src/director/compiler';
import {
  CANONICAL_BRIEF_PLAN,
  CANONICAL_CRITIQUE_PLAN,
  CANONICAL_DEBATE_PLAN,
  CANONICAL_GRAPH,
  CANONICAL_SOURCE,
  FIXED_NOW,
  FIXED_SEED,
} from './fixtures';

const CANONICAL_MODE_PLANS = [
  { label: 'brief', plan: CANONICAL_BRIEF_PLAN },
  { label: 'critique', plan: CANONICAL_CRITIQUE_PLAN },
  { label: 'debate', plan: CANONICAL_DEBATE_PLAN },
] as const;

function compileCanonical(plan: typeof CANONICAL_BRIEF_PLAN) {
  return compileAudioOverview({
    plan,
    graph: CANONICAL_GRAPH,
    sources: CANONICAL_SOURCE,
    options: { seed: FIXED_SEED, now: FIXED_NOW, mastering: 'pure-ts' },
  });
}

describe('canonical per-mode plans through the audio pipeline (H-2)', () => {
  test('every canonical per-mode plan compiles end-to-end with clean grounding', async () => {
    for (const { label, plan } of CANONICAL_MODE_PLANS) {
      const result = await compileCanonical(plan);
      expect(result.qa.issues.filter((issue) => issue.code === 'unknown-claim-ref'), label).toEqual([]);
      expect(result.qa.issues.filter((issue) => issue.code === 'ungrounded-factual-turn'), label).toEqual([]);
      // Realization covers the full turn skeleton (no dropped turns).
      expect(result.realized.length, label).toBe(plan.audioTurns.length);
    }
  }, 90000);

  test('WFLX-P3A fix (EV-005): canonical per-mode plans compile IN budget', async () => {
    // HONEST-GAP TEST FLIP (work order WFLX-P3A, 2026-09-27): until this
    // change, this test asserted the DOCUMENTED integration finding — the
    // Director assigned up to two full claim statements to every turn
    // regardless of duration, the minimum-weight topic beat's turns came
    // out 5-6 s, and canonical critique/debate compiles raised 4
    // turn-over-budget errors each (qa.status failed; EV-005, W1 feedback
    // per DESIGN.md §16.2 item 3). The Director's turn-budget allocation is
    // now anchor-mass-aware (src/director/compiler.ts), so the intended
    // red->green transition of this work order is: zero turn-over-budget
    // errors and non-failed status on ALL THREE canonical plans. This is
    // the explicit flip, not a silent absorption; the over-budget LADDER
    // itself is still enforced by the audio-local mutant test
    // (qa-metrics.test.ts) — a plan with impossible anchors still fails.
    for (const { label, plan } of CANONICAL_MODE_PLANS) {
      const result = await compileCanonical(plan);
      const over = result.qa.issues.filter((issue) => issue.code === 'turn-over-budget');
      expect(over, label).toEqual([]);
      expect(result.qa.status, label).not.toBe('failed');
    }
  }, 90000);

  test('WFLX-P3A compression case (EXP-A-05 mechanism): a 180 s Director deep-dive compiles with zero over-budget turns', async () => {
    // EV-006 EXP-A-05 sharpened the EV-005 finding: under duration
    // compression (300 s -> 180 s, same source/graph/seed) the pre-fix
    // defect COMPOUNDED — over-budget errors rose 4 -> 11 while coverage
    // dropped 11/11 -> 7/11 by salience omission. Post-fix, the same
    // compression arm (Director seed wflx-exp-a-director-seed, audio seed
    // wflx-exp-a-audio-seed — the EXP-A conventions) must hold the
    // over-budget count at ZERO while keeping the honest salience-driven
    // omission with reasons.
    const plan = compileOverviewPlan({
      sources: [CANONICAL_SOURCE],
      graph: CANONICAL_GRAPH,
      modality: 'audio',
      mode: 'deep-dive',
      targetDurationSeconds: 180,
      seed: 'wflx-exp-a-director-seed',
      now: '2026-09-27T00:00:00Z',
    });
    // Compression still omits low-salience claims, with reasons.
    expect(plan.coverage.covered.length).toBe(7);
    expect(plan.coverage.omitted.length).toBe(4);
    for (const omitted of plan.coverage.omitted) {
      expect(omitted.reason.length).toBeGreaterThan(0);
    }
    const result = await compileAudioOverview({
      plan,
      graph: CANONICAL_GRAPH,
      sources: CANONICAL_SOURCE,
      options: {
        seed: 'wflx-exp-a-audio-seed',
        now: '2026-09-27T00:00:00Z',
        mastering: 'pure-ts',
      },
    });
    expect(result.qa.issues.filter((issue) => issue.code === 'turn-over-budget')).toEqual([]);
    expect(result.qa.status).not.toBe('failed');
    // Every covered claim is still voiced (no silent coverage under
    // compression).
    const voiced = new Set(plan.audioTurns.flatMap((turn) => [...turn.claimIds]));
    for (const entry of plan.coverage.covered) {
      expect(voiced.has(entry.claimId), `covered claim ${entry.claimId} voiced by no turn`).toBe(true);
    }
  }, 90000);

  test('plan turn skeletons pass through the DialogueGraph unchanged', async () => {
    // Plan authority (DESIGN.md §16.2 item 1): speakers, purposes and order
    // are the plan's; the graph may only enrich, never rewrite.
    for (const { label, plan } of CANONICAL_MODE_PLANS) {
      const result = await compileCanonical(plan);
      expect(result.graph.turns.length, label).toBe(plan.audioTurns.length);
      for (const [i, turn] of result.graph.turns.entries()) {
        const planTurn = plan.audioTurns[i];
        if (planTurn === undefined) throw new Error(`${label}: graph has turn ${i} beyond the plan skeleton`);
        expect(turn.id, `${label} turn ${i}`).toBe(planTurn.id);
        expect(turn.speakerRole, `${label} turn ${i}`).toBe(planTurn.speakerRole);
        expect(turn.purpose, `${label} turn ${i}`).toBe(planTurn.purpose);
        expect(turn.claimIds, `${label} turn ${i}`).toEqual(planTurn.claimIds);
      }
    }
  }, 90000);

  test('same-seed recompile is turn-identical on a canonical per-mode plan', async () => {
    // Determinism culture (AGENTS.md / W2 determinism test): same canonical
    // plan + same seed => identical realized text sequence. Full-artifact
    // byte-determinism stays enforced by the deep-dive determinism test;
    // this anchors the per-mode surface to the same discipline.
    const first = await compileCanonical(CANONICAL_CRITIQUE_PLAN);
    const second = await compileCanonical(CANONICAL_CRITIQUE_PLAN);
    expect(second.realized.map((r) => r.text)).toEqual(first.realized.map((r) => r.text));
    expect(second.qa.metrics.map((m) => m.value)).toEqual(first.qa.metrics.map((m) => m.value));
  }, 60000);

  test('critique/debate full coverage re-reports cleanly at the audio boundary', async () => {
    // H-A-02 predicate 4 (plan level, asserted in fixtures.test.ts) says
    // critique/debate keep full coverage; here the audio surface agrees:
    // no coverage-gap errors, the coverage metric names all 11 claims.
    for (const { label, plan } of CANONICAL_MODE_PLANS.filter((m) => m.label !== 'brief')) {
      const result = await compileCanonical(plan);
      expect(result.qa.issues.some((issue) => issue.code === 'coverage-gap'), label).toBe(false);
      const coverage = result.qa.metrics.find((m) => m.metric === 'coverage');
      expect(coverage?.value, label).toContain('11/11');
    }
  }, 90000);
});
