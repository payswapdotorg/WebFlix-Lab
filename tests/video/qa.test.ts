/**
 * Video QA tests (WFLX-W3): the deterministic metric set fires on mutations
 * and passes on the honest pipeline output.
 */

import { describe, expect, test } from 'bun:test';
import { runVideoQa } from '../../src/video/qa/metrics';
import { toQaSummary } from '../../src/video/qa/report';
import { compileVideoScenes } from '../../src/video/storyboard/compiler';
import { renderStoryboardSvg } from '../../src/video/render/renderer';
import { buildTimeline } from '../../src/compositor/timeline';
import { CANONICAL_GRAPH, buildTinyVideoPlan } from './fixtures';

function assembled(seed = 'wflx-w3-test-seed') {
  const plan = buildTinyVideoPlan();
  plan.generator.seed = seed;
  const compiled = compileVideoScenes(plan, CANONICAL_GRAPH);
  const render = renderStoryboardSvg({
    storyboard: compiled.storyboard.scenes,
    styleBible: compiled.storyboard.styleBible,
    illustrations: new Map(),
  });
  const timeline = buildTimeline(compiled.scenes, { fps: 30 });
  const narrationTimings = timeline.entries.map((entry) => ({
    segmentId: `narr-${entry.sceneId}`,
    sceneId: entry.sceneId,
    startSeconds: entry.startSeconds,
  }));
  return { compiled, render, timeline, narrationTimings };
}

describe('video QA — happy path', () => {
  test('all six metrics run; alignment is exact by construction', () => {
    const ctx = assembled();
    const report = runVideoQa({
      storyboard: ctx.compiled.storyboard,
      renderTraces: ctx.render.traces,
      timeline: ctx.timeline,
      narrationTimings: ctx.narrationTimings,
      styleBible: ctx.compiled.storyboard.styleBible,
      determinismHashA: ctx.render.combinedSha256,
      determinismHashB: ctx.render.combinedSha256,
    });
    const ids = report.metrics.map((metric) => metric.metric);
    expect(ids).toEqual([
      'scene_narration_alignment',
      'style_consistency',
      'visual_grounding',
      'determinism',
      'scene_structure',
      'coverage_surface',
    ]);
    const alignment = report.metrics[0];
    expect(alignment?.value).toContain('mean 0.000s / max 0.000s');
    // Tiny plan has known coverage gaps (covered claims not visualized).
    expect(report.status).toBe('passed-with-issues');
    expect(report.metrics[5]?.issues.some((issue) => issue.code === 'coverage-gap')).toBe(true);
    // QaSummary projection is contract-shaped.
    const summary = toQaSummary(report);
    expect(summary.status).toBe('passed-with-issues');
    expect(summary.issues.every((issue) => typeof issue.code === 'string')).toBe(true);
  });
});

describe('video QA — mutation sensitivity (one rule broken per mutant)', () => {
  test('narration-alignment-drift fires when segments shift', () => {
    const ctx = assembled();
    const shifted = ctx.narrationTimings.map((timing, index) => ({
      ...timing,
      startSeconds: timing.startSeconds + (index === 1 ? 0.8 : 0),
    }));
    const report = runVideoQa({
      storyboard: ctx.compiled.storyboard,
      renderTraces: ctx.render.traces,
      timeline: ctx.timeline,
      narrationTimings: shifted,
      styleBible: ctx.compiled.storyboard.styleBible,
      determinismHashA: ctx.render.combinedSha256,
    });
    expect(
      report.issues.some((issue) => issue.code === 'narration-alignment-drift' && issue.unitId === 'scene-2'),
    ).toBe(true);
  });

  test('narration-segment-missing fires for absent segments', () => {
    const ctx = assembled();
    const report = runVideoQa({
      storyboard: ctx.compiled.storyboard,
      renderTraces: ctx.render.traces,
      timeline: ctx.timeline,
      narrationTimings: ctx.narrationTimings.slice(0, 1),
      styleBible: ctx.compiled.storyboard.styleBible,
      determinismHashA: ctx.render.combinedSha256,
    });
    expect(report.issues.some((issue) => issue.code === 'narration-segment-missing')).toBe(true);
  });

  test('palette-violation fires on off-style colors', () => {
    const ctx = assembled();
    const poisoned = ctx.render.traces.map((trace, index) =>
      index === 1 ? { ...trace, colorsUsed: [...trace.colorsUsed, '#ff00ff'] } : trace,
    );
    const report = runVideoQa({
      storyboard: ctx.compiled.storyboard,
      renderTraces: poisoned,
      timeline: ctx.timeline,
      narrationTimings: ctx.narrationTimings,
      styleBible: ctx.compiled.storyboard.styleBible,
      determinismHashA: ctx.render.combinedSha256,
    });
    expect(
      report.issues.some(
        (issue) => issue.code === 'palette-violation' && issue.message.includes('#ff00ff'),
      ),
    ).toBe(true);
    expect(report.status).toBe('failed');
  });

  test('font-violation fires on off-style fonts', () => {
    const ctx = assembled();
    const poisoned = ctx.render.traces.map((trace, index) =>
      index === 0 ? { ...trace, fontsUsed: [...trace.fontsUsed, 'Comic Sans MS'] } : trace,
    );
    const report = runVideoQa({
      storyboard: ctx.compiled.storyboard,
      renderTraces: poisoned,
      timeline: ctx.timeline,
      narrationTimings: ctx.narrationTimings,
      styleBible: ctx.compiled.storyboard.styleBible,
      determinismHashA: ctx.render.combinedSha256,
    });
    expect(report.issues.some((issue) => issue.code === 'font-violation')).toBe(true);
  });

  test('exact-text-missing fires when a required text is not placed', () => {
    const ctx = assembled();
    const poisoned = ctx.render.traces.map((trace, index) =>
      index === 1 ? { ...trace, exactTextsPlaced: [] } : trace,
    );
    const report = runVideoQa({
      storyboard: ctx.compiled.storyboard,
      renderTraces: poisoned,
      timeline: ctx.timeline,
      narrationTimings: ctx.narrationTimings,
      styleBible: ctx.compiled.storyboard.styleBible,
      determinismHashA: ctx.render.combinedSha256,
    });
    expect(report.issues.some((issue) => issue.code === 'exact-text-missing')).toBe(true);
  });

  test('determinism-violation is a blocker on hash mismatch', () => {
    const ctx = assembled();
    const report = runVideoQa({
      storyboard: ctx.compiled.storyboard,
      renderTraces: ctx.render.traces,
      timeline: ctx.timeline,
      narrationTimings: ctx.narrationTimings,
      styleBible: ctx.compiled.storyboard.styleBible,
      determinismHashA: ctx.render.combinedSha256,
      determinismHashB: '0'.repeat(64),
    });
    expect(report.issues.some((issue) => issue.code === 'determinism-violation')).toBe(true);
    expect(report.issueCounts.blocker).toBe(1);
    expect(report.status).toBe('failed');
  });

  test('timeline-gap fires on a broken timeline', () => {
    const ctx = assembled();
    const broken = {
      ...ctx.timeline,
      entries: ctx.timeline.entries.map((entry, index) =>
        index === 1 ? { ...entry, startSeconds: entry.startSeconds + 1 } : entry,
      ),
    };
    const report = runVideoQa({
      storyboard: ctx.compiled.storyboard,
      renderTraces: ctx.render.traces,
      timeline: broken,
      narrationTimings: ctx.narrationTimings,
      styleBible: ctx.compiled.storyboard.styleBible,
      determinismHashA: ctx.render.combinedSha256,
    });
    expect(report.issues.some((issue) => issue.code === 'timeline-gap')).toBe(true);
  });

  test('ungrounded-scene fires when a scene loses its claims', () => {
    const ctx = assembled();
    const storyboard = {
      ...ctx.compiled.storyboard,
      scenes: ctx.compiled.storyboard.scenes.map((entry, index) =>
        index === 2 ? { ...entry, scene: { ...entry.scene, claimIds: [] } } : entry,
      ),
    };
    const report = runVideoQa({
      storyboard,
      renderTraces: ctx.render.traces,
      timeline: ctx.timeline,
      narrationTimings: ctx.narrationTimings,
      styleBible: ctx.compiled.storyboard.styleBible,
      determinismHashA: ctx.render.combinedSha256,
    });
    expect(report.issues.some((issue) => issue.code === 'ungrounded-scene')).toBe(true);
  });
});
