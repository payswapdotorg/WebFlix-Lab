/**
 * Experiment record assembly + deterministic YAML emission (WFLX-P3B wave 2
 * — Phase 3 checklist §2 item 4).
 *
 * Every landed record carries ALL protocol fields from
 * docs/experiments/record-template.yaml, in template order:
 *   id, timestamp_utc, operator, surface, reference_notebook,
 *   source_fingerprint, selected_sources, format, language, length,
 *   visual_style, custom_prompt, other_config, baseline_artifact, mutation,
 *   artifact_under_test, artifact_hash, observations, invariants,
 *   differences, hypothesis, confidence, falsifier, next_experiment, status,
 *   evidence_paths.
 *
 * Authored protocol fields come from tools/experiments/configs.ts; computed
 * fields (observations, differences, artifact hashes) are derived
 * deterministically from the measured arm results. Rendering is a pure
 * function of (config, experiment result) — identical inputs produce
 * byte-identical records (the determinism spine).
 *
 * The evidence entries are docs/evidence/registry.jsonl-COMPATIBLE records
 * ({id, timestamp_utc, operator, surface, evidence_kind, artifact_hash,
 * observations}) written to artifacts/experiments/evidence-entries.jsonl;
 * the wave-level EV entry is appended to docs/evidence/registry.jsonl by the
 * operator once per delivery (never automatically — re-runs must not
 * double-append).
 */

import type { ArmData, ExperimentConfig } from './runner-types';
import { EXP_OPERATOR, EXP_RECORD_TIMESTAMP } from './runner-types';
import { RUNNER_PATH_VALUE } from './configs';
import type {
  AudioRunDiff,
  AudioRunMetrics,
  GraphDiff,
  VideoRunDiff,
  VideoRunMetrics,
} from './metrics';
import { sha256 } from './metrics';

// ---------------------------------------------------------------------------
// Experiment result (the summary's machine-readable twin of the records)
// ---------------------------------------------------------------------------

export interface DualModalityComparison {
  readonly sourceFingerprint: string;
  readonly seed: string;
  readonly targetDurationSeconds: number;
  readonly audio: {
    readonly runId: string;
    readonly planId: string;
    readonly mode: string;
    readonly artifactId: string;
    readonly artifactMediaSha256: string;
    readonly turnCount: number;
    readonly beatCount: number;
    readonly speakers: readonly string[];
    readonly purposeHistogram: Record<string, number>;
    readonly coverageFraction: number;
    readonly coveredClaimCount: number;
    readonly coveredClaimIds: readonly string[];
    readonly accountedClaimIds: readonly string[];
    readonly omittedClaimCount: number;
    readonly totalTurnSeconds: number;
    readonly wordsPerSecondMean: number;
    readonly overBudgetTurns: number;
    readonly qaStatus: string;
    readonly qaMetrics: Record<string, string>;
  };
  readonly video: {
    readonly runId: string;
    readonly planId: string;
    readonly mode: string;
    readonly artifactId: string;
    readonly artifactMediaSha256: string;
    readonly sceneCount: number;
    readonly beatCount: number;
    readonly sceneTypeHistogram: Record<string, number>;
    readonly coverageFraction: number;
    readonly coveredClaimCount: number;
    readonly coveredClaimIds: readonly string[];
    readonly accountedClaimIds: readonly string[];
    readonly omittedClaimCount: number;
    readonly totalSceneSeconds: number;
    readonly timelineDurationSeconds: number;
    readonly narrationSegmentCount: number;
    readonly svgCombinedSha256: string;
    readonly svgDeterminismByteIdentical: boolean;
    readonly mp4ContentFingerprint: string;
    readonly qaStatus: string;
    readonly qaMetrics: Record<string, string>;
  };
  readonly sharedSpine: {
    readonly coveredClaimSetsEqual: boolean;
    readonly accountedClaimSetsEqual: boolean;
    readonly citedSetsEqual: boolean;
    readonly coveredClaimIds: readonly string[];
    readonly audioTurnCitedClaimIds: readonly string[];
    readonly videoSceneCitedClaimIds: readonly string[];
  };
}

export interface ExperimentResult {
  readonly id: string;
  readonly matrixEntry: string;
  readonly surface: string;
  readonly status: string;
  readonly arms: readonly {
    readonly kind: ArmData['kind'];
    readonly runId: string;
    readonly experiment: string;
    readonly artifactDir: string;
    readonly metrics: Record<string, unknown>;
    readonly qaMetrics: Record<string, string>;
  }[];
  readonly audioDiffs: readonly AudioRunDiff[];
  readonly videoDiffs: readonly VideoRunDiff[];
  readonly graphDiff: GraphDiff | null;
  readonly dualModalityComparison: DualModalityComparison | null;
  readonly recordPath: string;
  readonly recordSha256: string;
}

// ---------------------------------------------------------------------------
// Number formatting (deterministic rendering)
// ---------------------------------------------------------------------------

const round2 = (value: number): number => Math.round(value * 100) / 100;
const round3 = (value: number): number => Math.round(value * 1000) / 1000;
const pct = (value: number): number => round2(value * 100);

function quote(value: string): string {
  return JSON.stringify(value);
}

function fmtList(values: readonly string[]): string {
  return values.length === 0 ? 'none' : values.join(', ');
}

function purposeTop(hist: Record<string, number>, count: number): string {
  return Object.entries(hist)
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .slice(0, count)
    .map(([purpose, n]) => `${purpose}x${n}`)
    .join(', ');
}

function issuesByCodeText(metrics: { readonly qaIssuesByCode: Record<string, number> }): string {
  const entries = Object.entries(metrics.qaIssuesByCode);
  if (entries.length === 0) return '';
  return ` (${entries.map(([code, n]) => `${code}x${n}`).join(', ')})`;
}

// ---------------------------------------------------------------------------
// Computed observations (deterministic templates, evidence-labeled)
// ---------------------------------------------------------------------------

function audioMetricObservations(result: ExperimentResult): string[] {
  const out: string[] = [];
  const arms = result.arms.filter((arm) => arm.kind === 'audio');
  const baseline = arms[0]?.metrics as unknown as AudioRunMetrics | undefined;
  if (baseline === undefined) return out;
  out.push(
    `BASELINE (REPRODUCED): ${baseline.runId} — mode ${baseline.mode}, ${baseline.turnCount} turns / ` +
      `${baseline.beatCount} beats, speakers ${fmtList(baseline.speakers)}, coverage ` +
      `${baseline.coveredClaimIds.length}/${baseline.graphClaimCount} (${pct(baseline.coverageFraction)}%), ` +
      `${baseline.overBudgetTurns} over-budget turns, wps ${round2(baseline.wordsPerSecondMean)}, qa ` +
      `${baseline.qaStatus}${issuesByCodeText(baseline)}.`,
  );
  for (const diff of result.audioDiffs) {
    const variant = arms.find((arm) => arm.runId === diff.variant)?.metrics as unknown as
      | AudioRunMetrics
      | undefined;
    if (variant === undefined) continue;
    out.push(
      `VARIANT ${diff.variant} (REPRODUCED): ${variant.turnCount} turns / ${variant.beatCount} beats ` +
        `(delta ${signed(diff.turnCountDelta)} / ${signed(diff.beatCountDelta)}), coverage ` +
        `${variant.coveredClaimIds.length}/${variant.graphClaimCount} ` +
        `(added [${fmtList(diff.coverageAdded)}], removed [${fmtList(diff.coverageRemoved)}]), ` +
        `${variant.overBudgetTurns} over-budget turns, qa ${variant.qaStatus}; top purposes ` +
        `${purposeTop(variant.purposeHistogram, 4)}.`,
    );
    out.push(
      `STRUCTURE vs BASELINE (REPRODUCED): ${diff.structureChangedTurns}/` +
        `${diff.structureChangedTurns + diff.structureUnchangedTurns} turns changed structure ` +
        `(speaker/role/purpose/anchors/beat/duration); ${diff.textIdenticalTurns}/` +
        `${diff.textIdenticalTurns + diff.textChangedTurns} realized texts byte-identical; turn seconds ` +
        `${round2(baseline.totalTurnSeconds)} -> ${round2(variant.totalTurnSeconds)} ` +
        `(${signed(diff.totalTurnSecondsDelta)}); wps delta ${signed(round3(diff.wordsPerSecondMeanDelta))}.`,
    );
  }
  return out;
}

function videoMetricObservations(result: ExperimentResult): string[] {
  const out: string[] = [];
  // Blocked arms carry no video metrics — their evidence is blocker.json.
  const arms = result.arms.filter((arm) => arm.kind === 'video' || arm.kind === 'dual-video');
  const baseline = arms[0]?.metrics as unknown as VideoRunMetrics | undefined;
  if (baseline === undefined) return out;
  out.push(
    `BASELINE (REPRODUCED): ${baseline.runId} — mode ${baseline.mode}, ${baseline.sceneCount} scenes / ` +
      `${baseline.beatCount} beats, coverage ${baseline.coveredClaimIds.length}/${baseline.graphClaimCount} ` +
      `(${pct(baseline.coverageFraction)}%), ${baseline.totalSceneSeconds} scene-seconds, style bible ` +
      `${baseline.styleBibleId}, qa ${baseline.qaStatus}${issuesByCodeText(baseline)}, in-arm SVG ` +
      `determinism hashA===hashB ${baseline.svgCombinedSha256.slice(0, 16)}…`,
  );
  for (const diff of result.videoDiffs) {
    const variant = arms.find((arm) => arm.runId === diff.variant)?.metrics as unknown as
      | VideoRunMetrics
      | undefined;
    if (variant === undefined) continue;
    out.push(
      `VARIANT ${diff.variant} (REPRODUCED): ${variant.sceneCount} scenes / ${variant.beatCount} beats ` +
        `(delta ${signed(diff.sceneCountDelta)} / ${signed(diff.beatCountDelta)}), coverage ` +
        `${variant.coveredClaimIds.length}/${variant.graphClaimCount} ` +
        `(added [${fmtList(diff.coverageAdded)}], removed [${fmtList(diff.coverageRemoved)}]), ` +
        `${variant.totalSceneSeconds} scene-seconds (${signed(diff.totalSceneSecondsDelta)}), qa ` +
        `${variant.qaStatus}.`,
    );
    out.push(
      `STRUCTURE vs BASELINE (REPRODUCED): ${diff.structureChangedScenes}/` +
        `${diff.structureChangedScenes + diff.structureUnchangedScenes} scenes changed structure ` +
        `(type/anchors/beat/duration/motion/transition). SCENE SVGs vs BASELINE (REPRODUCED): ` +
        `${diff.svgChangedScenes}/${diff.svgChangedScenes + diff.svgIdenticalScenes} scene SVGs changed ` +
        `bytes; combined SVG hash ${diff.svgCombinedSha256Equal ? 'IDENTICAL' : 'CHANGED'}; plan ` +
        `fingerprint ${diff.planFingerprintEqual ? 'IDENTICAL' : 'CHANGED'}.`,
    );
  }
  return out;
}

function graphObservations(graphDiff: GraphDiff | null): string[] {
  if (graphDiff === null) return [];
  return [
    `GRAPH LAYER (REPRODUCED): claims changed [${fmtList(graphDiff.claimsChanged)}], added ` +
      `[${fmtList(graphDiff.claimsAdded)}], removed [${fmtList(graphDiff.claimsRemoved)}]; entities added ` +
      `[${fmtList(graphDiff.entitiesAdded)}] removed [${fmtList(graphDiff.entitiesRemoved)}]; topics added ` +
      `[${fmtList(graphDiff.topicsAdded)}] removed [${fmtList(graphDiff.topicsRemoved)}].`,
  ];
}

function dualModalityObservations(comparison: DualModalityComparison | null): string[] {
  if (comparison === null) return [];
  const { audio, video, sharedSpine } = comparison;
  return [
    `SHARED SPINE (REPRODUCED): same (source, graph, seed ${comparison.seed}, ` +
      `${comparison.targetDurationSeconds} s) — audio covered claim set ` +
      `${sharedSpine.coveredClaimSetsEqual ? '===' : '!=='} video covered claim set ` +
      `(${audio.coveredClaimCount} claims: ${fmtList(sharedSpine.coveredClaimIds)}); accounted sets ` +
      `${sharedSpine.accountedClaimSetsEqual ? 'identical' : 'differ'}; audio turn-cited set ` +
      `${sharedSpine.citedSetsEqual ? '===' : '!=='} video scene-cited set.`,
    `AUDIO SURFACE (REPRODUCED): ${audio.runId} — mode ${audio.mode}, ${audio.turnCount} turns / ` +
      `${audio.beatCount} beats, speakers ${fmtList(audio.speakers)}, coverage ` +
      `${audio.coveredClaimCount}/${audio.coveredClaimCount + audio.omittedClaimCount} ` +
      `(${pct(audio.coverageFraction)}%), ${audio.overBudgetTurns} over-budget turns, ` +
      `${round2(audio.totalTurnSeconds)} turn-seconds, wps ${round2(audio.wordsPerSecondMean)}, qa ` +
      `${audio.qaStatus}; deterministic QA metrics: ` +
      `${Object.entries(audio.qaMetrics).map(([id, value]) => `${id}=${value}`).join('; ')}.`,
    `VIDEO SURFACE (REPRODUCED): ${video.runId} — mode ${video.mode}, ${video.sceneCount} scenes / ` +
      `${video.beatCount} beats, coverage ${video.coveredClaimCount}/${video.coveredClaimCount + video.omittedClaimCount} ` +
      `(${pct(video.coverageFraction)}), ${video.totalSceneSeconds} scene-seconds, ` +
      `${video.narrationSegmentCount} narration segments, scene-SVG determinism ` +
      `${video.svgDeterminismByteIdentical ? 'hashA===hashB' : 'DIVERGED'} ` +
      `(${video.svgCombinedSha256.slice(0, 16)}…), MP4 content-fingerprinted ` +
      `(${video.mp4ContentFingerprint.slice(0, 16)}…; raw MP4 bytes are encoder-nondeterministic ` +
      `across invocations — OBSERVED — and are not recorded), qa ` +
      `${video.qaStatus}; deterministic QA metrics: ` +
      `${Object.entries(video.qaMetrics).map(([id, value]) => `${id}=${value}`).join('; ')}.`,
    `DETERMINISM (REPRODUCED): both surfaces compiled from pinned seeds and a fixed now; audio media ` +
      `sha256 ${audio.artifactMediaSha256.slice(0, 16)}…, video composition content fingerprint ` +
      `${video.mp4ContentFingerprint.slice(0, 16)}… (media structure + scene-SVG hash + plan + seed; ` +
      `the raw MP4 byte hash is encoder-nondeterministic even on this environment — OBSERVED — so the ` +
      `pinned video layers are the scene-SVG hash, narration WAV hash, and the deterministic metric ` +
      `set). No wall-clock metric appears in this comparison.`,
  ];
}

function blockedObservations(result: ExperimentResult): string[] {
  const blocked = result.arms.filter((arm) => arm.kind === 'video-blocked');
  if (blocked.length === 0) return [];
  return [
    `BLOCKED ARM EVIDENCE (OBSERVED): ${blocked.map((arm) => arm.runId).join(', ')} — the runner ` +
      `captured the deterministic ingestion failure; see blocker.json beside each run.`,
  ];
}

// ---------------------------------------------------------------------------
// WFLX-V3A record flip (work order 34-WFLX-V3A, 2026-10-03) — the
// EXP-V-05/06 re-run after the W1 multi-source unblock
// ---------------------------------------------------------------------------

/**
 * The BlockIndex pair-keying fix commit that removed the W1 blocker (the
 * superseded-blocker notes point here; the pre-fix BLOCKED records are
 * preserved in git history at their original commits).
 */
export const W1_FIX_COMMIT = '74f450f3c587463643c17e293e0778f1d86f6628';

const SUPERSEDED_NOTE =
  `SUPERSEDED-BLOCKER (REPRODUCED): this record supersedes the BLOCKED record of the same id — the ` +
  `W1 multi-source defect (src/contracts/validation.ts BlockIndex keyed blocks by blockId alone while ` +
  `every adapter numbers blocks per source from b1, so two-source ingestion threw "produced an ` +
  `inconsistent graph") was fixed by commit ${W1_FIX_COMMIT} (the (sourceId, blockId) pair key). The ` +
  `re-run is UNCHANGED per the HANDOFF law: same arms, same split marker, same source orderings, same ` +
  `seeds — tools/experiments/configs.ts is byte-identical; only the runner code flipped. The old ` +
  `BLOCKED record content is preserved in git history.`;

interface RecordFlip {
  /** The de-blocked hypothesis actually under test in the re-run. */
  readonly hypothesis: string;
  readonly confidence: 'low' | 'medium' | 'high';
  readonly next_experiment: string;
  /** Replaces the blocked-era `layer` other_config field. */
  readonly layer: string;
  /** Computed honest verdict from the measured result. */
  readonly status: (result: ExperimentResult) => string;
  /** Computed verdict lines (labeled, numbers from the measured diff). */
  readonly verdictLines: (result: ExperimentResult) => string[];
  /** Flip-era invariants (replace the blocked-era authored invariants). */
  readonly invariants: readonly string[];
}

function orderDiffOf(result: ExperimentResult): VideoRunDiff {
  const diff = result.videoDiffs[0];
  if (diff === undefined) throw new Error('record flip (EXP-V-05): the order diff is missing');
  return diff;
}

function removalDiffOf(result: ExperimentResult): VideoRunDiff {
  const diff = result.videoDiffs[0];
  if (diff === undefined) throw new Error('record flip (EXP-V-06): the removal diff is missing');
  return diff;
}

function removalGraphDiffOf(result: ExperimentResult): GraphDiff {
  if (result.graphDiff === null) throw new Error('record flip (EXP-V-06): the graph diff is missing');
  return result.graphDiff;
}

const RECORD_FLIPS: ReadonlyMap<string, RecordFlip> = new Map<string, RecordFlip>([
  [
    'EXP-V-05',
    {
      hypothesis:
        'Source order surfaces through the primary-source selection (the Director titles/objective ' +
        'follow sources[0]) and through equal-salience claim ranking (the seeded shuffle operates on ' +
        'the graph claim array, whose order follows ingestion order) — NOT through narrative order ' +
        'per se: beat/scene order and the covered claim set stay invariant across the swap.',
      confidence: 'high',
      next_experiment:
        'TL-side design decision (no queued lab arm): multi-source editorial weighting — primary-source ' +
        'primacy is currently positional (sources[0]); a mass/salience-weighted selection would be a ' +
        'Director change outside this lane.',
      layer: 'storyboard (the W1 unblock re-run; scene SVG set = the pinned determinism layer)',
      status: (result) => {
        const diff = orderDiffOf(result);
        // Falsifier: beat/scene order strictly independent across the swap
        // AND no plan-level coupling would weaken the ordering hypothesis.
        const orderIndependent =
          diff.structureChangedScenes === 0 && diff.svgChangedScenes === 0 && diff.planFingerprintEqual;
        return orderIndependent ? 'refuted' : 'supported';
      },
      verdictLines: (result) => {
        const diff = orderDiffOf(result);
        const coveredSetInvariant = diff.coverageAdded.length === 0 && diff.coverageRemoved.length === 0;
        return [
          `SOURCE ORDER (REPRODUCED): the covered claim set is ${coveredSetInvariant ? 'INVARIANT' : 'changed'} ` +
            `across the [A, B] -> [B, A] swap (added [${fmtList(diff.coverageAdded)}], removed ` +
            `[${fmtList(diff.coverageRemoved)}]); scene count ${signed(diff.sceneCountDelta)}, beat count ` +
            `${signed(diff.beatCountDelta)}; ${diff.structureChangedScenes}/${diff.structureChangedScenes + diff.structureUnchangedScenes} ` +
            `common scenes changed structure and ${diff.svgChangedScenes}/${diff.svgChangedScenes + diff.svgIdenticalScenes} ` +
            `changed rendered SVGs; plan fingerprint ${diff.planFingerprintEqual ? 'IDENTICAL' : 'CHANGED'}.`,
          `ORDER CHANNELS (REPRODUCED): the coupling surfaces through exactly the two predicted channels — ` +
            `the primary-source selection (the opening beat retitles from source A\u2019s title to source B\u2019s ` +
            `label when B is ingested first) and the equal-salience seeded ranking (mid-narrative scene anchors ` +
            `reshuffle); the beat/scene ORDER itself is invariant across the swap, so no scene-reordering ` +
            `coupling was observed (the falsifier\u2019s strict-independence clause holds for order, weakened for ` +
            `plan content).`,
        ];
      },
      invariants: [
        'Both arms split the SAME raw fixture at the SAME marker and run the identical chain, seeds, ' +
          'fixed now and planId; only the ingestion order differs (one variable).',
      ],
    },
  ],
  [
    'EXP-V-06',
    {
      hypothesis:
        'Removing a source drops that source\u2019s claims, entities and topics from the graph and the ' +
        'plan recombines around the survivors: scenes anchored on removed claims disappear or recombine ' +
        '(none survives unchanged), the coverage map re-accounts every removed claim, and the duration ' +
        'budget redistributes to the remaining source\u2019s claims.',
      confidence: 'high',
      next_experiment:
        'TL-side design decision (no queued lab arm): removal-driven re-planning locality — whether a ' +
        'source removal could re-key only the affected beats/scenes instead of the full-plan ' +
        'recombination observed here (a Director/plan-cache design question).',
      layer: 'storyboard (the W1 unblock re-run; scene SVG set = the pinned determinism layer)',
      status: (result) => {
        const diff = removalDiffOf(result);
        // Falsifier: a scene surviving UNCHANGED despite its anchor claims
        // disappearing (stale grounding) refutes plan-authoritative
        // recombination.
        return diff.structureUnchangedScenes === 0 ? 'supported' : 'refuted';
      },
      verdictLines: (result) => {
        const diff = removalDiffOf(result);
        const graph = removalGraphDiffOf(result);
        const dropped = graph.claimsRemoved.length - graph.claimsAdded.length;
        return [
          `SOURCE REMOVAL (REPRODUCED): removing source-note-b drops ${dropped} claims, ` +
            `${graph.entitiesRemoved.length} entities and ${graph.topicsRemoved.length} topics from the ` +
            `graph (topics removed: [${fmtList(graph.topicsRemoved)}]); scenes ` +
            `${signed(diff.sceneCountDelta)}, beats ${signed(diff.beatCountDelta)}; ` +
            `${diff.structureChangedScenes}/${diff.structureChangedScenes + diff.structureUnchangedScenes} common ` +
            `scenes recombined (${diff.structureUnchangedScenes} survived unchanged — the falsifier ` +
            `${diff.structureUnchangedScenes === 0 ? 'did NOT fire' : 'FIRED'}); ` +
            `${diff.svgChangedScenes}/${diff.svgChangedScenes + diff.svgIdenticalScenes} changed rendered SVGs.`,
          `ID-RENAME TRUTH (REPRODUCED): the id-level diff overstates churn — claim ids are namespaced per ` +
            `source in the two-source baseline (claim-source-note-a/b-*) and unprefixed in the single-source ` +
            `control, so ${graph.claimsRemoved.length} ids are "removed" and ${graph.claimsAdded.length} ` +
            `"added"; content-level the control is exactly source A\u2019s ${graph.claimsAdded.length} claims ` +
            `(B\u2019s ${dropped} disappear). Coverage re-accounts: the control covers ` +
            `${fmtList(diff.coverageAdded)} (A\u2019s claims under their unprefixed ids — deeper A coverage as ` +
            `the 180 s budget redistributes) vs the baseline\u2019s namespaced set, and loses ` +
            `[${fmtList(diff.coverageRemoved)}].`,
        ];
      },
      invariants: [
        'The two-source baseline and the single-source control run the identical chain, seeds, fixed now ' +
          'and planId; only the source set differs ([A, B] -> [A] — one variable).',
        'No partial run: BOTH arms of the comparison executed (the blocked-era note that the removal diff ' +
          'had no control arm is superseded by this re-run).',
      ],
    },
  ],
]);

function signed(value: number): string {
  return `${value >= 0 ? '+' : ''}${value}`;
}

// ---------------------------------------------------------------------------
// Record assembly (ALL protocol fields, template order)
// ---------------------------------------------------------------------------

export interface RecordSpec {
  readonly id: string;
  readonly timestamp_utc: string;
  readonly operator: string;
  readonly surface: string;
  readonly reference_notebook: string;
  readonly source_fingerprint: string;
  readonly selected_sources: readonly string[];
  readonly format: string;
  readonly language: string;
  readonly length: string;
  readonly visual_style: string;
  readonly custom_prompt: string;
  readonly other_config: Record<string, string | number | boolean | readonly string[]>;
  readonly baseline_artifact: string;
  readonly mutation: string;
  readonly artifact_under_test: string;
  readonly artifact_hash: string;
  readonly observations: readonly string[];
  readonly invariants: readonly string[];
  readonly differences: readonly string[];
  readonly hypothesis: string;
  readonly confidence: string;
  readonly falsifier: string;
  readonly next_experiment: string;
  readonly status: string;
  readonly evidence_paths: readonly string[];
}

function audioArtifactHash(result: ExperimentResult): string {
  const arms = result.arms;
  const baseline = arms[0]?.metrics as unknown as AudioRunMetrics | undefined;
  const variant = arms[arms.length - 1]?.metrics as unknown as AudioRunMetrics | undefined;
  if (baseline === undefined || variant === undefined) return '';
  return (
    `${baseline.artifactMediaSha256} (baseline ${baseline.artifactId}) vs ` +
    `${variant.artifactMediaSha256} (variant ${variant.artifactId}); full sha256 in ` +
    `${arms[0]?.artifactDir}/artifact.json`
  );
}

function videoArtifactHash(result: ExperimentResult): string {
  const arms = result.arms;
  const baseline = arms[0]?.metrics as unknown as VideoRunMetrics | undefined;
  const variant = arms[arms.length - 1]?.metrics as unknown as VideoRunMetrics | undefined;
  if (baseline === undefined || variant === undefined) return '';
  return (
    `scene-SVG combined sha256 (pinned determinism layer) ${baseline.svgCombinedSha256} (baseline) vs ` +
    `${variant.svgCombinedSha256} (variant); MP4 not composed at this layer — see determinism.json per arm`
  );
}

function dualArtifactHash(result: ExperimentResult): string {
  const comparison = result.dualModalityComparison;
  if (comparison === null) return '';
  return (
    `audio media sha256 ${comparison.audio.artifactMediaSha256} (${comparison.audio.artifactId}) vs ` +
    `video composition content fingerprint ${comparison.video.mp4ContentFingerprint} ` +
    `(${comparison.video.artifactId}); scene-SVG combined ` +
    `sha256 ${comparison.video.svgCombinedSha256}; full hashes in each arm's artifact sidecars`
  );
}

export function assembleRecord(config: ExperimentConfig, result: ExperimentResult): RecordSpec {
  const isAudio = config.surface === 'audio';
  // WFLX-V3A record flip: the flipped experiments are NOT blocked anymore —
  // their authored status in configs.ts stays 'blocked' (byte-unchanged per
  // the HANDOFF law); the flip overlay supplies the re-run verdicts.
  const flip = RECORD_FLIPS.get(config.id) ?? null;
  const isBlocked = flip === null && config.authored.status === 'blocked';
  const computedObservations: string[] = [
    ...(isAudio ? audioMetricObservations(result) : []),
    ...(config.surface === 'video' ? videoMetricObservations(result) : []),
    ...graphObservations(result.graphDiff),
    ...dualModalityObservations(result.dualModalityComparison),
    ...blockedObservations(result),
  ];
  const computedInvariants: string[] = [
    `Runner ${RUNNER_PATH_VALUE} executed this experiment with pinned seeds and a fixed now ` +
      `(determinism spine); records render as a pure function of the measured results.`,
  ];
  const computedDifferences: string[] = [];
  for (const diff of result.audioDiffs) {
    computedDifferences.push(
      `${diff.variant} vs ${diff.baselineRunId}: turns ${signed(diff.turnCountDelta)}, beats ` +
        `${signed(diff.beatCountDelta)}, coverage added [${fmtList(diff.coverageAdded)}] removed ` +
        `[${fmtList(diff.coverageRemoved)}], structure changed ${diff.structureChangedTurns}/` +
        `${diff.structureChangedTurns + diff.structureUnchangedTurns}, texts identical ` +
        `${diff.textIdenticalTurns}/${diff.textIdenticalTurns + diff.textChangedTurns}, turn-seconds ` +
        `${signed(diff.totalTurnSecondsDelta)}, wps ${signed(round3(diff.wordsPerSecondMeanDelta))}.`,
    );
  }
  for (const diff of result.videoDiffs) {
    computedDifferences.push(
      `${diff.variant} vs ${diff.baselineRunId}: scenes ${signed(diff.sceneCountDelta)}, beats ` +
        `${signed(diff.beatCountDelta)}, coverage added [${fmtList(diff.coverageAdded)}] removed ` +
        `[${fmtList(diff.coverageRemoved)}], structure changed ${diff.structureChangedScenes}/` +
        `${diff.structureChangedScenes + diff.structureUnchangedScenes}, scene SVGs changed ` +
        `${diff.svgChangedScenes}/${diff.svgChangedScenes + diff.svgIdenticalScenes}, scene-seconds ` +
        `${signed(diff.totalSceneSecondsDelta)}, plan fingerprint ` +
        `${diff.planFingerprintEqual ? 'identical' : 'changed'}.`,
    );
  }
  if (result.graphDiff !== null) {
    const g = result.graphDiff;
    computedDifferences.push(
      `graph: ${g.claimsChanged.length} claim statement(s) changed [${fmtList(g.claimsChanged)}], ` +
        `${g.claimsAdded.length} added, ${g.claimsRemoved.length} removed.`,
    );
  }
  if (result.dualModalityComparison !== null) {
    const c = result.dualModalityComparison;
    computedDifferences.push(
      `audio vs video (same source/seed/duration): turns ${c.audio.turnCount} vs scenes ` +
        `${c.video.sceneCount}; covered claim sets ` +
        `${c.sharedSpine.coveredClaimSetsEqual ? 'identical' : 'differ'}; turn-cited vs scene-cited ` +
        `${c.sharedSpine.citedSetsEqual ? 'identical' : 'differ'}; qa ${c.audio.qaStatus} vs ` +
        `${c.video.qaStatus}.`,
    );
  }

  return {
    id: config.id,
    timestamp_utc: EXP_RECORD_TIMESTAMP,
    operator: EXP_OPERATOR,
    surface: config.surface,
    reference_notebook: config.reference_notebook,
    source_fingerprint: config.source_fingerprint,
    selected_sources: config.selected_sources,
    format: config.format,
    language: config.language,
    length: config.length,
    visual_style: config.visual_style,
    custom_prompt: config.custom_prompt,
    other_config: {
      runner: RUNNER_PATH_VALUE,
      configs: 'tools/experiments/configs.ts',
      ...config.otherConfig,
      ...(flip !== null
        ? { layer: flip.layer, w1_fix_commit: W1_FIX_COMMIT }
        : {}),
    },
    baseline_artifact: isBlocked ? '' : (result.arms[0]?.artifactDir ?? ''),
    mutation: config.mutation,
    artifact_under_test: isBlocked
      ? ''
      : (result.arms[result.arms.length - 1]?.artifactDir ?? ''),
    artifact_hash: isBlocked
      ? ''
      : isAudio
        ? audioArtifactHash(result)
        : result.dualModalityComparison !== null
          ? dualArtifactHash(result)
          : videoArtifactHash(result),
    observations: [
      ...(flip !== null ? [SUPERSEDED_NOTE] : []),
      ...computedObservations,
      ...(flip !== null ? flip.verdictLines(result) : []),
      ...(flip === null ? config.authored.observations : []),
    ],
    invariants: [
      ...computedInvariants,
      ...(flip !== null ? flip.invariants : config.authored.invariants),
    ],
    differences: computedDifferences,
    hypothesis: flip !== null ? flip.hypothesis : config.authored.hypothesis,
    confidence: flip !== null ? flip.confidence : config.authored.confidence,
    falsifier: config.authored.falsifier,
    next_experiment: flip !== null ? flip.next_experiment : config.authored.next_experiment,
    status: flip !== null ? flip.status(result) : config.authored.status,
    evidence_paths: [
      ...result.arms.map((arm) => arm.artifactDir),
      'artifacts/experiments/summary.json',
      'artifacts/experiments/evidence-entries.jsonl',
      RUNNER_PATH_VALUE,
      'tools/experiments/configs.ts',
      ...(config.series === 'exp-a-r2'
        ? [`docs/experiments/records/${config.matrixEntry}.yaml (pre-fix EV-006 predecessor)`]
        : []),
      ...(config.id === 'EXP-D-01' ? ['artifacts/manifest/registry.json (wave-1 unified registry)'] : []),
    ],
  };
}

// ---------------------------------------------------------------------------
// Deterministic YAML rendering (template field order; hand-rolled emitter —
// the record schema is fixed and the repo carries no yaml dependency)
// ---------------------------------------------------------------------------

function yamlScalar(value: string | number | boolean | readonly string[]): string {
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value !== 'string') {
    const items = value as readonly string[];
    return `[${items.map((item) => quote(item)).join(', ')}]`;
  }
  return quote(value);
}

export function renderRecordYaml(record: RecordSpec): string {
  const lines: string[] = [];
  lines.push(`id: ${record.id}`);
  lines.push(`timestamp_utc: ${quote(record.timestamp_utc)}`);
  lines.push(`operator: ${record.operator}`);
  lines.push(`surface: ${record.surface}`);
  lines.push(`reference_notebook: ${quote(record.reference_notebook)}`);
  lines.push(`source_fingerprint: ${record.source_fingerprint}`);
  lines.push(`selected_sources: ${yamlScalar(record.selected_sources)}`);
  lines.push(`format: ${quote(record.format)}`);
  lines.push(`language: ${quote(record.language)}`);
  lines.push(`length: ${quote(record.length)}`);
  lines.push(`visual_style: ${quote(record.visual_style)}`);
  lines.push(`custom_prompt: ${quote(record.custom_prompt)}`);
  lines.push('other_config:');
  const configKeys = Object.keys(record.other_config).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  for (const key of configKeys) {
    lines.push(`  ${key}: ${yamlScalar(record.other_config[key] ?? '')}`);
  }
  lines.push(`baseline_artifact: ${quote(record.baseline_artifact)}`);
  lines.push(`mutation: ${quote(record.mutation)}`);
  lines.push(`artifact_under_test: ${quote(record.artifact_under_test)}`);
  lines.push(`artifact_hash: ${quote(record.artifact_hash)}`);
  lines.push('observations:');
  for (const item of record.observations) lines.push(`  - ${quote(item)}`);
  lines.push('invariants:');
  for (const item of record.invariants) lines.push(`  - ${quote(item)}`);
  lines.push('differences:');
  for (const item of record.differences) lines.push(`  - ${quote(item)}`);
  lines.push(`hypothesis: ${quote(record.hypothesis)}`);
  lines.push(`confidence: ${record.confidence}`);
  lines.push(`falsifier: ${quote(record.falsifier)}`);
  lines.push(`next_experiment: ${quote(record.next_experiment)}`);
  lines.push(`status: ${record.status}`);
  lines.push('evidence_paths:');
  for (const item of record.evidence_paths) lines.push(`  - ${quote(item)}`);
  return `${lines.join('\n')}\n`;
}

// ---------------------------------------------------------------------------
// Evidence registry entries (docs/evidence/registry.jsonl-compatible shape:
// every field the registry lines carry, key-sorted on render)
// ---------------------------------------------------------------------------

export interface EvidenceEntry {
  readonly id: string;
  readonly timestamp_utc: string;
  readonly operator: string;
  readonly surface: string;
  readonly evidence_kind: string;
  readonly artifact_hash: string;
  readonly artifact_id: string;
  readonly observations: readonly string[];
  readonly invariants: readonly string[];
  readonly differences: readonly string[];
  readonly hypothesis: string;
  readonly confidence: string;
  readonly status: string;
  readonly evidence_paths: readonly string[];
}

export function renderEvidenceEntry(
  config: ExperimentConfig,
  record: RecordSpec,
  result: ExperimentResult,
): EvidenceEntry {
  const observations: string[] = [
    `${config.id} (${config.surface} surface, matrix entry ${config.matrixEntry}) executed by the ` +
      `WFLX-P3B wave-2 integration experiment runner (${RUNNER_PATH_VALUE}) — seeded, fixed-now, ` +
      `deterministic offline run; record at ${result.recordPath}.`,
  ];
  // The RECORD's status governs (post-flip), not the config's authored status:
  // the flipped experiments carry real results even though configs.ts still
  // says 'blocked' (byte-unchanged per the HANDOFF law).
  if (record.status === 'blocked') {
    observations.push(
      `BLOCKED (OBSERVED, deterministically REPRODUCED): the arm chain fails before the Director — ` +
        `see the EXP-V-05/06 records for the W1 multi-source blocker; no partial result is claimed.`,
    );
  } else {
    for (const observation of record.observations.slice(0, 3)) observations.push(observation);
    if (record.differences[0] !== undefined) observations.push(record.differences[0]);
  }
  const artifactId =
    config.series === 'exp-d'
      ? (result.dualModalityComparison?.video.artifactId ?? '')
      : ((result.arms[result.arms.length - 1]?.metrics as unknown as { artifactId?: string | null })
          ?.artifactId ?? '');
  return {
    id: config.id,
    timestamp_utc: EXP_RECORD_TIMESTAMP,
    operator: EXP_OPERATOR,
    surface: config.surface,
    evidence_kind: 'lab-reproduction',
    artifact_hash: record.artifact_hash.split(' ')[0] ?? '',
    artifact_id: artifactId ?? '',
    observations,
    invariants: record.invariants,
    differences: record.differences,
    hypothesis: record.hypothesis,
    confidence: record.confidence,
    status:
      record.status === 'blocked'
        ? 'blocked'
        : record.status === 'supported'
          ? 'reproduced'
          : record.status,
    evidence_paths: record.evidence_paths,
  };
}

/** Compact registry.jsonl-style line (key-sorted, trailing newline). */
export function renderEvidenceLine(entry: EvidenceEntry): string {
  const keys = Object.keys(entry).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)) as (keyof EvidenceEntry)[];
  const parts = keys.map((key) => `${quote(key)}:${JSON.stringify(entry[key])}`);
  return `{${parts.join(',')}}\n`;
}

export function recordDigestOf(recordYaml: string): string {
  return sha256(recordYaml);
}
