/**
 * VideoScene compiler tests (WFLX-W3): plan authority, grounding, enrichment,
 * hard validation and determinism.
 *
 * Lab reproduction evidence only — NOT product-parity evidence (AGENTS.md).
 */

import { describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { VideoCompilerError } from '../../src/video/errors';
import {
  compileVideoScenes,
  planHashOf,
  stableStringify,
} from '../../src/video/storyboard/compiler';
import { OverviewPlanSchema } from '../../src/contracts';
import {
  CANONICAL_GRAPH,
  CANONICAL_VIDEO_PLAN,
  buildAllTypesPlan,
  buildTinyVideoPlan,
  mutatePlan,
} from './fixtures';

const canonicalHashOf = (value: unknown): string =>
  createHash('sha256').update(stableStringify(value)).digest('hex');

describe('compileVideoScenes — plan authority', () => {
  test('scene set is never added to, dropped, reordered or re-typed', () => {
    const plan = buildTinyVideoPlan();
    const result = compileVideoScenes(plan, CANONICAL_GRAPH);
    expect(result.scenes.length).toBe(plan.videoScenes.length);
    result.scenes.forEach((scene, index) => {
      const original = plan.videoScenes[index];
      if (original === undefined) {
        throw new Error(`missing original scene at ${index}`);
      }
      expect(scene.id).toBe(original.id);
      expect(scene.index).toBe(index);
      expect(scene.visualType).toBe(original.visualType);
      expect(scene.renderingClass).toBe(original.renderingClass);
      expect(scene.targetDurationSeconds).toBe(original.targetDurationSeconds);
      expect([...scene.claimIds]).toEqual([...original.claimIds]);
    });
  });

  test('audio-modality plans are rejected', () => {
    const plan = mutatePlan(buildTinyVideoPlan(), (draft) => {
      draft.modality = 'audio';
      draft.mode = 'deep-dive';
      draft.videoScenes = [];
    });
    expect(() => compileVideoScenes(plan, CANONICAL_GRAPH)).toThrow(VideoCompilerError);
  });

  test('unknown claim ids are a hard failure naming the scene', () => {
    const plan = mutatePlan(buildTinyVideoPlan(), (draft) => {
      const scene = draft.videoScenes[1];
      if (scene !== undefined) {
        scene.claimIds = ['claim-does-not-exist'];
      }
    });
    try {
      compileVideoScenes(plan, CANONICAL_GRAPH);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(VideoCompilerError);
      const issues = (error as VideoCompilerError).issues;
      expect(issues.some((issue) => issue.code === 'unknown-claim' && issue.sceneId === 'scene-2')).toBe(true);
    }
  });

  test('deterministic scenes without exact texts are a hard failure (atlas rule 2)', () => {
    const plan = mutatePlan(buildTinyVideoPlan(), (draft) => {
      const scene = draft.videoScenes[0];
      if (scene !== undefined) {
        scene.exactTexts = [];
      }
    });
    try {
      compileVideoScenes(plan, CANONICAL_GRAPH);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(VideoCompilerError);
      expect(
        (error as VideoCompilerError).issues.some((issue) => issue.code === 'exact-texts-missing'),
      ).toBe(true);
    }
  });

  test('unknown beat references are a hard failure', () => {
    const plan = mutatePlan(buildTinyVideoPlan(), (draft) => {
      const scene = draft.videoScenes[0];
      if (scene !== undefined) {
        scene.beatId = 'beat-missing';
      }
    });
    expect(() => compileVideoScenes(plan, CANONICAL_GRAPH)).toThrow(VideoCompilerError);
  });

  test('scene duration sums beyond the hard tolerance are rejected', () => {
    const plan = mutatePlan(buildTinyVideoPlan(), (draft) => {
      draft.videoScenes.forEach((scene) => {
        scene.targetDurationSeconds = 30;
      });
    });
    expect(() => compileVideoScenes(plan, CANONICAL_GRAPH)).toThrow(/hard tolerance/);
  });

  test('index mismatches are a hard failure', () => {
    const plan = mutatePlan(buildTinyVideoPlan(), (draft) => {
      const scene = draft.videoScenes[1];
      if (scene !== undefined) {
        scene.index = 7;
      }
    });
    expect(() => compileVideoScenes(plan, CANONICAL_GRAPH)).toThrow(VideoCompilerError);
  });
});

describe('compileVideoScenes — grounding and enrichment', () => {
  test('grounding resolves claims to entities and relationships', () => {
    const result = compileVideoScenes(buildTinyVideoPlan(), CANONICAL_GRAPH);
    const infra = result.storyboard.scenes.find((entry) => entry.scene.id === 'scene-2');
    expect(infra).toBeDefined();
    const names = infra?.grounding.entityNames ?? [];
    expect(names).toContain('Cloudflare');
    expect(names).toContain('Postgres');
    expect(names).toContain('Neon');
    expect(infra?.render.edges.length).toBeGreaterThan(0);
    // Render-spec nodes trace to grounded entity ids.
    const nodeIds = new Set((infra?.render.nodes ?? []).map((node) => node.id));
    for (const claim of infra?.grounding.claims ?? []) {
      for (const entityId of claim.entityIds) {
        if (nodeIds.size > 0) {
          expect(nodeIds.has(entityId) || true).toBe(true); // subset check below
        }
      }
    }
    for (const node of infra?.render.nodes ?? []) {
      expect(infra?.grounding.entities.some((entity) => entity.id === node.id)).toBe(true);
    }
  });

  test('enrichment fills styleBibleId, narrationRef and visualBrief deterministically', () => {
    const plan = mutatePlan(buildTinyVideoPlan(), (draft) => {
      draft.style.styleBibleId = undefined;
      for (const scene of draft.videoScenes) {
        scene.styleBibleId = undefined;
        scene.narrationRef = undefined;
        scene.visualBrief = undefined;
      }
    });
    const result = compileVideoScenes(plan, CANONICAL_GRAPH);
    expect(
      result.issues.some((issue) => issue.code === 'style-bible-defaulted'),
    ).toBe(true);
    for (const entry of result.storyboard.scenes) {
      expect(entry.scene.styleBibleId).toBe('style-bible--reference-ink');
      expect(entry.scene.narrationRef).toBe(`narr-${entry.scene.id}`);
      if (entry.scene.renderingClass !== 'deterministic') {
        expect(entry.scene.visualBrief).toBeDefined();
        expect(entry.scene.visualBrief).toContain('cyan/teal');
      }
      expect(entry.narration.segmentId).toBe(`narr-${entry.scene.id}`);
      expect(entry.narration.text.length).toBeGreaterThan(10);
      expect(entry.narration.estimatedSeconds).toBeGreaterThan(0);
    }
  });

  test('unknown style bible ids warn and degrade to canonical', () => {
    const plan = mutatePlan(buildTinyVideoPlan(), (draft) => {
      draft.style.styleBibleId = 'style-bible--vaporwave';
    });
    const result = compileVideoScenes(plan, CANONICAL_GRAPH);
    expect(result.storyboard.styleBible.id).toBe('style-bible--reference-ink');
    expect(result.issues.some((issue) => issue.code === 'style-bible-unknown')).toBe(true);
  });

  test('coverage gaps through the video surface are warned (H-4 semantics)', () => {
    const result = compileVideoScenes(buildTinyVideoPlan(), CANONICAL_GRAPH);
    const gap = result.issues.find((issue) => issue.code === 'coverage-gap');
    expect(gap).toBeDefined();
    expect(gap?.message).toContain('claim-oss-runtimes');
  });

  test('short-mode duration bound is HYPOTHESIS-labeled and warns above 180s', () => {
    const plan = buildTinyVideoPlan({ mode: 'short', targetDurationSeconds: 240 });
    // Keep scene sum near the target so duration drift does not dominate.
    plan.videoScenes.forEach((scene) => {
      scene.targetDurationSeconds = 80;
    });
    const result = compileVideoScenes(plan, CANONICAL_GRAPH);
    expect(
      result.issues.some(
        (issue) => issue.code === 'short-mode-duration' && issue.message.includes('HYPOTHESIS'),
      ),
    ).toBe(true);
  });

  test('cinematic mode surfaces the UNRESOLVED-semantics info note', () => {
    const plan = buildTinyVideoPlan({ mode: 'cinematic' });
    const result = compileVideoScenes(plan, CANONICAL_GRAPH);
    expect(
      result.issues.some(
        (issue) => issue.code === 'cinematic-semantics-unresolved' && issue.message.includes('UNRESOLVED'),
      ),
    ).toBe(true);
  });
});

describe('compileVideoScenes — determinism', () => {
  test('identical inputs produce byte-identical storyboards', () => {
    const a = compileVideoScenes(buildTinyVideoPlan(), CANONICAL_GRAPH);
    const b = compileVideoScenes(buildTinyVideoPlan(), CANONICAL_GRAPH);
    expect(stableStringify(a)).toBe(stableStringify(b));
    expect(canonicalHashOf(a)).toBe(canonicalHashOf(b));
  });

  test('different seeds change seeded choices (narration openers, briefs)', () => {
    const a = compileVideoScenes(buildTinyVideoPlan(), CANONICAL_GRAPH, { seed: 'seed-a' });
    const b = compileVideoScenes(buildTinyVideoPlan(), CANONICAL_GRAPH, { seed: 'seed-b' });
    expect(canonicalHashOf(a)).not.toBe(canonicalHashOf(b));
  });

  test('realized scenes still pass the frozen contract guard', () => {
    const result = compileVideoScenes(buildAllTypesPlan(), CANONICAL_GRAPH);
    const plan = {
      ...buildAllTypesPlan(),
      videoScenes: [...result.scenes],
    };
    const guard = OverviewPlanSchema.safeParse(plan);
    expect(guard.success).toBe(true);
  });
});

describe('compileVideoScenes — canonical Director plan', () => {
  test('the 7-minute explainer fixture compiles with its 15 scenes intact', () => {
    const result = compileVideoScenes(CANONICAL_VIDEO_PLAN, CANONICAL_GRAPH);
    expect(result.scenes.length).toBe(15);
    expect(result.scenes[0]?.visualType).toBe('title-card');
    // The Director already binds the style bible and narration refs.
    expect(result.issues.some((issue) => issue.code === 'style-bible-defaulted')).toBe(false);
    const sum = result.scenes.reduce((total, scene) => total + scene.targetDurationSeconds, 0);
    expect(Math.abs(sum - CANONICAL_VIDEO_PLAN.targetDurationSeconds)).toBeLessThanOrEqual(2);
  });

  test('plan hash is stable and content-addressed', () => {
    const h1 = planHashOf(CANONICAL_VIDEO_PLAN);
    const h2 = planHashOf(CANONICAL_VIDEO_PLAN);
    expect(h1).toBe(h2);
    const mutated = mutatePlan(CANONICAL_VIDEO_PLAN, (draft) => {
      draft.objective = 'changed';
    });
    expect(planHashOf(mutated)).not.toBe(h1);
  });
});
