/**
 * Deterministic SVG renderer tests (WFLX-W3): byte-identical output, exact
 * texts, palette conformance, illustration embedding, all visual types.
 */

import { describe, expect, test } from 'bun:test';
import { compileVideoScenes } from '../../src/video/storyboard/compiler';
import { renderSceneSvg, renderStoryboardSvg } from '../../src/video/render/renderer';
import { svgContainsText } from '../../src/video/render/svg';
import { REFERENCE_INK_STYLE_BIBLE } from '../../src/video/style-bible';
import { DeterministicInkIllustration } from '../../src/providers/visual/deterministic-ink';
import {
  CANONICAL_GRAPH,
  CANONICAL_VIDEO_PLAN,
  buildAllTypesPlan,
  buildTinyVideoPlan,
} from './fixtures';

const INK = new DeterministicInkIllustration();

async function illustrationsFor(storyboard: ReturnType<typeof compileVideoScenes>['storyboard']) {
  const map = new Map<string, string>();
  for (const entry of storyboard.scenes) {
    if (
      entry.scene.renderingClass === 'generative' ||
      entry.scene.renderingClass === 'hybrid' ||
      entry.render.layoutKind === 'illustration' ||
      entry.render.layoutKind === 'montage'
    ) {
      const result = await INK.illustrate({
        sceneId: entry.scene.id,
        brief: entry.render.illustrationBrief,
        style: {
          background: REFERENCE_INK_STYLE_BIBLE.palette.background.value,
          backgroundDeep: REFERENCE_INK_STYLE_BIBLE.palette.backgroundDeep.value,
          surface: REFERENCE_INK_STYLE_BIBLE.palette.surface.value,
          ink: REFERENCE_INK_STYLE_BIBLE.palette.ink.value,
          emphasis: REFERENCE_INK_STYLE_BIBLE.palette.emphasis.value,
          emphasisDeep: REFERENCE_INK_STYLE_BIBLE.palette.emphasisDeep.value,
          emphasisSoft: REFERENCE_INK_STYLE_BIBLE.palette.emphasisSoft.value,
          warning: REFERENCE_INK_STYLE_BIBLE.palette.warning.value,
          accentWarm: REFERENCE_INK_STYLE_BIBLE.palette.accentWarm.value,
          accentGreen: REFERENCE_INK_STYLE_BIBLE.palette.accentGreen.value,
          aiNode: REFERENCE_INK_STYLE_BIBLE.palette.aiNode.value,
          widthPx: REFERENCE_INK_STYLE_BIBLE.layout.widthPx,
          heightPx: REFERENCE_INK_STYLE_BIBLE.layout.heightPx,
        },
        seed: entry.render.seed,
      });
      map.set(entry.scene.id, result.fragment);
    }
  }
  return map;
}

describe('renderSceneSvg — determinism', () => {
  test('identical inputs produce byte-identical SVG', async () => {
    const compiled = compileVideoScenes(buildAllTypesPlan(), CANONICAL_GRAPH);
    const illustrations = await illustrationsFor(compiled.storyboard);
    for (const entry of compiled.storyboard.scenes) {
      const a = renderSceneSvg({
        spec: entry.render,
        styleBible: compiled.storyboard.styleBible,
        ...(illustrations.has(entry.scene.id)
          ? { illustration: illustrations.get(entry.scene.id) }
          : {}),
      });
      const b = renderSceneSvg({
        spec: entry.render,
        styleBible: compiled.storyboard.styleBible,
        ...(illustrations.has(entry.scene.id)
          ? { illustration: illustrations.get(entry.scene.id) }
          : {}),
      });
      expect(a).toBe(b);
    }
  });

  test('different seeds produce different generative frames', async () => {
    const compiledA = compileVideoScenes(buildAllTypesPlan(), CANONICAL_GRAPH, { seed: 's1' });
    const compiledB = compileVideoScenes(buildAllTypesPlan(), CANONICAL_GRAPH, { seed: 's2' });
    const illustrationsA = await illustrationsFor(compiledA.storyboard);
    const illustrationsB = await illustrationsFor(compiledB.storyboard);
    const hero = compiledA.storyboard.scenes.find((entry) => entry.scene.visualType === 'hero-illustration');
    expect(hero).toBeDefined();
    const a = renderSceneSvg({
      spec: hero?.render as never,
      styleBible: compiledA.storyboard.styleBible,
      illustration: illustrationsA.get(hero?.scene.id ?? ''),
    });
    const heroB = compiledB.storyboard.scenes.find(
      (entry) => entry.scene.visualType === 'hero-illustration',
    );
    const b = renderSceneSvg({
      spec: heroB?.render as never,
      styleBible: compiledB.storyboard.styleBible,
      illustration: illustrationsB.get(heroB?.scene.id ?? ''),
    });
    expect(a).not.toBe(b);
  });
});

describe('renderSceneSvg — exact texts and grounding', () => {
  test('every exact text of deterministic/hybrid scenes appears in the frame', async () => {
    const compiled = compileVideoScenes(buildTinyVideoPlan(), CANONICAL_GRAPH);
    const illustrations = await illustrationsFor(compiled.storyboard);
    for (const entry of compiled.storyboard.scenes) {
      const svg = renderSceneSvg({
        spec: entry.render,
        styleBible: compiled.storyboard.styleBible,
        ...(illustrations.has(entry.scene.id)
          ? { illustration: illustrations.get(entry.scene.id) }
          : {}),
      });
      for (const item of entry.scene.exactTexts.filter((text) => text.exact)) {
        expect(svgContainsText(svg, item.value)).toBe(true);
      }
    }
  });

  test('diagram nodes trace to grounded entities', async () => {
    const compiled = compileVideoScenes(buildTinyVideoPlan(), CANONICAL_GRAPH);
    const infra = compiled.storyboard.scenes.find((entry) => entry.scene.id === 'scene-2');
    const svg = renderSceneSvg({
      spec: infra?.render as never,
      styleBible: compiled.storyboard.styleBible,
    });
    for (const node of infra?.render.nodes ?? []) {
      if (['Cloudflare', 'Postgres', 'Neon'].includes(node.label)) {
        expect(svg).toContain(node.label);
      }
    }
  });

  test('all thirteen visual types render non-trivial frames', async () => {
    const compiled = compileVideoScenes(buildAllTypesPlan(), CANONICAL_GRAPH);
    const illustrations = await illustrationsFor(compiled.storyboard);
    const types = new Set<string>();
    for (const entry of compiled.storyboard.scenes) {
      const svg = renderSceneSvg({
        spec: entry.render,
        styleBible: compiled.storyboard.styleBible,
        ...(illustrations.has(entry.scene.id)
          ? { illustration: illustrations.get(entry.scene.id) }
          : {}),
      });
      expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
      expect(svg).toContain(`width="${REFERENCE_INK_STYLE_BIBLE.layout.widthPx}"`);
      expect(svg.length).toBeGreaterThan(600);
      types.add(entry.scene.visualType);
    }
    expect(types.size).toBe(13);
  });

  test('generative frames embed the illustration fragment', async () => {
    const compiled = compileVideoScenes(buildTinyVideoPlan(), CANONICAL_GRAPH);
    const illustrations = await illustrationsFor(compiled.storyboard);
    const metaphor = compiled.storyboard.scenes.find(
      (entry) => entry.scene.visualType === 'metaphor-illustration',
    );
    const svg = renderSceneSvg({
      spec: metaphor?.render as never,
      styleBible: compiled.storyboard.styleBible,
      illustration: illustrations.get(metaphor?.scene.id ?? ''),
    });
    const fragment = illustrations.get(metaphor?.scene.id ?? '') ?? '';
    // The fragment's construction lines are present in the composed frame.
    expect(svg).toContain(fragment.slice(0, 60));
    // Illustrations carry no text elements (StyleBible rule 1).
    expect(fragment).not.toContain('<text');
  });
});

describe('renderStoryboardSvg — combined determinism proof', () => {
  test('full storyboard renders byte-identically with a stable combined hash', async () => {
    const compiled = compileVideoScenes(CANONICAL_VIDEO_PLAN, CANONICAL_GRAPH);
    const illustrations = await illustrationsFor(compiled.storyboard);
    const a = renderStoryboardSvg({
      storyboard: compiled.storyboard.scenes,
      styleBible: compiled.storyboard.styleBible,
      illustrations,
    });
    const b = renderStoryboardSvg({
      storyboard: compiled.storyboard.scenes,
      styleBible: compiled.storyboard.styleBible,
      illustrations,
    });
    expect(a.frames.size).toBe(15);
    expect(a.combinedSha256).toBe(b.combinedSha256);
    expect(a.combinedSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(a.renderBytes).toBeGreaterThan(10_000);
    // Traces verify placement.
    const titleTrace = a.traces.find((trace) => trace.sceneId === 'scene-1');
    expect(titleTrace?.exactTextsPlaced).toContain('A Messy Note, Mapped');
  });

  test('frame SVGs contain only StyleBible palette colors', async () => {
    const compiled = compileVideoScenes(buildAllTypesPlan(), CANONICAL_GRAPH);
    const illustrations = await illustrationsFor(compiled.storyboard);
    const result = renderStoryboardSvg({
      storyboard: compiled.storyboard.scenes,
      styleBible: compiled.storyboard.styleBible,
      illustrations,
    });
    const allowed = new Set(
      Object.values(REFERENCE_INK_STYLE_BIBLE.palette).map((role) => role.value),
    );
    for (const trace of result.traces) {
      for (const color of trace.colorsUsed) {
        expect(allowed.has(color)).toBe(true);
      }
    }
  });
});
