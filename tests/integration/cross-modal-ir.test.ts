/**
 * Cross-modal IR compliance test (WFLX-P3B wave 1 — Phase 3 checklist §2
 * item 1; work order Phase 3 "integrate W2 and W3 against frozen IR").
 *
 * One frozen fixture source (reference-messy-note) is compiled through BOTH
 * surfaces: the Director emits an audio-modality plan and a video-modality
 * plan from the same (source, graph, seed), the audio pipeline and the video
 * pipeline each consume their plan, and shared-IR compliance is asserted:
 *
 *   1. same editorial spine — identical accounted/covered claim sets across
 *      modalities for identical (seed, targetDurationSeconds);
 *   2. grounding by the same claim ids — every turn/scene/beat/coverage
 *      claim id resolves in the SAME SemanticGraph, and the canonical frozen
 *      fixtures' turn-cited and scene-cited claim sets are EQUAL;
 *   3. no per-surface mutation — each pipeline leaves its plan instance
 *      deep-equal to the pre-run frozen clone (the plan is the shared IR;
 *      surfaces realize it, they never rewrite it).
 *
 * CONTRACT FINDING (OBSERVED, recorded as a HANDOFF for TL adjudication):
 * the frozen v1 OverviewPlan is modality-exclusive by construction
 * (audio plans REQUIRE audioTurns and MUST NOT carry videoScenes; video
 * plans the inverse — src/contracts/overview-plan.ts cross-field checks;
 * both surfaces hard-reject the wrong modality). A single plan INSTANCE
 * therefore cannot be consumed by both pipelines under the frozen contract;
 * the checklist §2 "SAME frozen OverviewPlan instance" wording is satisfied
 * here at the shared-spine level instead (same source, same seed, same claim
 * universe, same coverage accounting). See the last test in this file.
 *
 * Lab reproduction evidence only — NOT product-parity evidence (AGENTS.md).
 */

import { describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compileOverviewPlan } from '../../src/director/compiler';
import { OverviewPlanSchema, validateOverviewPlan } from '../../src/contracts';
import { compileAudioOverview, AudioCompilerError, stableStringify } from '../../src/audio';
import { compileVideoOverview, VideoCompilerError, findHeadlessBrowser } from '../../src/video';
import {
  accountedClaimIds,
  CANONICAL_AUDIO_PLAN,
  CANONICAL_GRAPH,
  CANONICAL_SOURCE,
  CANONICAL_VIDEO_PLAN,
  coveredClaimIds,
  deepClone,
  INTEGRATION_NOW,
  INTEGRATION_SEED,
  sceneCitedClaimIds,
  turnCitedClaimIds,
} from './fixtures';

/** Healthy audio duration for the canonical graph (EV-008 boundary: >= 120 s). */
const AUDIO_TARGET_SECONDS = 180;

/** Video duration whose Director scene allocation lands on-target (60 s). */
const VIDEO_TARGET_SECONDS = 60;

const claimUniverse = () => new Set(CANONICAL_GRAPH.claims.map((c) => c.id));

describe('cross-modal IR compliance (Phase 3 checklist §2 item 1)', () => {
  test('one fixture source + one seed: Director compiles both modalities onto the same claim spine', () => {
    const audioPlan = compileOverviewPlan({
      sources: [CANONICAL_SOURCE],
      graph: CANONICAL_GRAPH,
      modality: 'audio',
      targetDurationSeconds: AUDIO_TARGET_SECONDS,
      seed: INTEGRATION_SEED,
      now: INTEGRATION_NOW,
      planId: 'plan-p3b-audio-180s',
    });
    const videoPlan = compileOverviewPlan({
      sources: [CANONICAL_SOURCE],
      graph: CANONICAL_GRAPH,
      modality: 'video',
      targetDurationSeconds: AUDIO_TARGET_SECONDS,
      seed: INTEGRATION_SEED,
      now: INTEGRATION_NOW,
      planId: 'plan-p3b-video-180s',
    });

    // Both plans pass the frozen guard and W1 deep validation.
    expect(OverviewPlanSchema.safeParse(audioPlan).success).toBe(true);
    expect(OverviewPlanSchema.safeParse(videoPlan).success).toBe(true);
    expect(validateOverviewPlan(audioPlan, CANONICAL_GRAPH, [CANONICAL_SOURCE]).valid).toBe(true);
    expect(validateOverviewPlan(videoPlan, CANONICAL_GRAPH, [CANONICAL_SOURCE]).valid).toBe(true);

    // Shared editorial spine over the one fixture source.
    expect(audioPlan.sourceIds).toEqual(videoPlan.sourceIds);
    expect(audioPlan.sourceIds).toEqual([...CANONICAL_GRAPH.sourceIds]);
    expect(accountedClaimIds(audioPlan)).toEqual(accountedClaimIds(videoPlan));
    expect(coveredClaimIds(audioPlan)).toEqual(coveredClaimIds(videoPlan));

    // Grounding: every claim id anywhere in either plan resolves in the SAME graph.
    const universe = claimUniverse();
    const allCited = [
      ...turnCitedClaimIds(audioPlan),
      ...sceneCitedClaimIds(videoPlan),
      ...audioPlan.beats.flatMap((b) => b.claimIds),
      ...videoPlan.beats.flatMap((b) => b.claimIds),
    ];
    expect(allCited.every((id) => universe.has(id))).toBe(true);

    // Director invariant (EV-008): every covered claim is voiced by a turn.
    const covered = coveredClaimIds(audioPlan);
    expect(turnCitedClaimIds(audioPlan)).toEqual(expect.arrayContaining(covered));

    // Shared voiced/visualized core across modalities (observed: 6 of 7 at 180 s).
    const shared = turnCitedClaimIds(audioPlan).filter((id) =>
      sceneCitedClaimIds(videoPlan).includes(id),
    );
    expect(shared.length).toBeGreaterThanOrEqual(3);
  });

  test('no per-surface mutation: the audio pipeline leaves its plan instance deep-equal', async () => {
    const plan = compileOverviewPlan({
      sources: [CANONICAL_SOURCE],
      graph: CANONICAL_GRAPH,
      modality: 'audio',
      targetDurationSeconds: AUDIO_TARGET_SECONDS,
      seed: INTEGRATION_SEED,
      now: INTEGRATION_NOW,
      planId: 'plan-p3b-audio-180s',
    });
    const frozen = deepClone(plan);

    const result = await compileAudioOverview({
      plan,
      graph: CANONICAL_GRAPH,
      sources: CANONICAL_SOURCE,
      options: { seed: INTEGRATION_SEED, now: INTEGRATION_NOW, mastering: 'pure-ts' },
    });

    // The compiler passes the SAME instance through (no silent re-wrap).
    expect(result.plan).toBe(plan);
    // Structure and canonical serialization are unchanged after the run.
    expect(plan).toEqual(frozen);
    expect(stableStringify(plan)).toBe(stableStringify(frozen));
  }, 120_000);

  test('no per-surface mutation: the video pipeline leaves its plan instance deep-equal', async () => {
    const plan = compileOverviewPlan({
      sources: [CANONICAL_SOURCE],
      graph: CANONICAL_GRAPH,
      modality: 'video',
      targetDurationSeconds: VIDEO_TARGET_SECONDS,
      seed: INTEGRATION_SEED,
      now: INTEGRATION_NOW,
      planId: 'plan-p3b-video-60s',
    });
    const frozen = deepClone(plan);

    const browser = findHeadlessBrowser();
    const workDir = mkdtempSync(join(tmpdir(), 'wflx-p3b-crossmodal-'));
    try {
      const result = await compileVideoOverview(plan, CANONICAL_GRAPH, {
        output: join(workDir, 'overview.mp4'),
        now: INTEGRATION_NOW,
        seed: INTEGRATION_SEED,
        ...(browser !== null
          ? { backend: 'remotion' as const, browserExecutable: browser }
          : { backend: 'fallback' as const }),
        workDir,
      });

      // Structure and canonical serialization are unchanged after the run.
      expect(plan).toEqual(frozen);
      expect(stableStringify(plan)).toBe(stableStringify(frozen));
      // The scene-SVG determinism proof rides along (same in-process render pair).
      expect(result.determinismProof.hashB).toBe(result.determinismProof.hashA);
    } finally {
      rmSync(workDir, { recursive: true, force: true });
    }
  }, 360_000);

  test('frozen canonical fixtures: audio and video plans ground on the same claim universe', () => {
    const universe = claimUniverse();

    // Both frozen W1 plans are valid against the one fixture source.
    expect(OverviewPlanSchema.safeParse(CANONICAL_AUDIO_PLAN).success).toBe(true);
    expect(OverviewPlanSchema.safeParse(CANONICAL_VIDEO_PLAN).success).toBe(true);
    expect(validateOverviewPlan(CANONICAL_AUDIO_PLAN, CANONICAL_GRAPH, [CANONICAL_SOURCE]).valid).toBe(true);
    expect(validateOverviewPlan(CANONICAL_VIDEO_PLAN, CANONICAL_GRAPH, [CANONICAL_SOURCE]).valid).toBe(true);

    // Shared spine: identical accounting and coverage over the same source.
    expect(CANONICAL_AUDIO_PLAN.sourceIds).toEqual(CANONICAL_VIDEO_PLAN.sourceIds);
    expect(accountedClaimIds(CANONICAL_AUDIO_PLAN)).toEqual(accountedClaimIds(CANONICAL_VIDEO_PLAN));
    expect(coveredClaimIds(CANONICAL_AUDIO_PLAN)).toEqual(coveredClaimIds(CANONICAL_VIDEO_PLAN));

    // Grounding by the same claim ids: turn-cited and scene-cited sets are
    // EQUAL (observed: all 11 canonical claims voiced AND visualized).
    const turnCited = turnCitedClaimIds(CANONICAL_AUDIO_PLAN);
    const sceneCited = sceneCitedClaimIds(CANONICAL_VIDEO_PLAN);
    expect(turnCited.every((id) => universe.has(id))).toBe(true);
    expect(sceneCited.every((id) => universe.has(id))).toBe(true);
    expect(turnCited).toEqual(sceneCited);
    expect(turnCited).toEqual(coveredClaimIds(CANONICAL_AUDIO_PLAN));
  });

  test('OBSERVED contract mismatch: one plan instance cannot serve both surfaces (frozen v1 modality exclusivity)', async () => {
    // The frozen contract makes plans modality-exclusive; each surface
    // hard-rejects the other modality with a typed error. This documents the
    // gap between the checklist §2 wording ("SAME frozen OverviewPlan
    // instance") and the frozen v1 contract — HANDOFF for TL adjudication,
    // not a defect to paper over: the shared-IR compliance above is the
    // substantive assertion the architecture cares about.
    const audioPlan = compileOverviewPlan({
      sources: [CANONICAL_SOURCE],
      graph: CANONICAL_GRAPH,
      modality: 'audio',
      targetDurationSeconds: AUDIO_TARGET_SECONDS,
      seed: INTEGRATION_SEED,
      now: INTEGRATION_NOW,
      planId: 'plan-p3b-audio-180s',
    });
    const videoPlan = compileOverviewPlan({
      sources: [CANONICAL_SOURCE],
      graph: CANONICAL_GRAPH,
      modality: 'video',
      targetDurationSeconds: VIDEO_TARGET_SECONDS,
      seed: INTEGRATION_SEED,
      now: INTEGRATION_NOW,
      planId: 'plan-p3b-video-60s',
    });

    let audioRejection: unknown;
    try {
      await compileAudioOverview({
        plan: videoPlan,
        graph: CANONICAL_GRAPH,
        sources: CANONICAL_SOURCE,
        options: { seed: INTEGRATION_SEED, now: INTEGRATION_NOW, mastering: 'pure-ts' },
      });
    } catch (error) {
      audioRejection = error;
    }
    expect(audioRejection).toBeInstanceOf(AudioCompilerError);
    expect((audioRejection as AudioCompilerError).message).toContain('audio-modality plan');

    let videoRejection: unknown;
    try {
      await compileVideoOverview(audioPlan, CANONICAL_GRAPH, {
        output: '/tmp/wflx-p3b-never.mp4',
        now: INTEGRATION_NOW,
        seed: INTEGRATION_SEED,
        backend: 'fallback',
      });
    } catch (error) {
      videoRejection = error;
    }
    expect(videoRejection).toBeInstanceOf(VideoCompilerError);
    expect((videoRejection as VideoCompilerError).message).toContain('video-modality plan');
  });
});
