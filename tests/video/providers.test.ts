/**
 * Provider tests (WFLX-W3): illustration + motion ports, offline adapters,
 * env-flag factories, credential discipline.
 */

import { describe, expect, test } from 'bun:test';
import { DeterministicInkIllustration } from '../../src/providers/visual/deterministic-ink';
import { RemoteImageModelIllustration } from '../../src/providers/visual/image-model';
import { selectIllustrationProvider } from '../../src/providers/visual/factory';
import { DeterministicMotionProvider } from '../../src/providers/video/deterministic-motion';
import { RemoteVideoModelMotion } from '../../src/providers/video/remote-motion';
import { selectMotionProvider } from '../../src/providers/video/factory';
import { REFERENCE_INK_STYLE_BIBLE } from '../../src/video/style-bible';

const STYLE = {
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
  widthPx: 1280,
  heightPx: 720,
};

const REQUEST = {
  sceneId: 'scene-x',
  brief: 'A controller with hexagonal downstream nodes on graphite ground.',
  style: STYLE,
  seed: 'seed-x',
};

describe('DeterministicInkIllustration (offline canonical)', () => {
  test('byte-identical fragments for identical requests', async () => {
    const provider = new DeterministicInkIllustration();
    const a = await provider.illustrate(REQUEST);
    const b = await provider.illustrate(REQUEST);
    expect(a.fragment).toBe(b.fragment);
    expect(a.deterministic).toBe(true);
    expect(a.providerId).toBe('deterministic-ink');
    expect(a.widthPx).toBe(1280);
    expect(a.heightPx).toBe(720);
  });

  test('different seeds produce different fragments', async () => {
    const provider = new DeterministicInkIllustration();
    const a = await provider.illustrate(REQUEST);
    const b = await provider.illustrate({ ...REQUEST, seed: 'seed-y' });
    expect(a.fragment).not.toBe(b.fragment);
  });

  test('fragments are non-trivial, palette-only and text-free', async () => {
    const provider = new DeterministicInkIllustration();
    const result = await provider.illustrate(REQUEST);
    expect(result.fragment.length).toBeGreaterThan(2000);
    expect(result.fragment).not.toContain('<text');
    const allowed = new Set(
      Object.values(REFERENCE_INK_STYLE_BIBLE.palette).map((role) => role.value),
    );
    const hexes = [...result.fragment.matchAll(/#[0-9a-f]{6}/g)].map((match) => match[0]);
    expect(hexes.length).toBeGreaterThan(10);
    for (const hex of hexes) {
      expect(allowed.has(hex)).toBe(true);
    }
  });

  test('capabilities and credential surface', () => {
    const provider = new DeterministicInkIllustration();
    expect(provider.capabilities()).toEqual({
      vectorOutput: true,
      remote: false,
      maxBatchSize: 1,
    });
    expect(provider.requiredCredentialKeys()).toEqual([]);
  });
});

describe('RemoteImageModelIllustration (optional, env-gated)', () => {
  test('refuses to run without explicit wiring (never silently degrades)', async () => {
    const provider = new RemoteImageModelIllustration({}, {});
    expect(provider.requiredCredentialKeys()).toContain('WFLX_IMAGE_MODEL_ENDPOINT');
    await expect(provider.illustrate(REQUEST)).rejects.toThrow(/WFLX_IMAGE_MODEL_ENDPOINT/);
    const health = await provider.healthCheck();
    expect(health.ok).toBe(false);
  });

  test('endpoint-present but key-absent still refuses', async () => {
    const provider = new RemoteImageModelIllustration(
      { endpoint: 'https://example.internal/v1/images' },
      {},
    );
    await expect(provider.illustrate(REQUEST)).rejects.toThrow(/WFLX_IMAGE_MODEL_KEY/);
  });
});

describe('illustration factory', () => {
  test('default is the offline deterministic adapter', () => {
    const selected = selectIllustrationProvider({ env: {} });
    expect(selected.choice).toBe('offline');
    expect(selected.provider.id).toBe('deterministic-ink');
  });

  test('env flag selects the image-model adapter', () => {
    const selected = selectIllustrationProvider({
      env: { WFLX_VISUAL_ILLUSTRATION_PROVIDER: 'image-model' },
    });
    expect(selected.choice).toBe('image-model');
    expect(selected.provider.kind).toBe('remote-image-model');
  });

  test('explicit choice overrides the env flag', () => {
    const selected = selectIllustrationProvider({
      provider: 'offline',
      env: { WFLX_VISUAL_ILLUSTRATION_PROVIDER: 'image-model' },
    });
    expect(selected.choice).toBe('offline');
  });
});

describe('DeterministicMotionProvider', () => {
  const provider = new DeterministicMotionProvider();
  const base = {
    sceneId: 'scene-m',
    seed: 'seed-m',
    durationSeconds: 8,
    canvasWidthPx: 1280,
    canvasHeightPx: 720,
  };

  test('static scenes stay identity', async () => {
    const plan = await provider.planMotion({ ...base, motion: 'static' });
    expect(plan.from).toEqual({ dx: 0, dy: 0, scale: 1 });
    expect(plan.to).toEqual({ dx: 0, dy: 0, scale: 1 });
    expect(plan.deterministic).toBe(true);
  });

  test('zoom plans push in gently and deterministically', async () => {
    const a = await provider.planMotion({ ...base, motion: 'zoom' });
    const b = await provider.planMotion({ ...base, motion: 'zoom' });
    expect(a).toEqual(b);
    expect(a.to.scale).toBeGreaterThan(1);
    expect(a.to.scale).toBeLessThanOrEqual(1.08);
    expect(a.easing).toBe('ease-in-out');
  });

  test('pan plans drift within the observed gentle bounds', async () => {
    const plan = await provider.planMotion({ ...base, motion: 'pan' });
    expect(Math.abs(plan.to.dx)).toBeLessThanOrEqual(0.04 * 1280);
    expect(Math.abs(plan.to.dy)).toBeLessThanOrEqual(0.03 * 720);
  });

  test('capabilities and credential surface', () => {
    expect(provider.capabilities().parametricMotion).toBe(true);
    expect(provider.capabilities().generatedClips).toBe(false);
    expect(provider.requiredCredentialKeys()).toEqual([]);
  });
});

describe('RemoteVideoModelMotion (optional, env-gated)', () => {
  test('clip generation refuses without wiring; parametric planning still works', async () => {
    const provider = new RemoteVideoModelMotion({}, {});
    expect(provider.requiredCredentialKeys()).toContain('WFLX_VIDEO_MODEL_ENDPOINT');
    const plan = await provider.planMotion({
      sceneId: 's',
      motion: 'zoom',
      seed: 'seed',
      durationSeconds: 5,
      canvasWidthPx: 1280,
      canvasHeightPx: 720,
    });
    expect(plan.deterministic).toBe(true);
    await expect(
      provider.generateClip({
        sceneId: 's',
        motion: 'zoom',
        seed: 'seed',
        durationSeconds: 5,
        canvasWidthPx: 1280,
        canvasHeightPx: 720,
        brief: 'A slow reveal',
      }),
    ).rejects.toThrow(/WFLX_VIDEO_MODEL_ENDPOINT/);
  });
});

describe('motion factory', () => {
  test('default is offline; env flag selects remote', () => {
    expect(selectMotionProvider({ env: {} }).choice).toBe('offline');
    const remote = selectMotionProvider({ env: { WFLX_VIDEO_MOTION_PROVIDER: 'remote' } });
    expect(remote.choice).toBe('remote');
    expect(remote.provider.capabilities().generatedClips).toBe(true);
  });
});
