/**
 * WFLX-P2 Deliverable B tests — Short (~60 s) format compression invariants.
 *
 * Lab reproduction evidence only — NOT product parity evidence (AGENTS.md).
 */

import { describe, expect, test } from 'bun:test';
import { compileOverviewPlan } from '../../src/director/compiler';
import {
  CANONICAL_GRAPH,
  CANONICAL_SOURCE,
  FIXED_SEED,
  mutatePlan,
} from './fixtures';
import {
  compileShortVideoScenes,
  SHORT_DURATION_BAND,
  renderStoryboardSvg,
} from '../../src/video';
import type { OverviewPlan, VideoScene } from '../../src/contracts';

const NOW = '2026-10-01T00:00:00Z';

function shortPlanAt(target: number, seed = FIXED_SEED): OverviewPlan {
  return compileOverviewPlan({
    sources: [CANONICAL_SOURCE],
    graph: CANONICAL_GRAPH,
    modality: 'video',
    mode: 'short',
    targetDurationSeconds: target,
    seed,
    now: NOW,
    planId: `plan-short-${target}s`,
  });
}

describe('compileShortVideoScenes — mode + input gates', () => {
  test('rejects non-short plans', () => {
    const explainer = compileOverviewPlan({
      sources: [CANONICAL_SOURCE],
      graph: CANONICAL_GRAPH,
      modality: 'video',
      mode: 'explainer',
      targetDurationSeconds: 60,
      seed: FIXED_SEED,
      now: NOW,
    });
    expect(() => compileShortVideoScenes(explainer, CANONICAL_GRAPH)).toThrow(
      /requires mode 'short'/,
    );
  });
});

describe('compileShortVideoScenes — Short format invariants (EXP-V-S-01 falsifiers)', () => {
  test('F1 structure preserved: scene count / ids / types / order identical to the base plan', () => {
    const plan = shortPlanAt(60);
    const { report, plan: adapted } = compileShortVideoScenes(plan, CANONICAL_GRAPH, {
      seed: FIXED_SEED,
    });
    expect(report.structurePreserved).toBe(true);
    expect(report.sceneCount).toBe(report.baseSceneCount);
    expect(adapted.videoScenes.length).toBe(plan.videoScenes.length);
    plan.videoScenes.forEach((scene, i) => {
      const other = adapted.videoScenes[i] as VideoScene;
      expect(other.id).toBe(scene.id);
      expect(other.visualType).toBe(scene.visualType);
      expect(other.index).toBe(scene.index);
    });
    // Skeleton class sequence non-empty and hook-first.
    expect(report.skeletonClasses[0]).toBe('hook');
    expect(report.skeletonClasses).toContain('takeaways');
  });

  test('F2 coverage accounting closed: every graph claim accounted, never a silent drop', () => {
    const plan = shortPlanAt(60);
    const { report } = compileShortVideoScenes(plan, CANONICAL_GRAPH, { seed: FIXED_SEED });
    const accounting = report.coverageAccounting;
    expect(accounting.closed).toBe(true);
    expect(
      accounting.visualized + accounting.coveredNotVisualized + accounting.omitted,
    ).toBe(accounting.totalGraphClaims);
    expect(accounting.totalGraphClaims).toBe(CANONICAL_GRAPH.claims.length);
    // Every disposition carries evidence: visualized -> scene ids, omitted -> reason.
    for (const entry of accounting.entries) {
      if (entry.disposition === 'visualized') expect(entry.sceneIds.length).toBeGreaterThan(0);
      if (entry.disposition === 'omitted') expect(entry.reason).toBeTruthy();
    }
  });

  test('F3 duration within the declared band of the 60 s target', () => {
    for (const target of [60]) {
      const plan = shortPlanAt(target);
      const { report } = compileShortVideoScenes(plan, CANONICAL_GRAPH, { seed: FIXED_SEED });
      expect(report.durationWithinBand).toBe(true);
      expect(report.durationSeconds).toBeGreaterThanOrEqual(SHORT_DURATION_BAND.minSeconds);
      expect(report.durationSeconds).toBeLessThanOrEqual(SHORT_DURATION_BAND.maxSeconds);
      // Total is conserved exactly vs the base plan's scene-second sum.
      const baseTotal = plan.videoScenes.reduce((t, s) => t + s.targetDurationSeconds, 0);
      expect(report.durationSeconds).toBe(Math.round(baseTotal));
    }
  });

  test('F4 determinism: double-run byte-identical (plan + report + SVG set)', () => {
    const plan = shortPlanAt(60);
    const a = compileShortVideoScenes(plan, CANONICAL_GRAPH, { seed: FIXED_SEED });
    const b = compileShortVideoScenes(plan, CANONICAL_GRAPH, { seed: FIXED_SEED });
    expect(JSON.stringify(a.plan)).toBe(JSON.stringify(b.plan));
    expect(JSON.stringify(a.report)).toBe(JSON.stringify(b.report));
    const renderA = renderStoryboardSvg({
      storyboard: a.compiled.storyboard.scenes,
      styleBible: a.compiled.storyboard.styleBible,
    });
    const renderB = renderStoryboardSvg({
      storyboard: b.compiled.storyboard.scenes,
      styleBible: b.compiled.storyboard.styleBible,
    });
    expect(renderA.combinedSha256).toBe(renderB.combinedSha256);
  });

  test('hook prominence: opening-beat share is boosted over the uniform baseline', () => {
    const plan = shortPlanAt(60);
    const { report, plan: adapted } = compileShortVideoScenes(plan, CANONICAL_GRAPH, {
      seed: FIXED_SEED,
    });
    // Compute the unweighted hook share from the base plan.
    const openingBeatId = plan.beats[0]?.id;
    const hookSecondsBase = plan.videoScenes
      .filter((s) => s.beatId === openingBeatId)
      .reduce((t, s) => t + s.targetDurationSeconds, 0);
    const totalBase = plan.videoScenes.reduce((t, s) => t + s.targetDurationSeconds, 0);
    const baseShare = hookSecondsBase / totalBase;
    // Prominence: the hook beat's share strictly grows.
    expect(report.hookShare).toBeGreaterThan(baseShare);
    // Each hook scene is individually prominent: at least the median
    // non-hook scene duration (never a squeezed hook).
    const hookScenes = adapted.videoScenes.filter((s) => s.beatId === openingBeatId);
    expect(hookScenes.length).toBeGreaterThan(0);
    for (const scene of hookScenes) {
      expect(scene.targetDurationSeconds).toBeGreaterThanOrEqual(report.medianSceneSeconds);
    }
    // Sanity bound: the hook never swallows the video.
    expect(report.hookShare).toBeLessThan(0.5);
    // Every scene stays narratable.
    for (const scene of adapted.videoScenes) {
      expect(scene.targetDurationSeconds).toBeGreaterThanOrEqual(3);
    }
  });

  test('scene density scaling at 60 s: fewer claims visualized than a 300 s explainer-scale plan', () => {
    const short = compileShortVideoScenes(shortPlanAt(60), CANONICAL_GRAPH, { seed: FIXED_SEED });
    const long = compileShortVideoScenes(shortPlanAt(300), CANONICAL_GRAPH, { seed: FIXED_SEED });
    expect(short.report.claimsVisualized).toBeLessThan(long.report.claimsVisualized);
  });

  test('depth compression: multi-claim scenes are capped and explicitly flagged, claims stay beat-covered', () => {
    // Force a multi-claim scene: mutate a plan so scene-3 carries 3 claims.
    const base = shortPlanAt(120);
    const multi = mutatePlan(base, (draft) => {
      const scene = draft.videoScenes[2] as VideoScene;
      scene.claimIds = [
        ...scene.claimIds,
        ...CANONICAL_GRAPH.claims.filter((c) => !scene.claimIds.includes(c.id)).slice(0, 2).map((c) => c.id),
      ];
    });
    const { report, plan: adapted } = compileShortVideoScenes(multi, CANONICAL_GRAPH, {
      seed: FIXED_SEED,
    });
    expect(report.depthCompressedScenes.length).toBeGreaterThan(0);
    const compressed = report.depthCompressedScenes[0] as { sceneId: string; removedClaimIds: string[] };
    expect(compressed.removedClaimIds.length).toBeGreaterThan(0);
    // The trimmed scene keeps exactly one claim.
    const trimmedScene = adapted.videoScenes.find((s) => s.id === compressed.sceneId) as VideoScene;
    expect(trimmedScene.claimIds.length).toBe(1);
    // Removed claims remain plan-covered via their beat (never a silent drop):
    // they must show up as covered-not-visualized or stay beat-covered.
    const removed = compressed.removedClaimIds[0] as string;
    const coverageEntry = adapted.coverage.covered.find((c) => c.claimId === removed);
    expect(coverageEntry).toBeDefined();
    expect(coverageEntry?.unitIds.some((u) => u.startsWith('beat-'))).toBe(true);
    expect(coverageEntry?.unitIds.some((u) => u === compressed.sceneId)).toBe(false);
  });

  test('the adapted plan still passes the frozen storyboard compiler invariants', () => {
    const { compiled } = compileShortVideoScenes(shortPlanAt(60), CANONICAL_GRAPH, {
      seed: FIXED_SEED,
    });
    expect(compiled.storyboard.scenes.length).toBeGreaterThan(0);
    // Determinism proof pair renders equal.
    const r1 = renderStoryboardSvg({
      storyboard: compiled.storyboard.scenes,
      styleBible: compiled.storyboard.styleBible,
    });
    const r2 = renderStoryboardSvg({
      storyboard: compiled.storyboard.scenes,
      styleBible: compiled.storyboard.styleBible,
    });
    expect(r1.combinedSha256).toBe(r2.combinedSha256);
  });
});
