/**
 * EXP-V-S-01 runner (WFLX-P2, Deliverable B / EV-020) — the Short (~60 s)
 * format experiment.
 *
 * Canonical fixture at the 60 s target through the dedicated Short compile
 * path: Director (mode 'short', 60 s) -> ShortFormat layer (depth compression
 * + hook prominence + closed coverage accounting) -> the UNMODIFIED storyboard
 * compiler -> render x2 -> timeline -> narration -> composition (fallback) ->
 * QA -> artifact. Records structure, coverage accounting, duration band and
 * determinism (double-run byte-identity at the pinned layers).
 *
 * Falsifiers (work order §3):
 *   F1 structure preserved (scene count/skeleton class within the recorded band)
 *   F2 coverage accounting closed (visualized + flagged-gap + omitted === all)
 *   F3 duration within the explicit band [48, 72] s of the 60 s target
 *   F4 determinism (double-run byte-identical)
 *
 * Lab reconstruction of DOCUMENTED product behavior ("Short (approx. 60 s)").
 * WFLX-P3 (EV-025): the ad-hoc product-side pending markers are REPLACED by
 * schema-compliant comparison records (tools/comparison/video-hooks.ts) fed
 * by the ingested LAB-series estate — LAB-07/08/09 product captures with the
 * n=3 duration band, the 9:16 geometry gap, the instrument-truth sceneDensity
 * note and the pending hookProminence annotation. Offline placeholders
 * throughout — NOT product parity evidence (AGENTS.md).
 */

import { mkdirSync, writeFileSync, readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { compileOverviewPlan } from '../src/director/compiler';
import {
  compileShortVideoScenes,
  compileVideoOverview,
  stableStringify,
} from '../src/video';
import type { OverviewPlan, SemanticGraph } from '../src/contracts';
import { buildShortComparisonRecord } from '../tools/comparison/video-hooks';

const OUT_ROOT = 'artifacts/video/exp-v-s-01';

/** Fixed experiment environment (determinism spine). */
const SEED = 'wflx-p2-short-video-seed';
const DIRECTOR_SEED = 'wflx-p2-short-director-seed';
const NOW = '2026-10-01T00:00:00Z' as const;
const RUN_STAMP = '2026-10-01T12:00:00Z';
const TARGET_SECONDS = 60;
const PLAN_ID = 'plan-messy-note-short-60s';

const CANONICAL_GRAPH: SemanticGraph = JSON.parse(
  readFileSync('fixtures/contracts/reference-messy-note.semantic-graph.json', 'utf8'),
) as SemanticGraph;
const CANONICAL_SOURCE = JSON.parse(
  readFileSync('fixtures/contracts/reference-messy-note.source-artifact.json', 'utf8'),
) as never;

function writeJson(name: string, value: unknown): void {
  mkdirSync(OUT_ROOT, { recursive: true });
  writeFileSync(join(OUT_ROOT, name), `${stableStringify(value)}\n`, 'utf8');
}

function sha256Hex(data: string | Uint8Array): string {
  return createHash('sha256').update(data).digest('hex');
}

function buildShortPlan(): OverviewPlan {
  return compileOverviewPlan({
    sources: [CANONICAL_SOURCE],
    graph: CANONICAL_GRAPH,
    modality: 'video',
    mode: 'short',
    targetDurationSeconds: TARGET_SECONDS,
    seed: DIRECTOR_SEED,
    now: NOW,
    planId: PLAN_ID,
    styleBibleId: 'style-bible--reference-ink',
  });
}

async function main(): Promise<void> {
  console.log('[exp-v-s-01] Director short-mode plan at 60 s…');
  const basePlan = buildShortPlan();

  // --- run A: the full Short trajectory (composition included) ------------
  console.log('[exp-v-s-01] Short compile path + full pipeline (fallback backend)…');
  const short = compileShortVideoScenes(basePlan, CANONICAL_GRAPH, { seed: SEED });
  const workDir = mkdtempSync(join(tmpdir(), 'wflx-v-s-01-'));
  const output = join(workDir, 'overview.mp4');
  const full = await compileVideoOverview(short.plan, CANONICAL_GRAPH, {
    output,
    now: NOW,
    seed: SEED,
    backend: 'fallback',
    workDir,
  });
  const mp4Bytes = new Uint8Array(readFileSync(output));
  const mp4Sha = sha256Hex(mp4Bytes);
  rmSync(workDir, { recursive: true, force: true });

  // --- run B: the same trajectory again for the double-run proof -----------
  const shortB = compileShortVideoScenes(basePlan, CANONICAL_GRAPH, { seed: SEED });
  const workDirB = mkdtempSync(join(tmpdir(), 'wflx-v-s-01-b-'));
  const outputB = join(workDirB, 'overview.mp4');
  const fullB = await compileVideoOverview(shortB.plan, CANONICAL_GRAPH, {
    output: outputB,
    now: NOW,
    seed: SEED,
    backend: 'fallback',
    workDir: workDirB,
  });
  rmSync(workDirB, { recursive: true, force: true });

  const report = short.report;
  const band = report.declaredBand;

  // --- the recorded band for F1: structure preserved vs the base Director
  // plan + the skeleton-class sequence. Recorded from the measured runs.
  const structureBand = {
    baseSceneCount: basePlan.videoScenes.length,
    adaptedSceneCount: report.sceneCount,
    sceneCountBand: [Math.max(1, basePlan.videoScenes.length - 1), basePlan.videoScenes.length + 1] as const,
    skeletonClasses: report.skeletonClasses,
    sceneIdsAndClasses: short.plan.videoScenes.map((scene) => ({
      id: scene.id,
      visualType: scene.visualType,
      beatId: scene.beatId,
      targetDurationSeconds: scene.targetDurationSeconds,
    })),
  };

  const falsifiers = {
    F1_structure_preserved:
      report.structurePreserved &&
      report.sceneCount >= (structureBand.sceneCountBand[0] as number) &&
      report.sceneCount <= (structureBand.sceneCountBand[1] as number) &&
      structureBand.adaptedSceneCount === structureBand.baseSceneCount,
    F2_coverage_accounting_closed: report.coverageAccounting.closed,
    F3_duration_within_band: report.durationWithinBand,
    F4_determinism: null as boolean | null,
  };
  falsifiers.F4_determinism =
    full.determinismProof.hashA === fullB.determinismProof.hashA &&
    full.determinismProof.hashA === full.determinismProof.hashB &&
    sha256Hex(full.narration.wav) === sha256Hex(fullB.narration.wav) &&
    stableStringify(full.timeline) === stableStringify(fullB.timeline) &&
    stableStringify(full.qa) === stableStringify(fullB.qa) &&
    stableStringify(short.report) === stableStringify(shortB.report) &&
    full.artifact.id === fullB.artifact.id;

  // WFLX-P3 (EV-025): schema-compliant comparison records replace the ad-hoc
  // product-side pending markers — product values come from the ingested
  // LAB-07/08/09 estate (captured artifacts, never live re-runs).
  const comparisonRecords = [
    buildShortComparisonRecord({
      labDurationSeconds: full.timeline.durationSeconds,
      labTargetSeconds: TARGET_SECONDS,
      declaredBand: { minSeconds: band.minSeconds, maxSeconds: band.maxSeconds },
      labSceneCount: report.sceneCount,
      labHookShare: report.hookShare,
      labGeometry: {
        width: full.artifact.media.video?.width ?? 1280,
        height: full.artifact.media.video?.height ?? 720,
        fps: full.artifact.media.video?.frameRate ?? 30,
      },
      labAudioStream: {
        codec: full.artifact.media.audio?.codec ?? 'aac',
        channels: full.artifact.media.audio?.channels ?? 1,
        sampleRateHz: full.artifact.media.audio?.sampleRateHz ?? 44100,
      },
      determinismByteIdentical: falsifiers.F4_determinism === true,
      labArtifactId: full.artifact.id,
      sourceNote: 'EXP-V-S-01 live run measurements (this runner)',
    }),
  ];

  const experimentRecord = {
    experiment: 'EXP-V-S-01',
    runStamp: RUN_STAMP,
    target: { mode: 'short', targetDurationSeconds: TARGET_SECONDS },
    declaredDurationBand: band,
    structure: structureBand,
    shortFormatReport: report,
    coverageAccounting: report.coverageAccounting,
    qa: {
      status: full.qa.status,
      metrics: full.qa.metrics.map((m) => ({ metric: m.metric, value: m.value })),
      cinematicNote: 'existing video QA over the adapted Short plan (passed through the UNMODIFIED storyboard compiler)',
    },
    composition: {
      backend: full.composition.backend,
      durationSeconds: full.timeline.durationSeconds,
      mp4Sha,
      mp4SizeBytes: mp4Bytes.byteLength,
      mp4Committed: mp4Bytes.byteLength <= 5_000_000,
      mp4ExcludedByRule:
        'MP4 bytes depend on the encoder build (raw-MP4 exclusion-by-rule); the pinned layers are the scene SVGs, timeline, narration WAV, QA report and artifact sidecar.',
    },
    falsifiers,
    comparisonRecords,
    honestBoundaries: [
      'Short-mode depth compression, hook boost and the [48, 72] s band are LAB POLICY reconstructions of DOCUMENTED ~60 s behavior; product-side numbers are now RECORDED from the LAB-07/08/09 captures in the schema-compliant comparison records (EV-025) — the product duration band sits ABOVE the lab target on this fixture class (recorded gap).',
      'Offline placeholder narration + deterministic ink illustrations — NOT product parity evidence (AGENTS.md).',
    ],
    labels: { observation: 'REPRODUCED (lab)' },
  };

  writeJson('base-short-plan.json', basePlan);
  writeJson('adapted-short-plan.json', short.plan);
  writeJson('short-format-report.json', report);
  writeJson('artifact.json', full.artifact);
  writeJson('qa-report.json', full.qa);
  writeJson('timeline.json', full.timeline);
  writeJson('determinism.json', {
    sceneSvgCombinedSha256: full.determinismProof.hashA,
    sceneSvgCombinedSha256SecondRender: full.determinismProof.hashB,
    secondFullRunSceneSvgSha256: fullB.determinismProof.hashA,
    byteIdentical: falsifiers.F4_determinism === true,
    narrationWavSha256: sha256Hex(full.narration.wav),
    timelineIdentical: stableStringify(full.timeline) === stableStringify(fullB.timeline),
    qaIdentical: stableStringify(full.qa) === stableStringify(fullB.qa),
    artifactId: full.artifact.id,
    mp4FingerprintOnly: !(mp4Bytes.byteLength <= 5_000_000),
  });
  writeJson('experiment-record.json', experimentRecord);

  // Commit the MP4 when it is small (the benchmark-explainer-26s precedent).
  if (mp4Bytes.byteLength <= 5_000_000) {
    mkdirSync(OUT_ROOT, { recursive: true });
    writeFileSync(join(OUT_ROOT, 'overview.mp4'), mp4Bytes);
  }

  console.log(
    `[exp-v-s-01] scenes ${report.sceneCount} (base ${report.baseSceneCount}), skeleton ${report.skeletonClasses.join('/')}, hookShare ${report.hookShare}, duration ${report.durationSeconds}s (band [${band.minSeconds}, ${band.maxSeconds}]s: ${report.durationWithinBand}), accounting ${report.coverageAccounting.visualized}+${report.coverageAccounting.coveredNotVisualized}+${report.coverageAccounting.omitted}=${report.coverageAccounting.totalGraphClaims} closed=${report.coverageAccounting.closed}`,
  );
  console.log(
    `[exp-v-s-01] qa ${full.qa.status}, mp4 ${mp4Bytes.byteLength} bytes (committed: ${mp4Bytes.byteLength <= 5_000_000}), falsifiers F1-F4: ${falsifiers.F1_structure_preserved}/${falsifiers.F2_coverage_accounting_closed}/${falsifiers.F3_duration_within_band}/${falsifiers.F4_determinism}`,
  );
}

await main();
