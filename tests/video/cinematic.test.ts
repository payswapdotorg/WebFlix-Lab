/**
 * WFLX-P2 Deliverable C tests — the Cinematic asset pipeline (offline
 * stand-in path): shot plans, five-class asset plan, continuity, validation
 * gates, determinism, local regeneration, and the offline default.
 *
 * Lab reproduction evidence only — NOT product parity evidence (AGENTS.md).
 */

import { describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  CANONICAL_GRAPH,
  CANONICAL_VIDEO_PLAN,
  FIXED_NOW,
  FIXED_SEED,
  buildTinyVideoPlan,
  mutatePlan,
} from './fixtures';
import {
  assetIdentityFor,
  buildCinematicPlan,
  cinematicPlanFingerprint,
  compileCinematicOverview,
  compileVideoScenes,
  regenerateSceneAssets,
  subjectKeyFor,
  validateCinematicAssets,
  validateCinematicPlan,
  type CinematicAssetRecord,
  type CinematicPlan,
} from '../../src/video';
import { OfflineGenerativeVisual } from '../../src/providers/visual/offline-generative';
import { OfflineGenerativeVideo } from '../../src/providers/video/offline-generative';
import type { VideoScene } from '../../src/contracts';

describe('CinematicDirector — shot plans, continuity, asset reuse', () => {
  test('every scene gets a deterministic shot plan + >=1 asset job; all five classes exercised on the canonical fixture', () => {
    const compiled = compileVideoScenes(CANONICAL_VIDEO_PLAN, CANONICAL_GRAPH, { seed: FIXED_SEED });
    const plan = buildCinematicPlan(compiled.storyboard, { seed: FIXED_SEED });
    expect(plan.scenes.length).toBe(CANONICAL_VIDEO_PLAN.videoScenes.length);
    const classes = new Set<string>();
    for (const scene of plan.scenes) {
      expect(scene.shotPlan.shotClass).toBeTruthy();
      expect(scene.shotPlan.cameraMove).toBeTruthy();
      expect(scene.shotPlan.durationSeconds).toBeGreaterThan(0);
      expect(scene.assetJobs.length).toBeGreaterThanOrEqual(1);
      for (const job of scene.assetJobs) classes.add(job.assetClass);
    }
    expect([...classes].sort()).toEqual([
      'deterministic-diagram',
      'generative-animation',
      'illustration',
      'source-derived-media',
      'video-generation',
    ]);
    // Provider independence is structural.
    expect(plan.meta.providerIndependent).toBe(true);
  });

  test('deterministic shot plans: double build is byte-identical; a single-scene mutation moves only that scene', () => {
    const compiled = compileVideoScenes(CANONICAL_VIDEO_PLAN, CANONICAL_GRAPH, { seed: FIXED_SEED });
    const a = buildCinematicPlan(compiled.storyboard, { seed: FIXED_SEED });
    const b = buildCinematicPlan(compiled.storyboard, { seed: FIXED_SEED });
    expect(cinematicPlanFingerprint(a)).toBe(cinematicPlanFingerprint(b));

    const mutated = mutatePlan(CANONICAL_VIDEO_PLAN, (draft) => {
      const scene = draft.videoScenes[2] as VideoScene;
      const spare = CANONICAL_GRAPH.claims.find((c) => !scene.claimIds.includes(c.id));
      if (spare !== undefined) scene.claimIds = [spare.id];
    });
    const compiledMut = compileVideoScenes(mutated, CANONICAL_GRAPH, { seed: FIXED_SEED });
    const planMut = buildCinematicPlan(compiledMut.storyboard, { seed: FIXED_SEED });
    let changedScenes = 0;
    for (let i = 0; i < a.scenes.length; i += 1) {
      const sa = a.scenes[i];
      const sb = planMut.scenes[i];
      if (sa === undefined || sb === undefined) continue;
      if (JSON.stringify(sa) !== JSON.stringify(sb)) changedScenes += 1;
    }
    expect(changedScenes).toBe(1);
  });

  test('subject keys are stable and asset identities reuse across scenes', () => {
    const compiled = compileVideoScenes(CANONICAL_VIDEO_PLAN, CANONICAL_GRAPH, { seed: FIXED_SEED });
    const storyboard = compiled.storyboard;
    const key = subjectKeyFor(storyboard.scenes[0] as (typeof storyboard.scenes)[number]);
    expect(key).toMatch(/^subject:/);
    expect(assetIdentityFor(key)).toBe(assetIdentityFor(key));
    expect(assetIdentityFor('subject:a')).not.toBe(assetIdentityFor('subject:b'));
  });

  test('continuity: every adjacency carries exactly one subject-carry/motif constraint; palette constraints cover all scenes', () => {
    const compiled = compileVideoScenes(CANONICAL_VIDEO_PLAN, CANONICAL_GRAPH, { seed: FIXED_SEED });
    const plan = buildCinematicPlan(compiled.storyboard, { seed: FIXED_SEED });
    for (let i = 0; i + 1 < plan.scenes.length; i += 1) {
      const a = plan.scenes[i] as (typeof plan.scenes)[number];
      const b = plan.scenes[i + 1] as (typeof plan.scenes)[number];
      const links = plan.continuity.filter(
        (c) =>
          c.fromSceneId === a.sceneId &&
          c.toSceneId === b.sceneId &&
          (c.kind === 'subject-carry' || c.kind === 'motif'),
      );
      expect(links.length).toBe(1);
    }
    expect(plan.continuity.filter((c) => c.kind === 'palette').length).toBe(plan.scenes.length);
  });
});

describe('Cinematic validation gates', () => {
  test('plan gates pass on the canonical fixture build', () => {
    const compiled = compileVideoScenes(CANONICAL_VIDEO_PLAN, CANONICAL_GRAPH, { seed: FIXED_SEED });
    const plan = buildCinematicPlan(compiled.storyboard, { seed: FIXED_SEED });
    const report = validateCinematicPlan(plan);
    expect(report.passed).toBe(true);
    for (const check of report.checks) expect(check.passed).toBe(true);
  });

  test('red: a broken plan (missing job scene, bad camera, doubled adjacency) fails its gates', () => {
    const compiled = compileVideoScenes(CANONICAL_VIDEO_PLAN, CANONICAL_GRAPH, { seed: FIXED_SEED });
    const plan = buildCinematicPlan(compiled.storyboard, { seed: FIXED_SEED });
    const broken = JSON.parse(JSON.stringify(plan)) as unknown as {
      scenes: { assetJobs: { sceneId: string }[]; shotPlan: { cameraMove: string } }[];
      continuity: unknown[];
      meta: CinematicPlan['meta'];
    };
    // Unknown scene reference on a job.
    const jobZero = broken.scenes[0]?.assetJobs?.[0] as { sceneId: string } | undefined;
    if (jobZero !== undefined) jobZero.sceneId = 'scene-999';
    // Invalid camera move.
    const shotOne = broken.scenes[1]?.shotPlan as { cameraMove: string } | undefined;
    if (shotOne !== undefined) shotOne.cameraMove = 'teleport';
    // Duplicate adjacency constraint.
    broken.continuity.push(broken.continuity[0]);
    const brokenPlan = broken as unknown as CinematicPlan;
    const report = validateCinematicPlan(brokenPlan);
    expect(report.passed).toBe(false);
    const names = report.checks.filter((c) => !c.passed).map((c) => c.name);
    expect(names).toContain('scenes-have-jobs');
    expect(names).toContain('shot-plan-vocabulary');
    expect(names).toContain('continuity-constraints');
  });

  test('asset gates: offline stand-in assets pass; a corrupted asset fails on fingerprint/dimension gates', async () => {
    const compiled = compileVideoScenes(CANONICAL_VIDEO_PLAN, CANONICAL_GRAPH, { seed: FIXED_SEED });
    const plan = buildCinematicPlan(compiled.storyboard, { seed: FIXED_SEED });
    const styleBible = compiled.storyboard.styleBible;
    const visual = new OfflineGenerativeVisual();
    const video = new OfflineGenerativeVideo();

    const assets: { record: CinematicAssetRecord; bytes: Uint8Array }[] = [];
    for (const scene of plan.scenes) {
      for (const job of scene.assetJobs) {
        if (job.assetClass === 'illustration' || job.assetClass === 'generative-animation') {
          const result = await visual.generateAsset({
            jobId: job.jobId,
            sceneId: job.sceneId,
            assetClass: job.assetClass === 'illustration' ? 'illustration' : 'generative-animation',
            brief: job.brief,
            ...(job.subjectKey !== undefined ? { subjectKey: job.subjectKey } : {}),
            palette: {
              background: styleBible.palette.background.value,
              ink: styleBible.palette.ink.value,
              emphasis: styleBible.palette.emphasis.value,
              warning: styleBible.palette.warning.value,
            },
            widthPx: job.spec.widthPx,
            heightPx: job.spec.heightPx,
            seed: job.seed,
          });
          assets.push({
            record: {
              jobId: job.jobId,
              sceneId: job.sceneId,
              assetIdentity: job.assetIdentity,
              assetClass: job.assetClass,
              format: result.format,
              widthPx: result.widthPx,
              heightPx: result.heightPx,
              providerId: result.providerId,
              modelId: result.modelId,
              deterministic: result.deterministic,
              sha256: (await import('node:crypto'))
                .createHash('sha256')
                .update(result.bytes)
                .digest('hex'),
              byteLength: result.bytes.byteLength,
              live: false,
            },
            bytes: result.bytes,
          });
        } else if (job.assetClass === 'video-generation') {
          const result = await video.generateClip({
            jobId: job.jobId,
            sceneId: job.sceneId,
            brief: job.brief,
            ...(job.subjectKey !== undefined ? { subjectKey: job.subjectKey } : {}),
            widthPx: job.spec.widthPx,
            heightPx: job.spec.heightPx,
            durationSeconds: scene.shotPlan.durationSeconds,
            seed: job.seed,
          });
          assets.push({
            record: {
              jobId: job.jobId,
              sceneId: job.sceneId,
              assetIdentity: job.assetIdentity,
              assetClass: job.assetClass,
              format: result.format,
              widthPx: result.widthPx,
              heightPx: result.heightPx,
              providerId: result.providerId,
              modelId: result.modelId,
              deterministic: result.deterministic,
              sha256: (await import('node:crypto'))
                .createHash('sha256')
                .update(result.bytes)
                .digest('hex'),
              byteLength: result.bytes.byteLength,
              live: false,
            },
            bytes: result.bytes,
          });
        }
      }
    }
    expect(assets.length).toBeGreaterThan(0);

    const good = validateCinematicAssets(plan, assets);
    expect(good.passed).toBe(true);

    // Corrupt one asset: wrong dimensions + stale fingerprint.
    const victim = assets[0] as { record: CinematicAssetRecord; bytes: Uint8Array };
    const corrupted = {
      record: { ...victim.record, widthPx: victim.record.widthPx + 1 },
      bytes: victim.bytes,
    };
    const bad = validateCinematicAssets(plan, [
      ...assets.slice(1),
      corrupted,
    ]);
    expect(bad.passed).toBe(false);
    const failedAsset = bad.assetChecks.find((a) => a.jobId === victim.record.jobId);
    expect(failedAsset?.passed).toBe(false);
    const failedGates = failedAsset?.checks.filter((c) => !c.passed).map((c) => c.name) ?? [];
    expect(failedGates).toContain('dimensions');
  });
});

describe('compileCinematicOverview — offline stand-in end-to-end + local regeneration', () => {
  test(
    'tiny plan through the full cinematic pipeline: validation, QA, determinism, honest provenance',
    async () => {
      const workDir = mkdtempSync(join(tmpdir(), 'wflx-cin-test-'));
      const output = join(workDir, 'overview.mp4');
      const result = await compileCinematicOverview(buildTinyVideoPlan(), CANONICAL_GRAPH, {
        output,
        now: FIXED_NOW,
        seed: FIXED_SEED,
        backend: 'fallback',
        workDir,
        visualProvider: new OfflineGenerativeVisual(),
        videoProvider: new OfflineGenerativeVideo(),
      });

      // Deterministic structural metadata.
      expect(result.cinematicPlanFingerprint).toMatch(/^[0-9a-f]{64}$/);
      expect(result.validation.passed).toBe(true);
      expect(result.cinematicQa.status).toMatch(/^passed(-with-issues)?$/);
      // Determinism proof pair (offline stand-in is byte-deterministic).
      expect(result.determinismProof.hashB).toBe(result.determinismProof.hashA);
      // Honest provenance: offline stand-ins recorded, reproducible stays true.
      expect(result.artifact.providers[0]?.provider).toContain('offline');
      expect(result.artifact.generator.reproducible).toBe(true);
      expect(result.artifact.notes).toContain('NOT product parity evidence');
      // Composition produced a real MP4.
      expect(statSync(output).size).toBeGreaterThan(10_000);
      // Overlay carries shot plans for every scene.
      expect(result.overlay.entries.length).toBe(buildTinyVideoPlan().videoScenes.length);
      for (const entry of result.overlay.entries) {
        expect(entry.shotPlan.sceneId).toBe(entry.sceneId);
      }

      // Double-run: the whole pipeline is byte-identical offline (SVG layer).
      const second = await compileCinematicOverview(buildTinyVideoPlan(), CANONICAL_GRAPH, {
        output: join(workDir, 'overview-2.mp4'),
        now: FIXED_NOW,
        seed: FIXED_SEED,
        backend: 'fallback',
        workDir,
        visualProvider: new OfflineGenerativeVisual(),
        videoProvider: new OfflineGenerativeVideo(),
      });
      expect(second.cinematicPlanFingerprint).toBe(result.cinematicPlanFingerprint);
      expect(second.determinismProof.hashA).toBe(result.determinismProof.hashA);
      expect(
        second.assets.map((a) => a.record.sha256).join(','),
      ).toBe(result.assets.map((a) => a.record.sha256).join(','));

      rmSync(workDir, { recursive: true, force: true });
    },
    180_000,
  );

  test(
    'local regeneration: one scene asset regenerates; plan + other assets + deterministic surfaces unchanged',
    async () => {
      const workDir = mkdtempSync(join(tmpdir(), 'wflx-cin-regen-'));
      const output = join(workDir, 'overview.mp4');
      const result = await compileCinematicOverview(buildTinyVideoPlan(), CANONICAL_GRAPH, {
        output,
        now: FIXED_NOW,
        seed: FIXED_SEED,
        backend: 'fallback',
        workDir,
        visualProvider: new OfflineGenerativeVisual(),
        videoProvider: new OfflineGenerativeVideo(),
      });

      // Find a scene with a generative job.
      const target = result.cinematicPlan.scenes.find((scene) =>
        scene.assetJobs.some(
          (job) =>
            job.assetClass === 'illustration' ||
            job.assetClass === 'generative-animation' ||
            job.assetClass === 'video-generation',
        ),
      );
      expect(target).toBeDefined();
      const targetId = target?.sceneId as string;

      const proof = await regenerateSceneAssets(
        {
          cinematicPlan: result.cinematicPlan,
          cinematicPlanFingerprint: result.cinematicPlanFingerprint,
          assets: result.assets,
          render: result.render,
        },
        result.storyboard,
        targetId,
        {
          visualProvider: new OfflineGenerativeVisual(),
          videoProvider: new OfflineGenerativeVideo(),
        },
      );

      expect(proof.sceneId).toBe(targetId);
      expect(proof.planUnchanged).toBe(true);
      expect(proof.otherAssetRecordsUnchanged).toBe(true);
      expect(proof.deterministicSurfacesUnchanged).toBe(true);
      expect(proof.changedJobIds.length).toBeGreaterThan(0);
      expect(proof.validation.passed).toBe(true);
      // Offline stand-in regeneration is byte-identical (deterministic provider).
      for (const record of proof.regeneratedRecords) {
        const before = result.assets.find((a) => a.record.jobId === record.jobId);
        expect(before).toBeDefined();
        expect(record.sha256).toBe((before as { record: { sha256: string } }).record.sha256);
      }

      rmSync(workDir, { recursive: true, force: true });
    },
    180_000,
  );

  test('offline default: the factories select stand-ins when env flags are unset', async () => {
    const { selectVisualGenerativeProvider } = await import(
      '../../src/providers/visual/generative-factory'
    );
    const { selectVideoGenerativeProvider } = await import(
      '../../src/providers/video/generative-factory'
    );
    const env = {} as NodeJS.ProcessEnv;
    expect(selectVisualGenerativeProvider({ env }).choice).toBe('offline');
    expect(selectVideoGenerativeProvider({ env }).choice).toBe('offline');
    expect(
      selectVisualGenerativeProvider({ env: { WFLX_VISUAL_PROVIDER: 'live-zai' } }).choice,
    ).toBe('live-zai');
    expect(
      selectVideoGenerativeProvider({ env: { WFLX_VIDEO_PROVIDER: 'live-zai' } }).choice,
    ).toBe('live-zai');
  });
});
