/**
 * WFLX-P3B wave-2 integration experiment runner — main entry.
 *
 *   bun run exp:integration                     # full wave-2 series
 *   bun run exp:integration --only EXP-A-04-R2  # subset (dev convenience)
 *   bun run exp:integration --list              # print configured ids
 *
 * Executes the seeded experiment configs (tools/experiments/configs.ts —
 * EXP-A-01..06-R2 re-runs under the EV-008 fixed Director, EXP-V-01..08
 * video-surface ablations at the storyboard layer, EXP-D-01 same-source
 * dual-modality comparison) through the REAL merged pipelines
 * (tools/experiments/pipeline.ts), computes deterministic diffs
 * (tools/experiments/metrics.ts) and lands:
 *
 *   docs/experiments/records/<ID>.yaml            protocol records (ALL fields)
 *   artifacts/experiments/arms/<runId>.json       per-arm measured data
 *   artifacts/experiments/evidence-entries.jsonl  registry.jsonl-compatible
 *   artifacts/experiments/summary.json            machine-readable twin
 *   artifacts/experiments/digest.json             output-set digest
 *   artifacts/{audio,video}/<series>/<runId>/... per-arm sidecars
 *
 * Determinism spine: every stamp is the fixed EXP_NOW (the summary's
 * generatedAtUtc is FIXED, unlike the EV-006 exp:a summary's wall-clock
 * stamp — one full invocation re-run must be byte-identical, which is the
 * packet-level proof: run twice, compare artifacts/experiments/digest.json
 * sha256). In-run self-check: one audio arm is re-executed and its media
 * fingerprint asserted byte-identical before a clean exit.
 *
 * Encoder-nondeterminism exclusion (2026-09-29 station lesson, OBSERVED):
 * the raw MP4 byte hash and size from the exp-d composition differ across
 * identical invocations on the SAME environment (Remotion/ffmpeg output is
 * not byte-stable), so no committed output records the raw MP4 fingerprint —
 * the composition is pinned by its CONTENT fingerprint (media structure +
 * scene-SVG combined hash + plan + seed) and the dual-video artifact.json
 * (surface-emitted single-run snapshot) is excluded from the digest set.
 *
 * All runs are lab reproduction — NOT product parity evidence (AGENTS.md).
 * Worker-owned trees consumed read-only; writes only under artifacts/ and
 * docs/experiments/records/.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { stableStringify } from '../../src/audio';
import type { OverviewPlan, SemanticGraph } from '../../src/contracts';
import { executeArm, runMultisourceArm } from './pipeline';
import {
  ARMS_DATA_DIR,
  EVIDENCE_ENTRIES_PATH,
  EXPERIMENT_CONFIGS,
  EXP_NOW,
  RECORDS_DIR,
  RUNNER_ID,
  RUNNER_PATH_VALUE,
  RUNNER_VERSION,
  SUMMARY_PATH,
} from './configs';
import {
  EXP_A_AUDIO_SEED,
  EXP_A_DIRECTOR_SEED,
  EXP_D_SEED,
  EXP_OPERATOR,
  EXP_RECORD_TIMESTAMP,
  EXP_V_DIRECTOR_SEED,
  EXP_V_DIRECTOR_SEED_B,
  EXP_V_VIDEO_SEED,
  EXP_V_VIDEO_SEED_B,
  type ArmData,
  type ArmSpec,
  type AudioArmData,
  type DualVideoArmData,
  type ExperimentConfig,
  type VideoArmData,
} from './runner-types';
import {
  diffAudioRuns,
  diffGraphs,
  diffVideoRuns,
  sha256,
  type AudioRunDiff,
  type AudioRunMetrics,
  type AudioSlimResult,
  type GraphDiff,
  type VideoRunDiff,
  type VideoRunMetrics,
} from './metrics';
import {
  assembleRecord,
  recordDigestOf,
  renderEvidenceEntry,
  renderEvidenceLine,
  renderRecordYaml,
  type DualModalityComparison,
  type ExperimentResult,
  type RecordSpec,
} from './records';

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

interface CliArgs {
  readonly only: readonly string[] | null;
  readonly quiet: boolean;
  readonly list: boolean;
}

function parseArgs(argv: readonly string[]): CliArgs {
  const only: string[] = [];
  let quiet = false;
  let list = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--only') {
      const value = argv[i + 1];
      if (value === undefined) throw new Error('--only requires a comma-separated id list');
      only.push(...value.split(',').map((id) => id.trim()).filter((id) => id !== ''));
      i += 1;
    } else if (arg === '--quiet') {
      quiet = true;
    } else if (arg === '--list') {
      list = true;
    } else {
      throw new Error(`unknown flag: ${arg} (expected --only <ids> | --quiet | --list)`);
    }
  }
  return { only: only.length > 0 ? only : null, quiet, list };
}

// ---------------------------------------------------------------------------
// Arm execution cache (same runId = same arm; re-use instead of re-running)
// ---------------------------------------------------------------------------

/** Everything that defines an arm's OUTPUT, excluding labels (runId/experiment). */
function armIdentity(arm: ArmSpec): string {
  const { runId: _runId, experiment: _experiment, ...identity } = arm;
  return stableStringify(identity);
}

interface ExecutedArm {
  readonly spec: ArmSpec;
  readonly data: ArmData;
}

/** An arm that actually ran (blocked arms carry no measured metrics).
 * NOTE: dual-audio arms surface as kind 'audio' (the W2 pipeline emits the
 * standard audio ArmData under the exp-d series root). */
type MeasuredArm = ExecutedArm & {
  readonly data: AudioArmData | VideoArmData | DualVideoArmData;
};

type AudioMeasuredArm = ExecutedArm & { readonly data: AudioArmData };
type VideoMeasuredArm = ExecutedArm & { readonly data: VideoArmData | DualVideoArmData };

function isAudioArm(arm: ExecutedArm): arm is AudioMeasuredArm {
  return arm.data.kind === 'audio';
}

function isVideoArm(arm: ExecutedArm): arm is VideoMeasuredArm {
  return arm.data.kind === 'video' || arm.data.kind === 'dual-video';
}

function isDualVideoArm(arm: ExecutedArm): arm is ExecutedArm & { readonly data: DualVideoArmData } {
  return arm.data.kind === 'dual-video';
}

/** Blocked arms carry no measured metrics (their evidence is blocker.json). */
function isMeasuredData(
  data: ArmData,
): data is AudioArmData | VideoArmData | DualVideoArmData {
  return data.kind !== 'video-blocked';
}

/**
 * Executes every unique arm once (same runId = same arm; re-use instead of
 * re-running). Exported for the tests/integration record-flip asserts, which
 * regenerate the EXP-V-05/06 records through this exact machinery.
 */
export async function executeArms(
  configs: readonly ExperimentConfig[],
  quiet: boolean,
): Promise<Map<string, ExecutedArm>> {
  const cache = new Map<string, ExecutedArm>();
  for (const config of configs) {
    for (const arm of config.arms) {
      const cached = cache.get(arm.runId);
      if (cached !== undefined) {
        if (armIdentity(cached.spec) !== armIdentity(arm)) {
          throw new Error(
            `config bug: runId '${arm.runId}' is reused with a different arm spec ` +
              `(${config.id} vs earlier config)`,
          );
        }
        continue;
      }
      if (!quiet) process.stdout.write(`[${config.id}] `);
      if (arm.kind === 'video-blocked') {
        // WFLX-V3A record flip: the blocked-attempt arm is now the REAL
        // multi-source arm; EXP-V-06's baseline additionally runs the
        // single-source removal control, cached as its own arm.
        const { baseline, control } = await runMultisourceArm(arm);
        cache.set(arm.runId, { spec: arm, data: baseline });
        if (control !== null) cache.set(control.runId, { spec: arm, data: control });
        continue;
      }
      const data = await executeArm(arm);
      cache.set(arm.runId, { spec: arm, data });
    }
  }
  return cache;
}

// ---------------------------------------------------------------------------
// Diff phase (plans + graphs re-read from the persisted sidecars — memory
// discipline: nothing heavy survives the execution phase)
// ---------------------------------------------------------------------------

function readJsonFile<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function armMetrics<T extends AudioRunMetrics | VideoRunMetrics>(arm: MeasuredArm): T {
  return arm.data.metrics as unknown as T;
}

function audioSlimOf(arm: AudioMeasuredArm): AudioSlimResult {
  const plan = readJsonFile<OverviewPlan>(join(arm.data.artifactDir, 'plan.json'));
  const realized = arm.data.kind === 'audio' ? arm.data.realizedTexts : [];
  return { plan, realized: realized.map((text) => ({ text })) };
}

function graphOf(arm: ExecutedArm): SemanticGraph | null {
  const path = join(arm.data.artifactDir, 'graph.json');
  return existsSync(path) ? readJsonFile<SemanticGraph>(path) : null;
}

function qaMetricsOf(
  data: AudioArmData | VideoArmData | DualVideoArmData,
): Record<string, string> {
  if (data.kind === 'audio') {
    return data.audioQaMetrics;
  }
  return data.videoQaMetrics;
}

// ---------------------------------------------------------------------------
// Dual-modality comparison (EXP-D; checklist §2 item 5)
// ---------------------------------------------------------------------------

function buildDualComparison(
  config: ExperimentConfig,
  audioArm: AudioMeasuredArm,
  videoArm: ExecutedArm & { readonly data: DualVideoArmData },
): DualModalityComparison {
  const audio = armMetrics<AudioRunMetrics>(audioArm);
  const video = armMetrics<VideoRunMetrics>(videoArm);
  const audioPlan = readJsonFile<OverviewPlan>(join(audioArm.data.artifactDir, 'plan.json'));
  const videoPlan = readJsonFile<OverviewPlan>(join(videoArm.data.artifactDir, 'plan.json'));
  const accounted = (plan: OverviewPlan): string[] => [
    ...new Set([
      ...plan.coverage.covered.map((c) => c.claimId),
      ...plan.coverage.omitted.map((o) => o.claimId),
    ]),
  ].sort();
  const audioAccounted = accounted(audioPlan);
  const videoAccounted = accounted(videoPlan);
  const audioCited = [...new Set(audioPlan.audioTurns.flatMap((t) => t.claimIds))].sort();
  const videoCited = [...new Set(videoPlan.videoScenes.flatMap((s) => s.claimIds))].sort();
  const dualVideo = videoArm.data;
  const eq = (a: readonly string[], b: readonly string[]): boolean =>
    a.length === b.length && a.every((value, i) => value === b[i]);
  return {
    sourceFingerprint: config.source_fingerprint,
    seed: config.otherConfig.director_seed as string,
    targetDurationSeconds: audio.targetDurationSeconds,
    audio: {
      runId: audio.runId,
      planId: audio.planId,
      mode: audio.mode,
      artifactId: audio.artifactId,
      artifactMediaSha256: audio.artifactMediaSha256,
      turnCount: audio.turnCount,
      beatCount: audio.beatCount,
      speakers: audio.speakers,
      purposeHistogram: audio.purposeHistogram,
      coverageFraction: audio.coverageFraction,
      coveredClaimCount: audio.coveredClaimIds.length,
      coveredClaimIds: audio.coveredClaimIds,
      accountedClaimIds: audioAccounted,
      omittedClaimCount: audio.omittedClaimCount,
      totalTurnSeconds: audio.totalTurnSeconds,
      wordsPerSecondMean: audio.wordsPerSecondMean,
      overBudgetTurns: audio.overBudgetTurns,
      qaStatus: audio.qaStatus,
      qaMetrics: qaMetricsOf(audioArm.data),
    },
    video: {
      runId: video.runId,
      planId: video.planId,
      mode: video.mode,
      artifactId: video.artifactId ?? '',
      artifactMediaSha256: video.artifactMediaSha256 ?? '',
      sceneCount: video.sceneCount,
      beatCount: video.beatCount,
      sceneTypeHistogram: video.sceneTypeHistogram,
      coverageFraction: video.coverageFraction,
      coveredClaimCount: video.coveredClaimIds.length,
      coveredClaimIds: video.coveredClaimIds,
      accountedClaimIds: videoAccounted,
      omittedClaimCount: video.omittedClaimCount,
      totalSceneSeconds: video.totalSceneSeconds,
      timelineDurationSeconds: video.timelineDurationSeconds,
      narrationSegmentCount: video.narrationSegmentCount,
      svgCombinedSha256: video.svgCombinedSha256,
      svgDeterminismByteIdentical: dualVideo.determinismProof.hashA === dualVideo.determinismProof.hashB,
      mp4ContentFingerprint: dualVideo.mp4ContentFingerprint,
      qaStatus: video.qaStatus,
      qaMetrics: qaMetricsOf(videoArm.data),
    },
    sharedSpine: {
      coveredClaimSetsEqual: eq(audio.coveredClaimIds, video.coveredClaimIds),
      accountedClaimSetsEqual: eq(audioAccounted, videoAccounted),
      citedSetsEqual: eq(audioCited, videoCited),
      coveredClaimIds: audio.coveredClaimIds,
      audioTurnCitedClaimIds: audioCited,
      videoSceneCitedClaimIds: videoCited,
    },
  };
}

// ---------------------------------------------------------------------------
// Per-experiment result assembly
// ---------------------------------------------------------------------------

/**
 * Assembles one experiment's result + record. Exported for the
 * tests/integration record-flip asserts (byte-identical regeneration of the
 * EXP-V-05/06 records through the exact runner machinery).
 */
export function buildExperimentResult(
  config: ExperimentConfig,
  cache: ReadonlyMap<string, ExecutedArm>,
): { result: ExperimentResult; record: RecordSpec } {
  // WFLX-V3A record flip: EXP-V-06's single-source removal control is a
  // runner-derived arm (the config arm list stays byte-unchanged per the
  // HANDOFF law); it participates as the variant in the diff phase.
  const configArms = config.arms.map((arm) => cache.get(arm.runId) as ExecutedArm);
  const executedArms: ExecutedArm[] = [...configArms];
  for (const arm of [...configArms]) {
    const controlRunId =
      arm.data.kind === 'video' ? arm.data.removalControlRunId : undefined;
    if (controlRunId === undefined) continue;
    const control = cache.get(controlRunId);
    if (control === undefined) {
      throw new Error(`${config.id}: removal control arm '${controlRunId}' missing from the execution cache`);
    }
    executedArms.push(control);
  }

  const arms = executedArms.map((executed) => {
    return {
      kind: executed.data.kind,
      runId: executed.data.runId,
      experiment: executed.data.experiment,
      artifactDir: executed.data.artifactDir,
      metrics: isMeasuredData(executed.data) ? executed.data.metrics : {},
      qaMetrics: isMeasuredData(executed.data) ? qaMetricsOf(executed.data) : {},
    };
  });
  const audioArms = executedArms.filter(isAudioArm);
  const videoArms = executedArms.filter(isVideoArm);

  const audioDiffs: AudioRunDiff[] = [];
  if (audioArms.length >= 2) {
    const baseline = armMetrics<AudioRunMetrics>(audioArms[0] as AudioMeasuredArm);
    const baselineSlim = audioSlimOf(audioArms[0] as AudioMeasuredArm);
    for (const arm of audioArms.slice(1)) {
      audioDiffs.push(
        diffAudioRuns(baseline, armMetrics<AudioRunMetrics>(arm), baselineSlim, audioSlimOf(arm)),
      );
    }
  }

  const videoDiffs: VideoRunDiff[] = [];
  if (videoArms.length >= 2) {
    const baseline = armMetrics<VideoRunMetrics>(videoArms[0] as VideoMeasuredArm);
    for (const arm of videoArms.slice(1)) {
      videoDiffs.push(diffVideoRuns(baseline, armMetrics<VideoRunMetrics>(arm)));
    }
  }

  let graphDiff: GraphDiff | null = null;
  const graphArms = executedArms.filter((arm) => graphOf(arm) !== null);
  if (graphArms.length >= 2) {
    graphDiff = diffGraphs(
      graphOf(graphArms[0] as ExecutedArm) as SemanticGraph,
      graphOf(graphArms[graphArms.length - 1] as ExecutedArm) as SemanticGraph,
    );
  }

  let dualModalityComparison: DualModalityComparison | null = null;
  if (config.series === 'exp-d') {
    const audioArm = executedArms.find(isAudioArm);
    const videoArm = executedArms.find(isDualVideoArm);
    if (audioArm === undefined || videoArm === undefined) {
      throw new Error(`${config.id}: exp-d config requires one dual-audio and one dual-video arm`);
    }
    dualModalityComparison = buildDualComparison(config, audioArm, videoArm);
  }

  const recordPath = join(RECORDS_DIR, `${config.id}.yaml`);
  const result: ExperimentResult = {
    id: config.id,
    matrixEntry: config.matrixEntry,
    surface: config.surface,
    // Placeholder: superseded by the RECORD's status after assembly (the
    // WFLX-V3A record flip computes the re-run verdicts in records.ts).
    status: config.authored.status,
    arms,
    audioDiffs,
    videoDiffs,
    graphDiff,
    dualModalityComparison,
    recordPath,
    recordSha256: '',
  };
  const record = assembleRecord(config, result);
  const recordSha256 = recordDigestOf(renderRecordYaml(record));
  return { result: { ...result, status: record.status, recordSha256 }, record };
}

// ---------------------------------------------------------------------------
// Output-set digest (the packet-level determinism proof: two full
// invocations must produce the same digest)
// ---------------------------------------------------------------------------

function collectFiles(root: string): string[] {
  const out: string[] = [];
  if (!existsSync(root)) return out;
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const child = join(dir, entry.name);
      if (entry.isDirectory()) walk(child);
      else out.push(child);
    }
  };
  walk(root);
  return out;
}

function digestOf(files: readonly string[]): { files: number; sha256: string } {
  const lines = [...files]
    .sort()
    .map((path) => `${path}\0${sha256(readFileSync(path))}`);
  return { files: files.length, sha256: sha256(lines.join('\n')) };
}

// ---------------------------------------------------------------------------
// Console tables
// ---------------------------------------------------------------------------

function printAudioRow(m: AudioRunMetrics): void {
  process.stdout.write(
    `${m.runId.padEnd(30)} mode=${m.mode.padEnd(10)} dur=${String(m.targetDurationSeconds).padEnd(4)} ` +
      `turns=${String(m.turnCount).padEnd(3)} beats=${String(m.beatCount).padEnd(3)} ` +
      `cov=${String(m.coveredClaimIds.length + '/' + m.graphClaimCount).padEnd(6)} ` +
      `wps=${m.wordsPerSecondMean.toFixed(2).padEnd(6)} over=${String(m.overBudgetTurns).padEnd(2)} ` +
      `qa=${m.qaStatus}\n`,
  );
}

function printVideoRow(m: VideoRunMetrics): void {
  process.stdout.write(
    `${m.runId.padEnd(30)} mode=${m.mode.padEnd(10)} dur=${String(m.targetDurationSeconds).padEnd(4)} ` +
      `scenes=${String(m.sceneCount).padEnd(3)} beats=${String(m.beatCount).padEnd(3)} ` +
      `cov=${String(m.coveredClaimIds.length + '/' + m.graphClaimCount).padEnd(6)} ` +
      `sceneSec=${String(m.totalSceneSeconds).padEnd(5)} qa=${m.qaStatus} ` +
      `svg=${m.svgCombinedSha256.slice(0, 10)}\n`,
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.list) {
    for (const config of EXPERIMENT_CONFIGS) process.stdout.write(`${config.id}\n`);
    return;
  }
  const configs =
    args.only !== null
      ? EXPERIMENT_CONFIGS.filter((config) => args.only?.includes(config.id))
      : EXPERIMENT_CONFIGS;
  if (configs.length === 0) throw new Error(`no experiment configs matched --only ${args.only?.join(',')}`);
  const missing = args.only?.filter((id) => !EXPERIMENT_CONFIGS.some((c) => c.id === id)) ?? [];
  if (missing.length > 0) throw new Error(`unknown experiment ids: ${missing.join(', ')}`);

  if (!args.quiet) {
    process.stdout.write(
      `WFLX-P3B wave-2 integration experiment runner (${RUNNER_ID} v${RUNNER_VERSION})\n` +
        `${configs.length} experiments, fixed now ${EXP_NOW}, record stamp ${EXP_RECORD_TIMESTAMP}\n\n`,
    );
  }

  // ---- phase 1: execute every unique arm once ------------------------------
  const cache = await executeArms(configs, args.quiet);
  if (!args.quiet) process.stdout.write(`\nexecuted ${cache.size} unique arms\n\n`);

  // ---- phase 2: assemble records + results ---------------------------------
  const built = configs.map((config) => buildExperimentResult(config, cache));

  // ---- phase 3: determinism self-check (one audio arm re-executed) ---------
  const selfCheckArm = [...cache.values()].find(isAudioArm);
  let determinismSelfCheck: {
    runId: string;
    firstMediaSha256: string;
    recomputedMediaSha256: string;
    identical: boolean;
  } | null = null;
  if (selfCheckArm !== undefined) {
    if (!args.quiet) process.stdout.write(`determinism self-check (re-run ${selfCheckArm.spec.runId}) ... `);
    const first = armMetrics<AudioRunMetrics>(selfCheckArm).artifactMediaSha256;
    const rerun = await executeArm(selfCheckArm.spec);
    if (!isMeasuredData(rerun)) throw new Error('self-check arm re-run produced no metrics');
    const second = (rerun.metrics as unknown as AudioRunMetrics).artifactMediaSha256;
    determinismSelfCheck = {
      runId: selfCheckArm.spec.runId,
      firstMediaSha256: first,
      recomputedMediaSha256: second,
      identical: first === second,
    };
    if (!args.quiet) {
      process.stdout.write(`${determinismSelfCheck.identical ? 'IDENTICAL' : 'DIVERGED'} ${second.slice(0, 16)}\n`);
    }
  }

  // ---- phase 4: persist records, arm data, evidence entries, summary -------
  mkdirSync(ARMS_DATA_DIR, { recursive: true });
  const written = new Set<string>();
  for (const { result, record } of built) {
    writeFileSync(result.recordPath, renderRecordYaml(record), 'utf8');
    written.add(result.recordPath);
  }
  for (const arm of cache.values()) {
    const path = join(ARMS_DATA_DIR, `${arm.data.runId}.json`);
    writeFileSync(path, `${stableStringify(arm.data)}\n`, 'utf8');
    written.add(path);
  }
  const evidenceLines: string[] = [];
  for (const { result, record } of built) {
    const config = configs.find((c) => c.id === result.id) as ExperimentConfig;
    evidenceLines.push(renderEvidenceLine(renderEvidenceEntry(config, record, result)));
  }
  writeFileSync(EVIDENCE_ENTRIES_PATH, evidenceLines.join(''), 'utf8');
  written.add(EVIDENCE_ENTRIES_PATH);

  const summary = {
    generatedAtUtc: EXP_NOW,
    stampPolicy:
      'FIXED stamp (EXP_NOW) — one full runner invocation is byte-reproducible, unlike the EV-006 ' +
      'exp:a summary wall-clock stamp; wall-clock breaks the packet determinism proof',
    runner: RUNNER_PATH_VALUE,
    runnerId: RUNNER_ID,
    runnerVersion: RUNNER_VERSION,
    operator: EXP_OPERATOR,
    recordTimestampUtc: EXP_RECORD_TIMESTAMP,
    seeds: {
      expAAudioSeed: EXP_A_AUDIO_SEED,
      expADirectorSeed: EXP_A_DIRECTOR_SEED,
      expVDirectorSeed: EXP_V_DIRECTOR_SEED,
      expVDirectorSeedB: EXP_V_DIRECTOR_SEED_B,
      expVVideoSeed: EXP_V_VIDEO_SEED,
      expVVideoSeedB: EXP_V_VIDEO_SEED_B,
      expDSeed: EXP_D_SEED,
    },
    experimentCount: built.length,
    uniqueArmCount: cache.size,
    experiments: built.map(({ result }) => ({
      id: result.id,
      matrixEntry: result.matrixEntry,
      surface: result.surface,
      status: result.status,
      recordPath: result.recordPath,
      recordSha256: result.recordSha256,
      armRunIds: result.arms.map((arm) => arm.runId),
      audioDiffs: result.audioDiffs,
      videoDiffs: result.videoDiffs,
      graphDiff: result.graphDiff,
      dualModalityComparison: result.dualModalityComparison,
    })),
    determinismSelfCheck,
    note:
      'All runs are deterministic lab reproduction over the merged main pipelines (offline ' +
      'deterministic providers, pure-TS mastering; video ablations at the storyboard layer — ' +
      'the pinned determinism layer). OBSERVED 2026-09-29: the exp-d composition renders are NOT ' +
      'byte-stable across invocations on this environment (raw MP4 hash/size vary; Remotion/ffmpeg ' +
      'encoder non-determinism) — the composition is pinned by its CONTENT fingerprint and the raw ' +
      'MP4 fingerprint is excluded from the output-set digest by rule. NOT product parity evidence ' +
      '(AGENTS.md).',
  };
  writeFileSync(SUMMARY_PATH, `${stableStringify(summary)}\n`, 'utf8');
  written.add(SUMMARY_PATH);

  // ---- phase 5: output-set digest ------------------------------------------
  // Everything this invocation wrote: records + arms data + evidence entries +
  // summary + every per-arm sidecar file under each arm's artifact dir —
  // EXCEPT files that carry encoder-nondeterministic values (the dual-video
  // artifact.json is the surface-emitted single-run snapshot whose
  // media.sha256/sizeBytes are raw MP4 fingerprints; OBSERVED 2026-09-29 the
  // raw MP4 bytes differ across identical invocations, so pinning them would
  // make the digest permanently unstable — see pipeline.ts fingerprint note).
  const DIGEST_EXCLUDED = new Set<string>([
    join('artifacts/video/exp-d', 'dual-video-explainer-300s', 'artifact.json'),
  ]);
  const digestFiles = new Set<string>(written);
  for (const arm of cache.values()) {
    for (const file of collectFiles(arm.data.artifactDir)) {
      if (!DIGEST_EXCLUDED.has(file)) digestFiles.add(file);
    }
  }
  const digest = digestOf([...digestFiles]);
  const digestPath = 'artifacts/experiments/digest.json';
  writeFileSync(
    digestPath,
    `${stableStringify({
      generatedAtUtc: EXP_NOW,
      scope:
        'sha256 over every deterministic file emitted by one full runner invocation (sorted path + ' +
        'file sha256); this file itself excluded. Encoder-nondeterministic single-run snapshots ' +
        '(the dual-video artifact.json raw MP4 media.sha256/sizeBytes) are excluded by rule — ' +
        'the composition is pinned by its CONTENT fingerprint in determinism.json. Two invocations ' +
        'with identical digest = the packet-level byte-stability proof.',
      fileCount: digest.files,
      sha256: digest.sha256,
      coveredRoots: [
        RECORDS_DIR,
        ARMS_DATA_DIR,
        EVIDENCE_ENTRIES_PATH,
        SUMMARY_PATH,
        ...[...new Set([...cache.values()].map((arm) => arm.data.artifactDir))].sort(),
      ],
      excluded: [...DIGEST_EXCLUDED].sort(),
    })}\n`,
    'utf8',
  );

  // ---- phase 6: console report ---------------------------------------------
  if (!args.quiet) {
    process.stdout.write('\n=== audio arms ===\n');
    for (const arm of [...cache.values()].filter(isAudioArm)) {
      printAudioRow(armMetrics<AudioRunMetrics>(arm));
    }
    process.stdout.write('\n=== video arms (storyboard layer; exp-d full pipeline) ===\n');
    for (const arm of [...cache.values()].filter(isVideoArm)) {
      printVideoRow(armMetrics<VideoRunMetrics>(arm));
    }
    for (const arm of [...cache.values()]) {
      if (arm.data.kind === 'video-blocked') {
        process.stdout.write(`${arm.data.runId.padEnd(30)} BLOCKED: ${arm.data.blocker}\n`);
      }
    }
    process.stdout.write('\n=== records landed ===\n');
    for (const { result } of built) {
      process.stdout.write(`${result.id.padEnd(14)} ${result.status.padEnd(9)} ${result.recordPath}\n`);
    }
    process.stdout.write(
      `\noutput digest: ${digest.sha256} (${digest.files} files) -> ${digestPath}\n`,
    );
  } else {
    process.stdout.write(`output digest: ${digest.sha256} (${digest.files} files)\n`);
  }

  if (determinismSelfCheck !== null && !determinismSelfCheck.identical) {
    throw new Error('determinism self-check FAILED: audio arm re-run diverged');
  }
}

// Direct-execution guard: `bun run tools/experiments/runner.ts` runs the
// series; importing the module (tests/integration record-flip asserts) must
// NOT. import.meta.main is true only for the entry file.
if (import.meta.main) {
  await main();
}
