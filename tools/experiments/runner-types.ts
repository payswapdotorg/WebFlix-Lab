/**
 * Shared types + the fixed experiment environment for the integration
 * experiment runner (WFLX-P3B wave 2 — Phase 3 checklist §2 items 4/5/6).
 *
 * Pure declarations — no runtime side effects — so configs, metrics, records
 * and the runner all agree on the arm shapes without import cycles.
 *
 * Determinism spine: every arm pins its seeds and `now` in configs.ts;
 * identical inputs must produce identical outputs AND identical records.
 */

import type {
  OverviewPlan,
  SemanticGraph,
  UtcTimestamp,
} from '../../src/contracts';
import type { DirectorRequest } from '../../src/director/compiler';
import type { Timeline } from '../../src/compositor/timeline';
import type { PlaceholderNarrationResult } from '../../src/compositor/narration-audio';
import type { CompileVideoScenesResult } from '../../src/video';
import type { RenderStoryboardResult } from '../../src/video/render/renderer';
import type { VideoQaReport } from '../../src/video/qa/report';
import type { StyleBible } from '../../src/video/style-bible';

export type { StyleBible };

// ---------------------------------------------------------------------------
// Fixed experiment environment (determinism spine — same values every run)
// ---------------------------------------------------------------------------

/** Fixed timestamp for ALL R2/EXP-V/EXP-D sidecars, records and the summary. */
export const EXP_NOW: UtcTimestamp = '2026-09-30T00:00:00Z';

/** Fixed record timestamp (protocol field; deterministic, never wall-clock). */
export const EXP_RECORD_TIMESTAMP = '2026-09-30T00:00:00Z';

/** Operator identity for wave-2 records. */
export const EXP_OPERATOR = 'wflx-p3b-exp';

/** Audio surface seed for the EXP-A R2 series (mirrors the EV-006 series). */
export const EXP_A_AUDIO_SEED = 'wflx-exp-a-audio-seed';

/** Director seed for the EXP-A R2 series (mirrors the EV-006 series). */
export const EXP_A_DIRECTOR_SEED = 'wflx-exp-a-director-seed';

/** Director seed for the EXP-V series. */
export const EXP_V_DIRECTOR_SEED = 'wflx-exp-v-director-seed';

/** Video surface (storyboard) seed for the EXP-V series. */
export const EXP_V_VIDEO_SEED = 'wflx-exp-v-video-seed';

/** Alternate seeds for the EXP-V-08 stochastic-stream ablation. */
export const EXP_V_DIRECTOR_SEED_B = 'wflx-exp-v-director-seed-b';
export const EXP_V_VIDEO_SEED_B = 'wflx-exp-v-video-seed-b';

/** One seed for BOTH modalities in the EXP-D dual-modality comparison. */
export const EXP_D_SEED = 'wflx-expint-dual-seed';

/** Canonical fixture files (frozen W1 inputs — never regenerated here). */
export const FIXTURE_SOURCE_FILE = 'fixtures/contracts/reference-messy-note.source-artifact.json';
export const FIXTURE_GRAPH_FILE = 'fixtures/contracts/reference-messy-note.semantic-graph.json';
export const FIXTURE_RAW_NOTE_FILE = 'fixtures/reference-messy-note-redacted.md';
export const FIXTURE_PLAN_BRIEF = 'fixtures/contracts/plan-audio-brief-2min.json';
export const FIXTURE_PLAN_CRITIQUE = 'fixtures/contracts/plan-audio-critique-5min.json';
export const FIXTURE_PLAN_DEBATE = 'fixtures/contracts/plan-audio-debate-5min.json';
export const FIXTURE_PLAN_VIDEO_7MIN = 'fixtures/contracts/plan-video-explainer-7min.json';

/** EXP-A-04 / EXP-V-04 mutation: block b30, the paragraph feeding one claim. */
export const B30_ORIGINAL = 'All credentials are `[REDACTED]`.';
export const B30_MUTATED =
  'All credentials are `[REDACTED]` and are rotated quarterly by the platform team.';

/** EXP-V-05/06 source split marker (raw note split into two sources). */
export const SOURCE_SPLIT_MARKER = '## Section 2 — Infrastructure';

/** EXP-V-03 custom-prompt mutation (style-scoped instruction). */
export const EXP_V_03_PROMPT =
  'Keep the delivery punchy and foreground infrastructure reliability.';

// ---------------------------------------------------------------------------
// Storyboard-layer video run result (pre-composition; the pinned
// determinism layer per artifacts/video/README.md)
// ---------------------------------------------------------------------------

export interface CompileVideoStoryboardResult {
  readonly plan: OverviewPlan;
  readonly graph: SemanticGraph;
  readonly compiled: CompileVideoScenesResult;
  readonly renderA: RenderStoryboardResult;
  /** Second render for the in-arm SVG determinism proof (hashA === hashB). */
  readonly renderB: RenderStoryboardResult;
  readonly timeline: Timeline;
  readonly narration: PlaceholderNarrationResult;
  /** Narration segment count (one per scene by construction). */
  readonly narrationSpecCount: number;
  readonly qa: VideoQaReport;
}

// ---------------------------------------------------------------------------
// Arm specifications (what configs declare; the runner interprets)
// ---------------------------------------------------------------------------

/** Director request over the canonical fixture source + graph. */
export interface CanonicalRequestBase extends Omit<DirectorRequest, 'planId' | 'sources' | 'graph'> {
  readonly modality: DirectorRequest['modality'];
}

/** Audio arm: canonical fixtures -> Director -> full W2 audio pipeline. */
export interface AudioDirectorArm {
  readonly kind: 'audio-director';
  readonly runId: string;
  readonly experiment: string;
  readonly artifactId: string;
  readonly planId: string;
  readonly request: CanonicalRequestBase;
}

/** Audio arm over a frozen W1 plan fixture (canonical per-mode plans). */
export interface AudioCanonicalPlanArm {
  readonly kind: 'audio-canonical-plan';
  readonly runId: string;
  readonly experiment: string;
  readonly artifactId: string;
  readonly planFile: string;
}

/**
 * Audio arm through the fresh chain (MarkdownNoteAdapter ->
 * DeterministicExtractor -> Director -> audio), optionally with the b30
 * paragraph mutated — the EXP-A-04 control/mutation pair shape.
 */
export interface AudioFreshChainArm {
  readonly kind: 'audio-fresh-chain';
  readonly runId: string;
  readonly experiment: string;
  readonly artifactId: string;
  readonly planId: string;
  readonly request: CanonicalRequestBase;
  readonly mutation?: { readonly original: string; readonly mutated: string };
}

/** Video arm: canonical fixtures -> Director -> storyboard layer. */
export interface VideoDirectorArm {
  readonly kind: 'video-director';
  readonly runId: string;
  readonly experiment: string;
  readonly planId: string;
  readonly request: CanonicalRequestBase;
  /** Storyboard-layer seed override (defaults to EXP_V_VIDEO_SEED). */
  readonly surfaceSeed?: string;
  /** Explicit StyleBible override for compileVideoScenes (EXP-V-02). */
  readonly styleBible?: StyleBible;
}

/** Video arm over a frozen plan fixture with optional style-bible override. */
export interface VideoCanonicalPlanArm {
  readonly kind: 'video-canonical-plan';
  readonly runId: string;
  readonly experiment: string;
  readonly planFile: string;
  readonly surfaceSeed?: string;
  readonly styleBible?: StyleBible;
}

/** Video arm through the fresh chain (optionally b30-mutated) — EXP-V-04. */
export interface VideoFreshChainArm {
  readonly kind: 'video-fresh-chain';
  readonly runId: string;
  readonly experiment: string;
  readonly planId: string;
  readonly request: CanonicalRequestBase;
  readonly mutation?: { readonly original: string; readonly mutated: string };
  readonly surfaceSeed?: string;
  /** Explicit StyleBible override for compileVideoScenes. */
  readonly styleBible?: StyleBible;
}

/** Blocked arm: two-source chain expected to fail (W1 blocker; EXP-V-05/06). */
export interface VideoBlockedArm {
  readonly kind: 'video-blocked';
  readonly runId: string;
  readonly experiment: string;
  readonly expectedBlocker: string;
}

/** Dual-modality full audio arm (W2 pipeline; artifacts/audio/exp-d/). */
export interface DualAudioArm {
  readonly kind: 'dual-audio';
  readonly runId: string;
  readonly experiment: string;
  readonly artifactId: string;
  readonly planId: string;
  readonly request: CanonicalRequestBase;
}

/** Dual-modality FULL video arm (composition included; media fingerprint-only). */
export interface DualVideoArm {
  readonly kind: 'dual-video';
  readonly runId: string;
  readonly experiment: string;
  readonly planId: string;
  readonly request: CanonicalRequestBase;
}

export type ArmSpec =
  | AudioDirectorArm
  | AudioCanonicalPlanArm
  | AudioFreshChainArm
  | VideoDirectorArm
  | VideoCanonicalPlanArm
  | VideoFreshChainArm
  | VideoBlockedArm
  | DualAudioArm
  | DualVideoArm;

// ---------------------------------------------------------------------------
// Experiment config (the seeded experiment config the runner executes)
// ---------------------------------------------------------------------------

/** Authored protocol fields (judgment, not computation). */
export interface AuthoredFields {
  readonly hypothesis: string;
  readonly confidence: 'low' | 'medium' | 'high';
  readonly falsifier: string;
  readonly next_experiment: string;
  readonly status: string;
  /** Authored invariants (appended after computed ones). */
  readonly invariants: readonly string[];
  /** Authored observations (appended after computed ones; must carry labels). */
  readonly observations: readonly string[];
}

export interface ExperimentConfig {
  /** Record id, e.g. 'EXP-A-04-R2' or 'EXP-V-01'. */
  readonly id: string;
  /** Matrix entry this experiment belongs to (docs/experiments/matrix.md). */
  readonly matrixEntry: string;
  /** Artifact series root segment under artifacts/<surface>/. */
  readonly series: 'exp-a-r2' | 'exp-v' | 'exp-d';
  readonly surface: 'audio' | 'video' | 'cross-modal';
  readonly reference_notebook: string;
  readonly source_fingerprint: string;
  readonly selected_sources: readonly string[];
  readonly format: string;
  readonly language: string;
  readonly length: string;
  readonly visual_style: string;
  readonly custom_prompt: string;
  readonly mutation: string;
  /** Extra deterministic fields merged into other_config. */
  readonly otherConfig: Record<string, string | number | boolean | readonly string[]>;
  /** Baseline arm FIRST; variants after (the runner diffs arms[1..] vs arms[0]). */
  readonly arms: readonly ArmSpec[];
  readonly authored: AuthoredFields;
}

// ---------------------------------------------------------------------------
// Persisted per-arm data files (artifacts/experiments/arms/<runId>.json)
// ---------------------------------------------------------------------------

export interface AudioArmData {
  readonly kind: 'audio';
  readonly runId: string;
  readonly experiment: string;
  readonly artifactDir: string;
  readonly metrics: Record<string, unknown>;
  /** Realized turn texts for the diff phase (memory discipline: nothing heavy). */
  readonly realizedTexts: readonly string[];
  readonly audioQaMetrics: Record<string, string>;
}

export interface VideoArmData {
  readonly kind: 'video';
  readonly runId: string;
  readonly experiment: string;
  readonly artifactDir: string;
  readonly metrics: Record<string, unknown>;
  /** Per-scene SVG sha256 for cross-arm frame comparison. */
  readonly perSceneSvgSha256: readonly { readonly sceneId: string; readonly sha256: string }[];
  readonly videoQaMetrics: Record<string, string>;
  readonly svgDeterminismProof: { readonly hashA: string; readonly hashB: string; readonly byteIdentical: boolean };
}

export interface VideoBlockedArmData {
  readonly kind: 'video-blocked';
  readonly runId: string;
  readonly experiment: string;
  readonly artifactDir: string;
  readonly blocker: string;
  readonly blockerDetail: readonly string[];
}

export interface DualVideoArmData {
  readonly kind: 'dual-video';
  readonly runId: string;
  readonly experiment: string;
  readonly artifactDir: string;
  readonly metrics: Record<string, unknown>;
  readonly videoQaMetrics: Record<string, string>;
  readonly determinismProof: { readonly hashA: string; readonly hashB: string | null };
  /**
   * Deterministic composition content fingerprint (sha256 over the media
   * structure + scene-SVG combined hash + plan id + seed). The RAW MP4 byte
   * hash/size are encoder-nondeterministic across invocations (OBSERVED
   * 2026-09-29: identical inputs, same environment, differing hashes) and are
   * deliberately NOT recorded in any committed output — artifact.json keeps
   * the surface-emitted single-run snapshot and is excluded from the
   * output-set digest.
   */
  readonly mp4ContentFingerprint: string;
}

export type ArmData = AudioArmData | VideoArmData | VideoBlockedArmData | DualVideoArmData;
