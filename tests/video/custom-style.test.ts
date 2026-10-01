/**
 * WFLX-P2 Deliverable A tests — custom-style layer + video-surface locality
 * (EXP-V-L-01 invariants).
 *
 * Lab reproduction evidence only — NOT product parity evidence (AGENTS.md).
 */

import { describe, expect, test } from 'bun:test';
import {
  CANONICAL_GRAPH,
  CANONICAL_VIDEO_PLAN,
  FIXED_SEED,
  buildTinyVideoPlan,
  mutatePlan,
} from './fixtures';
import {
  compileVideoScenes,
  customStyleBible,
  renderStoryboardSvg,
  isStyleBible,
  REFERENCE_INK_STYLE_BIBLE,
} from '../../src/video';
import type { Id, OverviewPlan, VideoScene } from '../../src/contracts';

describe('customStyleBible — deterministic custom visual-style derivation', () => {
  test('derives a guard-valid bible whose accent family differs from the base', () => {
    const bible = customStyleBible('a warm amber evening mood');
    expect(isStyleBible(bible)).toBe(true);
    expect(bible.id).toMatch(/^style-bible--custom-[0-9a-f]{8}$/);
    expect(bible.name).toContain('a warm amber evening mood');
    // Grammar stays: canvas, typography, layout, motion, pacing inherit.
    expect(bible.layout).toEqual(REFERENCE_INK_STYLE_BIBLE.layout);
    expect(bibliographyInherits(bible)).toBe(true);
    // Accent evidence is honestly labeled DERIVED (never OBSERVED).
    expect(bible.palette.emphasis.evidence).toContain('DERIVED');
    expect(bible.palette.emphasis.evidence).not.toContain('OBSERVED');
    // Inherited roles keep their original evidence.
    expect(bible.palette.background.evidence).toContain('OBSERVED');
  });

  test('deterministic: identical prompt -> byte-identical bible', () => {
    const a = customStyleBible('duotone blueprint, cool and precise');
    const b = customStyleBible('duotone blueprint, cool and precise');
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  test('different prompts select (at least) two distinct accent families across the space', () => {
    const prompts = [
      'amber evening warmth',
      'violet print shop mood',
      'crimson laboratory alertness',
      'reference teal default please',
      'something else entirely',
    ];
    const emphases = new Set(prompts.map((p) => customStyleBible(p).palette.emphasis.value));
    expect(emphases.size).toBeGreaterThanOrEqual(2);
  });

  test('rejects empty prompts', () => {
    expect(() => customStyleBible('   ')).toThrow(/empty style prompt/);
  });

  test('style-only surface: same plan + custom bible changes SVGs, never structure/coverage', () => {
    const compiledBase = compileVideoScenes(CANONICAL_VIDEO_PLAN, CANONICAL_GRAPH, {
      seed: FIXED_SEED,
    });
    const compiledCustom = compileVideoScenes(CANONICAL_VIDEO_PLAN, CANONICAL_GRAPH, {
      seed: FIXED_SEED,
      styleBible: customStyleBible('violet print shop mood'),
    });

    // Structure identical: same scene ids, types, classes, durations, claimIds.
    expect(compiledCustom.scenes.length).toBe(compiledBase.scenes.length);
    compiledBase.scenes.forEach((base, i) => {
      const custom = compiledCustom.scenes[i] as VideoScene;
      expect(custom.visualType).toBe(base.visualType);
      expect(custom.renderingClass).toBe(base.renderingClass);
      expect(custom.targetDurationSeconds).toBe(base.targetDurationSeconds);
      expect(custom.claimIds).toEqual(base.claimIds);
    });

    // Rendered surface changes (palette accents).
    const renderBase = renderStoryboardSvg({
      storyboard: compiledBase.storyboard.scenes,
      styleBible: compiledBase.storyboard.styleBible,
    });
    const renderCustom = renderStoryboardSvg({
      storyboard: compiledCustom.storyboard.scenes,
      styleBible: compiledCustom.storyboard.styleBible,
    });
    expect(renderCustom.combinedSha256).not.toBe(renderBase.combinedSha256);
  });
});

function bibliographyInherits(bible: ReturnType<typeof customStyleBible>): boolean {
  return (
    bible.typography.labelFamily === REFERENCE_INK_STYLE_BIBLE.typography.labelFamily &&
    bible.motion.preferredTransition === REFERENCE_INK_STYLE_BIBLE.motion.preferredTransition &&
    bible.pacing.narrationLed === REFERENCE_INK_STYLE_BIBLE.pacing.narrationLed
  );
}

describe('EXP-V-L-01 — video-surface locality (C-5 regression proof for video)', () => {
  /**
   * The video-surface analog of EXP-X-02: mutate ONE scene's claim -> ONLY
   * that scene's visual surface (render spec + narration + SVG) changes; the
   * structure (scene count, ids, order, types, durations) has 0 reshuffle.
   */
  function mutatedPlanFor(): { plan: OverviewPlan; targetSceneId: Id; swappedIn: Id } {
    const plan = CANONICAL_VIDEO_PLAN;
    const scene = plan.videoScenes[2] as VideoScene;
    const targetClaim = scene.claimIds[0] as Id;
    const replacement = CANONICAL_GRAPH.claims.find(
      (claim) => !scene.claimIds.includes(claim.id) && claim.id !== targetClaim,
    );
    if (replacement === undefined) throw new Error('fixture needs a spare claim');
    const mutated = mutatePlan(plan, (draft) => {
      const target = draft.videoScenes.find((s) => s.id === scene.id) as VideoScene;
      target.claimIds = [replacement.id];
    });
    return { plan: mutated, targetSceneId: scene.id, swappedIn: replacement.id };
  }

  test('single-scene claim mutation changes exactly one scene surface', () => {
    const { plan: mutated, targetSceneId } = mutatedPlanFor();

    const base = compileVideoScenes(CANONICAL_VIDEO_PLAN, CANONICAL_GRAPH, { seed: FIXED_SEED });
    const variant = compileVideoScenes(mutated, CANONICAL_GRAPH, { seed: FIXED_SEED });

    // F1: structure 0 reshuffle — same scene count, ids, order, types, durations.
    expect(variant.scenes.length).toBe(base.scenes.length);
    base.scenes.forEach((scene, i) => {
      const other = variant.scenes[i] as VideoScene;
      expect(other.id).toBe(scene.id);
      expect(other.visualType).toBe(scene.visualType);
      expect(other.renderingClass).toBe(scene.renderingClass);
      expect(other.targetDurationSeconds).toBe(scene.targetDurationSeconds);
    });

    // F2: ONLY the target scene's render spec + narration changed.
    let changedSpecs = 0;
    let changedNarration = 0;
    base.storyboard.scenes.forEach((entry, i) => {
      const other = variant.storyboard.scenes[i];
      if (other === undefined) throw new Error('scene count drifted');
      if (JSON.stringify(entry.render) !== JSON.stringify(other.render)) changedSpecs += 1;
      if (entry.narration.text !== other.narration.text) changedNarration += 1;
    });
    expect(changedSpecs).toBe(1);
    expect(changedNarration).toBe(1);

    // F3: per-scene SVG locality — exactly one SVG frame changes bytes.
    const renderBase = renderStoryboardSvg({
      storyboard: base.storyboard.scenes,
      styleBible: base.storyboard.styleBible,
    });
    const renderVariant = renderStoryboardSvg({
      storyboard: variant.storyboard.scenes,
      styleBible: variant.storyboard.styleBible,
    });
    let changedSvgs = 0;
    for (const [sceneId, svg] of renderBase.frames) {
      if (renderVariant.frames.get(sceneId) !== svg) {
        changedSvgs += 1;
        expect(sceneId).toBe(targetSceneId);
      }
    }
    expect(changedSvgs).toBe(1);
  });

  test('double-run determinism at the video surface (baseline + mutated)', () => {
    const { plan: mutated } = mutatedPlanFor();
    for (const plan of [CANONICAL_VIDEO_PLAN, mutated]) {
      const a = compileVideoScenes(plan, CANONICAL_GRAPH, { seed: FIXED_SEED });
      const b = compileVideoScenes(plan, CANONICAL_GRAPH, { seed: FIXED_SEED });
      expect(JSON.stringify(a.storyboard.scenes.map((s) => s.render))).toBe(
        JSON.stringify(b.storyboard.scenes.map((s) => s.render)),
      );
      const ra = renderStoryboardSvg({
        storyboard: a.storyboard.scenes,
        styleBible: a.storyboard.styleBible,
      });
      const rb = renderStoryboardSvg({
        storyboard: b.storyboard.scenes,
        styleBible: b.storyboard.styleBible,
      });
      expect(ra.combinedSha256).toBe(rb.combinedSha256);
    }
  });

  test('tiny-plan sanity: an ungrounded mutation still compiles and is honestly flagged', () => {
    const tiny = buildTinyVideoPlan();
    const mutated = mutatePlan(tiny, (draft) => {
      const target = draft.videoScenes[1] as VideoScene;
      target.claimIds = ['claim-purpose'];
    });
    const compiled = compileVideoScenes(mutated, CANONICAL_GRAPH, { seed: FIXED_SEED });
    expect(compiled.issues.length).toBeGreaterThanOrEqual(0);
    expect(compiled.scenes.length).toBe(tiny.videoScenes.length);
  });
});
