/**
 * Local refinement loop test (WFLX-P3B wave 1 — Phase 3 checklist §2 item 7;
 * work order Phase 3 "run local refinement tests").
 *
 * The loop under test is plan -> compile -> measure, all in-process and all
 * seeded (determinism is the lab's spine):
 *
 *   1. same-seed byte-stability of the measured metric set — a canonical plan
 *      compiled through the audio surface (cheapest surface) twice with
 *      identical (seed, now, mastering backend) yields byte-identical QA
 *      metric sets, full QA reports, artifact sidecars, timing manifests and
 *      WAV media (DESIGN.md §10; extends to every measured surface);
 *   2. measure -> detect -> refine -> re-measure — an over-packed turn is
 *      escalated by the QA report to its smallest regenerable unit (the
 *      `turn-over-budget` error names the turn id), the refinement is a
 *      plan-space action (Director re-planning of the same source/graph/seed
 *      — the issue text itself defers to Director authority), and the
 *      re-measure reports the defect resolved while remaining byte-stable;
 *   3. loop hygiene — sequential iterations in one process do not leak state:
 *      a failing iteration between two identical canonical iterations does
 *      not perturb the measured metric set.
 *
 * SCOPE NOTE (honest boundary, checklist §2 design note + design-exp-x-02.md):
 * the refinement here is a GLOBAL re-plan. TRUE smallest-unit regeneration
 * (recompile one turn, leave non-target turns byte-identical) is defeated at
 * the text layer by the plan-global planHash seed key — C-5, v2 contract
 * wave candidate; the treatment arm lands as EXP-X-02 with the v2 wave
 * decision. This test pins the v1 control behavior: re-planning is
 * deterministic and measurable.
 *
 * Lab reproduction evidence only — NOT product-parity evidence (AGENTS.md).
 */

import { describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { compileOverviewPlan } from '../../src/director/compiler';
import { compileAudioOverview, stableStringify } from '../../src/audio';
import type { AudioOverviewResult } from '../../src/audio';
import type { OverviewPlan } from '../../src/contracts';
import {
  buildOverBudgetTurnPlan,
  CANONICAL_AUDIO_PLAN,
  CANONICAL_GRAPH,
  CANONICAL_SOURCE,
  LOOP_NOW,
  LOOP_SEED,
} from './fixtures';

const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

/** The audio surface's deterministic metric set (DESIGN.md §9 order). */
const EXPECTED_METRIC_IDS = [
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
] as const;

/** One loop iteration: plan -> compile -> measure (audio surface, fixed seed/now/backend). */
async function runIteration(plan: OverviewPlan): Promise<AudioOverviewResult> {
  return compileAudioOverview({
    plan,
    graph: CANONICAL_GRAPH,
    sources: CANONICAL_SOURCE,
    options: { seed: LOOP_SEED, now: LOOP_NOW, mastering: 'pure-ts' },
  });
}

describe('local refinement loop (Phase 3 checklist §2 item 7)', () => {
  test('plan -> compile -> measure: same-seed metric set is byte-stable across two identical in-process runs', async () => {
    const run1 = await runIteration(CANONICAL_AUDIO_PLAN);
    const run2 = await runIteration(CANONICAL_AUDIO_PLAN);

    // The measured metric set: full deterministic inventory, stable order.
    expect(run1.qa.metrics.map((m) => m.metric)).toEqual([...EXPECTED_METRIC_IDS]);
    expect(run1.qa.metrics.every((m) => m.value.length > 0)).toBe(true);

    // Same-seed byte-stability of the metric set (the item-7 core assertion).
    expect(stableStringify(run1.qa.metrics)).toBe(stableStringify(run2.qa.metrics));

    // Byte-stability extends through every measured surface output (§10).
    expect(stableStringify(run1.qa)).toBe(stableStringify(run2.qa));
    expect(stableStringify(run1.artifact)).toBe(stableStringify(run2.artifact));
    expect(stableStringify(run1.timing)).toBe(stableStringify(run2.timing));
    expect(sha256(run1.wav)).toBe(sha256(run2.wav));

    // Honest status on the canonical fixture (documented alternation finding).
    expect(run1.qa.status).toBe('passed-with-issues');
    expect(run1.qa.issues.some((issue) => issue.code === 'alternation-run-long')).toBe(true);
  }, 120_000);

  test('measure -> detect -> refine -> re-measure: over-budget turn escalated to its unit and resolved by Director re-planning', async () => {
    // --- Iteration 1 (measure): the over-packed mutant turn cannot fit its anchors.
    const measured = await runIteration(buildOverBudgetTurnPlan());
    expect(measured.qa.status).toBe('failed');
    const overBudget = measured.qa.issues.filter((issue) => issue.code === 'turn-over-budget');
    expect(overBudget.length).toBe(1);
    // The error names the smallest regenerable unit (the turn id).
    expect(overBudget[0]?.unitId).toBe('turn-6');
    expect(overBudget[0]?.severity).toBe('error');
    // The text-density metric carries the measured defect count.
    expect(measured.qa.metrics.find((m) => m.metric === 'text_density_fit')?.value).toContain(
      'over-budget turns: 1',
    );

    // --- Refine (plan-space; the issue defers to Director authority):
    // re-plan the same (source, graph, seed) through the Director. P3A's
    // anchor-mass-aware allocation fits every turn's claim load (EV-008).
    const refined = compileOverviewPlan({
      sources: [CANONICAL_SOURCE],
      graph: CANONICAL_GRAPH,
      modality: 'audio',
      targetDurationSeconds: 300,
      seed: LOOP_SEED,
      now: LOOP_NOW,
      planId: 'plan-p3b-loop-refined',
    });

    // --- Iteration 2 (re-compile -> re-measure): the defect is resolved.
    const reMeasured1 = await runIteration(refined);
    expect(reMeasured1.qa.issues.filter((issue) => issue.code === 'turn-over-budget')).toEqual([]);
    expect(reMeasured1.qa.metrics.find((m) => m.metric === 'text_density_fit')?.value).toContain(
      'over-budget turns: 0',
    );
    expect(['passed', 'passed-with-issues']).toContain(reMeasured1.qa.status);

    // The refinement measurably moved the metric set (not a stale re-measure).
    expect(stableStringify(reMeasured1.qa.metrics)).not.toBe(stableStringify(measured.qa.metrics));

    // Same-seed byte-stability holds for the refined iteration too.
    const reMeasured2 = await runIteration(refined);
    expect(stableStringify(reMeasured1.qa.metrics)).toBe(stableStringify(reMeasured2.qa.metrics));
    expect(stableStringify(reMeasured1.qa)).toBe(stableStringify(reMeasured2.qa));
    expect(stableStringify(reMeasured1.artifact)).toBe(stableStringify(reMeasured2.artifact));
    expect(sha256(reMeasured1.wav)).toBe(sha256(reMeasured2.wav));
  }, 240_000);

  test('loop hygiene: sequential iterations in one process do not leak state across runs', async () => {
    const before = await runIteration(CANONICAL_AUDIO_PLAN);
    const fingerprint = {
      metrics: stableStringify(before.qa.metrics),
      report: stableStringify(before.qa),
      wav: sha256(before.wav),
    };

    // A failing iteration in between must not perturb the next measurement
    // (no cross-run compiler state; every iteration is a pure function of
    // (plan, graph, sources, seed, now, provider, backend)).
    await runIteration(buildOverBudgetTurnPlan());

    const after = await runIteration(CANONICAL_AUDIO_PLAN);
    expect(stableStringify(after.qa.metrics)).toBe(fingerprint.metrics);
    expect(stableStringify(after.qa)).toBe(fingerprint.report);
    expect(sha256(after.wav)).toBe(fingerprint.wav);
  }, 180_000);
});
