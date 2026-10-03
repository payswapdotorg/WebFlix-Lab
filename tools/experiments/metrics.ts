/**
 * Deterministic metric + diff extraction for the integration experiment
 * runner (WFLX-P3B wave 2 — Phase 3 checklist §2 items 4/5/6).
 *
 * Audio metrics mirror the ESTABLISHED run-exp-a.ts RunMetrics shape
 * (experiments/run-exp-a.ts) so the EXP-A R2 numbers are directly comparable
 * with the EV-006 series; video metrics follow the protocol's video
 * differential list (docs/experiments/protocol.md) restricted to
 * deterministic measures only (no wall-clock anywhere).
 *
 * Pure computation over pipeline results — no I/O, no clock. Consumes
 * worker-owned trees (src/audio, src/video) read-only.
 */

import { createHash } from 'node:crypto';
import type { AudioOverviewResult } from '../../src/audio';
import { stableStringify } from '../../src/audio';
import type { AudioQaReport } from '../../src/audio/qa/report';
import { planHashOf as videoPlanHashOf } from '../../src/video';
import type { VideoQaReport } from '../../src/video';
import type { CompileVideoStoryboardResult } from './runner-types';
import type { OverviewPlan, SemanticGraph, VideoScene } from '../../src/contracts';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Binary-safe sha256: hashes raw bytes for Uint8Array inputs (the narration
 * WAV fingerprint must be the actual sha256 of the WAV bytes, never a
 * re-encoded-string hash), raw UTF-8 for strings. */
export function sha256(data: string | Uint8Array): string {
  return createHash('sha256').update(data).digest('hex');
}

function inc(map: Record<string, number>, key: string): void {
  map[key] = (map[key] ?? 0) + 1;
}

export function qaIssuesByCode(qa: { readonly issues: readonly { code: string }[] }): Record<string, number> {
  const map: Record<string, number> = {};
  for (const issue of qa.issues) inc(map, issue.code);
  return map;
}

export function qaMetricsById(
  metrics: readonly { readonly metric: string; readonly value: string }[],
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const metric of metrics) map[metric.metric] = metric.value;
  return map;
}

// ---------------------------------------------------------------------------
// Audio metrics (mirrors experiments/run-exp-a.ts RunMetrics)
// ---------------------------------------------------------------------------

export interface AudioRunMetrics {
  readonly runId: string;
  readonly experiment: string;
  readonly planId: string;
  readonly mode: string;
  readonly language: string;
  readonly targetDurationSeconds: number;
  readonly planFingerprint: string;
  readonly artifactId: string;
  readonly artifactMediaSha256: string;
  readonly graphClaimCount: number;
  readonly beatCount: number;
  readonly turnCount: number;
  readonly speakers: readonly string[];
  readonly purposeHistogram: Record<string, number>;
  readonly coveredClaimIds: readonly string[];
  readonly omittedClaimCount: number;
  readonly coverageFraction: number;
  readonly totalTargetSeconds: number;
  readonly totalTurnSeconds: number;
  readonly gapsTotalMs: number;
  readonly wordsTotal: number;
  readonly wordsPerSecondMean: number;
  readonly overBudgetTurns: number;
  readonly qaStatus: string;
  readonly qaIssuesByCode: Record<string, number>;
}

export function audioMetricsFor(
  runId: string,
  experiment: string,
  result: AudioOverviewResult,
  graph: SemanticGraph,
): AudioRunMetrics {
  const { plan, qa, timing, realized } = result;
  const purposeHistogram: Record<string, number> = {};
  const speakers = new Set<string>();
  for (const turn of plan.audioTurns) {
    inc(purposeHistogram, turn.purpose);
    speakers.add(turn.speaker);
  }
  const covered = plan.coverage.covered.map((entry) => entry.claimId);
  const wordsTotal = realized.reduce((sum, turn) => sum + turn.wordCount, 0);
  return {
    runId,
    experiment,
    planId: plan.id,
    mode: plan.mode,
    language: plan.language,
    targetDurationSeconds: plan.targetDurationSeconds,
    planFingerprint: sha256(stableStringify(plan)),
    artifactId: result.artifact.id,
    artifactMediaSha256: result.artifact.media.sha256,
    graphClaimCount: graph.claims.length,
    beatCount: plan.beats.length,
    turnCount: plan.audioTurns.length,
    speakers: [...speakers].sort(),
    purposeHistogram,
    coveredClaimIds: [...covered].sort(),
    omittedClaimCount: plan.coverage.omitted.length,
    coverageFraction: covered.length / graph.claims.length,
    totalTargetSeconds: timing.totalTargetSeconds,
    totalTurnSeconds: timing.totalTurnSeconds,
    gapsTotalMs: timing.gapsTotalMs,
    wordsTotal,
    wordsPerSecondMean: timing.totalTurnSeconds > 0 ? wordsTotal / timing.totalTurnSeconds : 0,
    overBudgetTurns: realized.filter((turn) => turn.overBudget).length,
    qaStatus: qa.status,
    qaIssuesByCode: qaIssuesByCode(qa),
  };
}

/** Turn-level structural signature: everything except realized surface text. */
export function audioTurnStructureSignature(turn: OverviewPlan['audioTurns'][number]): string {
  return JSON.stringify([
    turn.speaker,
    turn.speakerRole,
    turn.purpose,
    [...turn.claimIds].sort(),
    turn.beatId ?? null,
    turn.targetDurationSeconds,
  ]);
}

export interface AudioRunDiff {
  readonly variant: string;
  readonly baselineRunId: string;
  readonly turnCountDelta: number;
  readonly beatCountDelta: number;
  readonly coverageAdded: readonly string[];
  readonly coverageRemoved: readonly string[];
  readonly totalTurnSecondsDelta: number;
  readonly wordsPerSecondMeanDelta: number;
  readonly structureChangedTurns: number;
  readonly structureUnchangedTurns: number;
  readonly textIdenticalTurns: number;
  readonly textChangedTurns: number;
}

export interface AudioSlimResult {
  readonly plan: OverviewPlan;
  readonly realized: readonly { readonly text: string }[];
}

export function diffAudioRuns(
  baseline: AudioRunMetrics,
  variant: AudioRunMetrics,
  baselineResult: AudioSlimResult,
  variantResult: AudioSlimResult,
): AudioRunDiff {
  const n = Math.min(baselineResult.plan.audioTurns.length, variantResult.plan.audioTurns.length);
  let structureChanged = 0;
  let textIdentical = 0;
  for (let i = 0; i < n; i++) {
    const a = baselineResult.plan.audioTurns[i];
    const b = variantResult.plan.audioTurns[i];
    if (a === undefined || b === undefined) continue;
    if (audioTurnStructureSignature(a) !== audioTurnStructureSignature(b)) structureChanged += 1;
    const ra = baselineResult.realized[i];
    const rb = variantResult.realized[i];
    if (ra !== undefined && rb !== undefined && ra.text === rb.text) textIdentical += 1;
  }
  const baselineCovered = new Set(baseline.coveredClaimIds);
  const variantCovered = new Set(variant.coveredClaimIds);
  return {
    variant: variant.runId,
    baselineRunId: baseline.runId,
    turnCountDelta: variant.turnCount - baseline.turnCount,
    beatCountDelta: variant.beatCount - baseline.beatCount,
    coverageAdded: variant.coveredClaimIds.filter((id) => !baselineCovered.has(id)),
    coverageRemoved: baseline.coveredClaimIds.filter((id) => !variantCovered.has(id)),
    totalTurnSecondsDelta: Math.round((variant.totalTurnSeconds - baseline.totalTurnSeconds) * 100) / 100,
    wordsPerSecondMeanDelta:
      Math.round((variant.wordsPerSecondMean - baseline.wordsPerSecondMean) * 1000) / 1000,
    structureChangedTurns: structureChanged,
    structureUnchangedTurns: n - structureChanged,
    textIdenticalTurns: textIdentical,
    textChangedTurns: n - textIdentical,
  };
}

// ---------------------------------------------------------------------------
// Graph diff (mutation locality at the semantic layer)
// ---------------------------------------------------------------------------

export interface GraphDiff {
  readonly claimsChanged: readonly string[];
  readonly claimsAdded: readonly string[];
  readonly claimsRemoved: readonly string[];
  readonly entitiesAdded: readonly string[];
  readonly entitiesRemoved: readonly string[];
  readonly topicsAdded: readonly string[];
  readonly topicsRemoved: readonly string[];
}

export function diffGraphs(baseline: SemanticGraph, variant: SemanticGraph): GraphDiff {
  const baseClaims = new Map(baseline.claims.map((c) => [c.id, c.statement]));
  const varClaims = new Map(variant.claims.map((c) => [c.id, c.statement]));
  const claimsChanged: string[] = [];
  for (const [id, statement] of baseClaims) {
    const other = varClaims.get(id);
    if (other !== undefined && other !== statement) claimsChanged.push(id);
  }
  const baseEntities = new Set(baseline.entities.map((e) => e.name));
  const varEntities = new Set(variant.entities.map((e) => e.name));
  const baseTopics = new Set(baseline.topics.map((t) => t.title));
  const varTopics = new Set(variant.topics.map((t) => t.title));
  return {
    claimsChanged,
    claimsAdded: [...varClaims.keys()].filter((id) => !baseClaims.has(id)),
    claimsRemoved: [...baseClaims.keys()].filter((id) => !varClaims.has(id)),
    entitiesAdded: [...varEntities].filter((name) => !baseEntities.has(name)),
    entitiesRemoved: [...baseEntities].filter((name) => !varEntities.has(name)),
    topicsAdded: [...varTopics].filter((title) => !baseTopics.has(title)),
    topicsRemoved: [...baseTopics].filter((title) => !varTopics.has(title)),
  };
}

// ---------------------------------------------------------------------------
// Video metrics (storyboard layer — the pinned determinism layer per
// artifacts/video/README.md: scene SVG set, timeline, narration, QA reports)
// ---------------------------------------------------------------------------

export interface VideoRunMetrics {
  readonly runId: string;
  readonly experiment: string;
  readonly planId: string;
  readonly mode: string;
  readonly language: string;
  readonly targetDurationSeconds: number;
  readonly planFingerprint: string;
  readonly artifactId: string | null;
  readonly artifactMediaSha256: string | null;
  readonly graphClaimCount: number;
  readonly beatCount: number;
  readonly sceneCount: number;
  readonly sceneTypeHistogram: Record<string, number>;
  readonly sceneDurations: readonly number[];
  /** Per-scene structural signatures (id-keyed) for the diff phase. */
  readonly sceneStructures: readonly { readonly sceneId: string; readonly signature: string }[];
  readonly totalSceneSeconds: number;
  readonly timelineDurationSeconds: number;
  readonly narrationSegmentCount: number;
  readonly narrationWavSha256: string;
  readonly coveredClaimIds: readonly string[];
  readonly sceneCitedClaimIds: readonly string[];
  readonly omittedClaimCount: number;
  readonly coverageFraction: number;
  readonly svgCombinedSha256: string;
  readonly svgBytes: number;
  readonly perSceneSvgSha256: readonly { readonly sceneId: string; readonly sha256: string }[];
  readonly compilerIssuesByCode: Record<string, number>;
  readonly qaStatus: string;
  readonly qaIssuesByCode: Record<string, number>;
  readonly styleBibleId: string;
}

/** Scene-level structural signature: everything except rendered surface bytes. */
export function videoSceneStructureSignature(scene: VideoScene): string {
  return JSON.stringify([
    scene.id,
    scene.index,
    scene.beatId,
    scene.visualType,
    scene.renderingClass,
    [...scene.claimIds].sort(),
    scene.targetDurationSeconds,
    scene.motion,
    scene.transition,
  ]);
}

export function videoMetricsFor(
  runId: string,
  experiment: string,
  run: CompileVideoStoryboardResult,
  graph: SemanticGraph,
  artifactId: string | null = null,
  artifactMediaSha256: string | null = null,
): VideoRunMetrics {
  const { plan, compiled, renderA, timeline, qa } = run;
  const sceneTypeHistogram: Record<string, number> = {};
  for (const scene of plan.videoScenes) inc(sceneTypeHistogram, scene.visualType);
  const covered = plan.coverage.covered.map((entry) => entry.claimId);
  const cited = [...new Set(plan.videoScenes.flatMap((s) => s.claimIds))].sort();
  const perSceneSvgSha256 = plan.videoScenes.map((scene) => ({
    sceneId: scene.id,
    sha256: sha256(renderA.frames.get(scene.id) ?? ''),
  }));
  const sceneStructures = compiled.scenes.map((scene) => ({
    sceneId: scene.id,
    signature: videoSceneStructureSignature(scene),
  }));
  return {
    runId,
    experiment,
    planId: plan.id,
    mode: plan.mode,
    language: plan.language,
    targetDurationSeconds: plan.targetDurationSeconds,
    planFingerprint: videoPlanHashOf(plan),
    artifactId,
    artifactMediaSha256,
    graphClaimCount: graph.claims.length,
    beatCount: plan.beats.length,
    sceneCount: plan.videoScenes.length,
    sceneTypeHistogram,
    sceneDurations: plan.videoScenes.map((scene) => scene.targetDurationSeconds),
    sceneStructures,
    totalSceneSeconds: plan.videoScenes.reduce((sum, scene) => sum + scene.targetDurationSeconds, 0),
    timelineDurationSeconds: timeline.durationSeconds,
    narrationSegmentCount: run.narrationSpecCount,
    narrationWavSha256: sha256(run.narration.wav),
    coveredClaimIds: [...covered].sort(),
    sceneCitedClaimIds: cited,
    omittedClaimCount: plan.coverage.omitted.length,
    coverageFraction: covered.length / graph.claims.length,
    svgCombinedSha256: renderA.combinedSha256,
    svgBytes: renderA.renderBytes,
    perSceneSvgSha256,
    compilerIssuesByCode: (() => {
      const map: Record<string, number> = {};
      for (const issue of compiled.issues) inc(map, issue.code);
      return map;
    })(),
    qaStatus: qa.status,
    qaIssuesByCode: qaIssuesByCode(qa),
    styleBibleId: compiled.storyboard.styleBible.id,
  };
}

export interface VideoRunDiff {
  readonly variant: string;
  readonly baselineRunId: string;
  readonly sceneCountDelta: number;
  readonly beatCountDelta: number;
  readonly coverageAdded: readonly string[];
  readonly coverageRemoved: readonly string[];
  readonly totalSceneSecondsDelta: number;
  readonly structureChangedScenes: number;
  readonly structureUnchangedScenes: number;
  readonly svgChangedScenes: number;
  readonly svgIdenticalScenes: number;
  readonly planFingerprintEqual: boolean;
  readonly svgCombinedSha256Equal: boolean;
}

export function diffVideoRuns(
  baseline: VideoRunMetrics,
  variant: VideoRunMetrics,
): VideoRunDiff {
  // Id-keyed comparisons (robust to insertion order): scenes present in both
  // arms are compared pairwise; scenes only in one arm count as changed.
  const baselineStructure = new Map(baseline.sceneStructures.map((e) => [e.sceneId, e.signature]));
  const variantStructure = new Map(variant.sceneStructures.map((e) => [e.sceneId, e.signature]));
  const commonSceneIds = [...baselineStructure.keys()].filter((id) => variantStructure.has(id));
  let structureChanged = 0;
  for (const sceneId of commonSceneIds) {
    if (baselineStructure.get(sceneId) !== variantStructure.get(sceneId)) structureChanged += 1;
  }
  const baselineSvg = new Map(baseline.perSceneSvgSha256.map((e) => [e.sceneId, e.sha256]));
  const variantSvg = new Map(variant.perSceneSvgSha256.map((e) => [e.sceneId, e.sha256]));
  let svgChanged = 0;
  for (const sceneId of commonSceneIds) {
    if (baselineSvg.get(sceneId) !== variantSvg.get(sceneId)) svgChanged += 1;
  }
  const baselineCovered = new Set(baseline.coveredClaimIds);
  const variantCovered = new Set(variant.coveredClaimIds);
  return {
    variant: variant.runId,
    baselineRunId: baseline.runId,
    sceneCountDelta: variant.sceneCount - baseline.sceneCount,
    beatCountDelta: variant.beatCount - baseline.beatCount,
    coverageAdded: variant.coveredClaimIds.filter((id) => !baselineCovered.has(id)),
    coverageRemoved: baseline.coveredClaimIds.filter((id) => !variantCovered.has(id)),
    totalSceneSecondsDelta: variant.totalSceneSeconds - baseline.totalSceneSeconds,
    structureChangedScenes: structureChanged,
    structureUnchangedScenes: commonSceneIds.length - structureChanged,
    svgChangedScenes: svgChanged,
    svgIdenticalScenes: commonSceneIds.length - svgChanged,
    planFingerprintEqual: baseline.planFingerprint === variant.planFingerprint,
    svgCombinedSha256Equal: baseline.svgCombinedSha256 === variant.svgCombinedSha256,
  };
}

// ---------------------------------------------------------------------------
// QA report metric tables (deterministic values only — dual-modality table)
// ---------------------------------------------------------------------------

export function audioQaMetricTable(qa: AudioQaReport): Record<string, string> {
  return qaMetricsById(qa.metrics);
}

export function videoQaMetricTable(qa: VideoQaReport): Record<string, string> {
  return qaMetricsById(qa.metrics);
}
