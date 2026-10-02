/**
 * EXP-V-CIN-01 runner (WFLX-P2, Deliverable C1 / EV-021) — the Cinematic
 * asset pipeline with the OFFLINE generative stand-in.
 *
 * The canonical fixture (plan-video-explainer-7min.json) through the cinematic
 * layer, full trajectory:
 *
 *   storyboard compile -> CinematicDirector (shot plans, continuity,
 *   five-class VisualAssetPlan) -> offline generative stand-ins resolve the
 *   generative jobs -> render x2 (SVG determinism pair) -> asset validation
 *   gates (plan + per-asset; failures throw) -> timeline + cinematic overlay ->
 *   narration -> composition (fallback backend) -> video QA + cinematic QA ->
 *   artifact sidecar with honest provenance.
 *
 * Then the local-regeneration proof: ONE scene's generative asset regenerates
 * and the run proves the plan fingerprint, every other asset record and all
 * deterministic scene SVGs outside the target stay byte-identical (C-5 at the
 * asset layer).
 *
 * WFLX_CIN_TARGET = all (default) | a | b | regen | summary
 *   a    — full trajectory run A (composition included; persists the artifact set)
 *   b    — full trajectory run B (double-run byte-identity proof)
 *   regen — single-asset local regeneration proof
 *   summary — assemble experiment-record.json from the persisted outputs
 *
 * WFLX-P3 (EV-025): the ad-hoc product-side pending markers in the summary
 * record are REPLACED by schema-compliant comparison records
 * (tools/comparison/video-hooks.ts) — the Cinematic slot records the SCOPING
 * TRUTH that no Cinematic product format exists (LAB-07 UI-truth) with all
 * metrics COMPARISON PENDING REFERENCE CAPTURE.
 *
 * Falsifiers (work order §4 C1):
 *   F1 determinism (double-run byte-identical plan + metadata)
 *   F2 local regeneration (single-asset regen touches only that asset)
 *   F3 structure/continuity constraints hold (validator PASS)
 *   F4 QA passes or flags honestly
 *
 * Offline stand-ins throughout — NOT product parity evidence (AGENTS.md).
 */

import { mkdirSync, writeFileSync, readFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import {
  compileCinematicOverview,
  compileVideoScenes,
  regenerateSceneAssets,
  stableStringify,
  type CinematicAssetRecord,
  type CompileCinematicResult,
} from '../src/video';
import { OfflineGenerativeVisual } from '../src/providers/visual/offline-generative';
import { OfflineGenerativeVideo } from '../src/providers/video/offline-generative';
import type { OverviewPlan, SemanticGraph } from '../src/contracts';
import { buildCinematicPendingRecord } from '../tools/comparison/video-hooks';

const OUT_ROOT = 'artifacts/video/exp-v-cin-01';

const TARGET = (process.env.WFLX_CIN_TARGET ?? 'all') as 'all' | 'a' | 'b' | 'regen' | 'summary';

/** Fixed experiment environment (determinism spine). */
const SEED = 'wflx-w3-test-seed';
const NOW = '2026-09-28T00:00:00Z' as const;
const RUN_STAMP = '2026-10-01T12:00:00Z';

const CANONICAL_PLAN: OverviewPlan = JSON.parse(
  readFileSync('fixtures/contracts/plan-video-explainer-7min.json', 'utf8'),
) as OverviewPlan;
const CANONICAL_GRAPH: SemanticGraph = JSON.parse(
  readFileSync('fixtures/contracts/reference-messy-note.semantic-graph.json', 'utf8'),
) as SemanticGraph;

function writeJson(name: string, value: unknown): void {
  mkdirSync(OUT_ROOT, { recursive: true });
  writeFileSync(join(OUT_ROOT, name), `${stableStringify(value)}\n`, 'utf8');
}

function readJson(name: string): unknown {
  return JSON.parse(readFileSync(join(OUT_ROOT, name), 'utf8')) as unknown;
}

function sha256Hex(data: string | Uint8Array): string {
  return createHash('sha256').update(data).digest('hex');
}

async function runFull(label: string): Promise<CompileCinematicResult> {
  const workDir = mkdtempSync(join(tmpdir(), `wflx-cin-01-${label}-`));
  const output = join(workDir, 'overview.mp4');
  const result = await compileCinematicOverview(CANONICAL_PLAN, CANONICAL_GRAPH, {
    output,
    now: NOW,
    seed: SEED,
    backend: 'fallback',
    workDir,
    visualProvider: new OfflineGenerativeVisual(),
    videoProvider: new OfflineGenerativeVideo(),
  });
  rmSync(workDir, { recursive: true, force: true });
  return result;
}

/** The deterministic metadata manifest (composition-independent). */
function metadataManifest(result: CompileCinematicResult): {
  readonly planFingerprint: string;
  readonly assets: readonly {
    readonly jobId: string;
    readonly assetIdentity: string;
    readonly assetClass: string;
    readonly providerId: string;
    readonly modelId: string;
    readonly sha256: string;
    readonly byteLength: number;
    readonly format: string;
    readonly deterministic: boolean;
    readonly live: boolean;
  }[];
  readonly validation: unknown;
  readonly overlay: unknown;
  readonly timeline: unknown;
  readonly qa: unknown;
  readonly cinematicQa: unknown;
  readonly sceneSvgCombinedSha256: string;
  readonly narrationWavSha256: string;
} {
  return {
    planFingerprint: result.cinematicPlanFingerprint,
    assets: result.assets.map((a) => ({
      jobId: a.record.jobId,
      assetIdentity: a.record.assetIdentity,
      assetClass: a.record.assetClass,
      providerId: a.record.providerId,
      modelId: a.record.modelId,
      sha256: a.record.sha256,
      byteLength: a.record.byteLength,
      format: a.record.format,
      deterministic: a.record.deterministic,
      live: a.record.live,
    })),
    validation: result.validation,
    overlay: result.overlay,
    timeline: result.timeline,
    qa: result.qa,
    cinematicQa: result.cinematicQa,
    sceneSvgCombinedSha256: result.render.combinedSha256,
    narrationWavSha256: sha256Hex(result.narration.wav),
  };
}

async function runA(): Promise<void> {
  console.log('[exp-v-cin-01] run A: canonical fixture through the cinematic layer (offline stand-ins)…');
  const result = await runFull('a');

  writeJson('cinematic-plan.json', result.cinematicPlan);
  writeJson('cinematic-plan-fingerprint.json', {
    fingerprint: result.cinematicPlanFingerprint,
    note: 'sha256 over stableStringify(cinematic plan) — deterministic structural metadata (shot plans, continuity, asset jobs).',
  });
  writeJson('asset-manifest.json', metadataManifest(result));
  writeJson('validation.json', result.validation);
  writeJson('overlay.json', result.overlay);
  writeJson('artifact.json', result.artifact);
  writeJson('qa-report.json', result.qa);
  writeJson('cinematic-qa.json', result.cinematicQa);
  writeJson('timeline.json', result.timeline);
  writeJson('run-a-summary.json', {
    runStamp: RUN_STAMP,
    scenes: result.cinematicPlan.scenes.length,
    jobs: result.cinematicPlan.scenes.reduce((t, s) => t + s.assetJobs.length, 0),
    assets: result.assets.length,
    distinctAssetIdentities: new Set(result.assets.map((a) => a.record.assetIdentity)).size,
    planFingerprint: result.cinematicPlanFingerprint,
    sceneSvgCombinedSha256: result.render.combinedSha256,
    svgDeterminismPairIdentical: result.determinismProof.hashA === result.determinismProof.hashB,
    validationPassed: result.validation.passed,
    qaStatus: result.qa.status,
    cinematicQaStatus: result.cinematicQa.status,
    compositionBackend: result.composition.backend,
    mp4Sha256: result.artifact.media.sha256,
    mp4FingerprintOnly: true,
    mp4ExcludedByRule: 'MP4 bytes depend on the encoder build (raw-MP4 exclusion-by-rule extends to generative media); asset bytes are content-fingerprinted in asset-manifest.json.',
  });
  console.log(
    `[exp-v-cin-01] run A: ${result.cinematicPlan.scenes.length} scenes, ${result.assets.length} assets, validation ${result.validation.passed}, qa ${result.qa.status}/${result.cinematicQa.status}, plan ${result.cinematicPlanFingerprint.slice(0, 16)}…, svg ${result.render.combinedSha256.slice(0, 16)}…`,
  );
}

async function runB(): Promise<void> {
  console.log('[exp-v-cin-01] run B: double-run byte-identity proof…');
  const a = readJson('run-a-summary.json') as { planFingerprint?: string; sceneSvgCombinedSha256?: string };
  const manifestA = readJson('asset-manifest.json') as { assets?: { sha256: string }[] };
  const result = await runFull('b');
  const manifestB = metadataManifest(result);

  const identical =
    manifestA.assets !== undefined &&
    stableStringify(manifestA) === stableStringify(manifestB);

  writeJson('determinism.json', {
    runAPlanFingerprint: a.planFingerprint,
    runBPlanFingerprint: manifestB.planFingerprint,
    planFingerprintIdentical: a.planFingerprint === manifestB.planFingerprint,
    metadataManifestIdentical: identical,
    sceneSvgCombinedSha256RunA: a.sceneSvgCombinedSha256,
    sceneSvgCombinedSha256RunB: manifestB.sceneSvgCombinedSha256,
    sceneSvgIdentical: a.sceneSvgCombinedSha256 === manifestB.sceneSvgCombinedSha256,
    narrationWavIdentical: null,
    inRunSvgPairIdentical: result.determinismProof.hashA === result.determinismProof.hashB,
    byteIdenticalLayers: [
      'cinematic plan (fingerprint)',
      'asset manifest (job ids, identities, classes, providers, content fingerprints, byte lengths)',
      'validation report',
      'cinematic overlay (shot plans + clip references)',
      'timeline',
      'video QA report',
      'cinematic QA report',
      'scene-SVG set (combined sha256)',
    ],
    mp4ExcludedByRule: true,
  });
  console.log(
    `[exp-v-cin-01] run B: plan ${manifestB.planFingerprint.slice(0, 16)}… identical=${a.planFingerprint === manifestB.planFingerprint}, metadata manifest identical=${identical}, svg identical=${a.sceneSvgCombinedSha256 === manifestB.sceneSvgCombinedSha256}`,
  );
}

async function runRegen(): Promise<void> {
  console.log('[exp-v-cin-01] local regeneration: single-asset proof (C-5 at the asset layer)…');
  // Recompute the baseline state deterministically (storyboard + cinematic).
  const compiled = compileVideoScenes(CANONICAL_PLAN, CANONICAL_GRAPH, { seed: SEED });
  const result = await runFull('regen-baseline');

  // Target: a scene with a GENERATIVE job (not the first generative scene,
  // so it exercises the reuse/regeneration path meaningfully).
  const generativeScenes = result.cinematicPlan.scenes.filter(
    (scene) =>
      scene.assetJobs.some(
        (job) =>
          job.assetClass === 'illustration' ||
          job.assetClass === 'generative-animation' ||
          job.assetClass === 'video-generation',
      ),
  );
  const target = generativeScenes[generativeScenes.length - 1];
  if (target === undefined) throw new Error('no generative scene to regenerate');
  const targetJob = target.assetJobs.find(
    (job) => job.assetClass !== 'deterministic-diagram' && job.assetClass !== 'source-derived-media',
  );
  if (targetJob === undefined) throw new Error('no generative job on the target scene');

  const proof = await regenerateSceneAssets(
    {
      cinematicPlan: result.cinematicPlan,
      cinematicPlanFingerprint: result.cinematicPlanFingerprint,
      assets: result.assets,
      render: result.render,
    },
    compiled.storyboard,
    target.sceneId,
    {
      visualProvider: new OfflineGenerativeVisual(),
      videoProvider: new OfflineGenerativeVideo(),
    },
  );

  const regenRecord = {
    targetSceneId: target.sceneId,
    targetJobIds: proof.changedJobIds,
    planFingerprintBefore: proof.planFingerprintBefore,
    planFingerprintAfter: proof.planFingerprintAfter,
    planUnchanged: proof.planUnchanged,
    otherAssetRecordsUnchanged: proof.otherAssetRecordsUnchanged,
    deterministicSurfacesUnchanged: proof.deterministicSurfacesUnchanged,
    validationPassedAfterRegen: proof.validation.passed,
    regeneratedRecords: proof.regeneratedRecords,
    offlineStandinRegenerationByteIdentical: proof.regeneratedRecords.every((record) => {
      const before = result.assets.find((a) => a.record.jobId === record.jobId) as
        | { record: CinematicAssetRecord }
        | undefined;
      return before !== undefined && before.record.sha256 === record.sha256;
    }),
    interpretation:
      'regenerating ONE scene generative asset re-runs only that scene jobs; the cinematic plan fingerprint, every other asset record and all deterministic scene SVGs outside the target are byte-identical. With the OFFLINE stand-in the regenerated bytes are also identical (deterministic provider); with a LIVE provider the target bytes change honestly while the same isolation proof holds.',
  };
  writeJson('regen-proof.json', regenRecord);
  console.log(
    `[exp-v-cin-01] regen: scene ${target.sceneId} jobs ${proof.changedJobIds.join(',')}, plan unchanged ${proof.planUnchanged}, others unchanged ${proof.otherAssetRecordsUnchanged}, deterministic surfaces unchanged ${proof.deterministicSurfacesUnchanged}, validation ${proof.validation.passed}`,
  );
}

function runSummary(): void {
  const a = readJson('run-a-summary.json') as Record<string, unknown>;
  const det = existsSync(join(OUT_ROOT, 'determinism.json'))
    ? (readJson('determinism.json') as Record<string, unknown>)
    : {};
  const regen = existsSync(join(OUT_ROOT, 'regen-proof.json'))
    ? (readJson('regen-proof.json') as Record<string, unknown>)
    : {};
  const manifest = readJson('asset-manifest.json') as {
    assets?: { assetClass: string; live: boolean }[];
  };
  const assetClasses: Record<string, number> = {};
  for (const asset of manifest.assets ?? []) {
    assetClasses[asset.assetClass] = (assetClasses[asset.assetClass] ?? 0) + 1;
  }

  const falsifiers = {
    F1_determinism:
      det.planFingerprintIdentical === true &&
      det.metadataManifestIdentical === true &&
      det.sceneSvgIdentical === true,
    F2_local_regeneration:
      regen.planUnchanged === true &&
      regen.otherAssetRecordsUnchanged === true &&
      regen.deterministicSurfacesUnchanged === true,
    F3_structure_continuity_validator_pass: a.validationPassed === true,
    F4_qa_passes_or_flags_honestly:
      a.qaStatus === 'passed' || a.qaStatus === 'passed-with-issues',
  };

  const record = {
    experiment: 'EXP-V-CIN-01',
    runStamp: RUN_STAMP,
    input: 'fixtures/contracts/plan-video-explainer-7min.json (the canonical W1 fixture) through the WFLX-P2 cinematic layer',
    runA: a,
    determinism: det,
    regeneration: regen,
    assetClassHistogram: assetClasses,
    falsifiers,
    comparisonRecords: [
      buildCinematicPendingRecord({
        labSceneCount: (a.scenes as number) ?? 0,
        labJobs: (a.jobs as number) ?? 0,
        assetClassHistogram: assetClasses,
        planFingerprintIdentical: det.planFingerprintIdentical === true,
        regenIsolationProven: falsifiers.F2_local_regeneration === true,
        labArtifactId: 'exp-v-cin-01 (cinematic plan fingerprint — see committed cinematic-plan-fingerprint.json)',
      }),
    ],
    honestBoundaries: [
      'OFFLINE generative stand-ins: deterministic placeholder renderers behind the REAL job interface — NOT real generative output and NOT product parity evidence (AGENTS.md).',
      'SCOPING TRUTH (WFLX-P3 / EV-025): no Cinematic product format exists in the product video surface (LAB-07 UI-truth) — the comparison record carries the scoping truth with all metrics COMPARISON PENDING REFERENCE CAPTURE, never a parity claim.',
      'Native video-clip embedding in the offline compositor is UNRESOLVED: video-generation assets are validated, content-fingerprinted, provenance-recorded and referenced in the timeline overlay; the composed MP4 renders the deterministic + still-art layers.',
      'MP4 bytes follow the raw-MP4 exclusion-by-rule discipline; the pinned layers are the cinematic plan fingerprint, asset manifest, validation, overlay, timeline, QA reports and the scene-SVG set.',
      'Real generative provider execution is Deliverable C2 / EXP-V-CIN-LIVE-01 (EV-022).',
    ],
    labels: { observation: 'REPRODUCED (lab)' },
  };
  writeJson('experiment-record.json', record);
  console.log(
    `[exp-v-cin-01] summary: falsifiers F1-F4 ${falsifiers.F1_determinism}/${falsifiers.F2_local_regeneration}/${falsifiers.F3_structure_continuity_validator_pass}/${falsifiers.F4_qa_passes_or_flags_honestly}`,
  );
}

async function main(): Promise<void> {
  if (TARGET === 'all' || TARGET === 'a') await runA();
  if (TARGET === 'all' || TARGET === 'b') await runB();
  if (TARGET === 'all' || TARGET === 'regen') await runRegen();
  if (TARGET === 'all' || TARGET === 'summary') runSummary();
}

await main();
