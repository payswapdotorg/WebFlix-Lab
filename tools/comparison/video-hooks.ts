/**
 * Video hook harness (WFLX-P3 Deliverable C / EV-025).
 *
 * Wires the comparison-record machinery into the existing video experiment
 * runners — EXP-V-S-01 (Short), EXP-V-CIN-01 (Cinematic), EXP-E-REFRESH
 * (Explainer + custom-style + video locality) — REPLACING their ad-hoc
 * product-side pending markers with schema-compliant comparison records fed
 * by the ingested estate:
 *
 *   VIDEO-PARITY-01  Short            <- LAB-07 (control) + LAB-08 (twin) + LAB-09 (custom focus)
 *   VIDEO-PARITY-02  Cinematic        <- scoping truth: NO Cinematic product format exists (LAB-07 UI-truth)
 *   VIDEO-PARITY-03  Explainer        <- the original Explainer reference + scene atlas
 *   VIDEO-PARITY-04  custom prompt    <- LAB-09 vs the lab custom-style layer (EXP-E-REFRESH arm 2)
 *   VIDEO-PARITY-05  language         <- PENDING (no captures; schema slot)
 *   VIDEO-PARITY-06  mutation locality<- PENDING (no video-side mutation capture; EXP-V-L-01 slot)
 *
 * BINDING measurement-class notes honored here:
 *   - ffmpeg scene cuts vs structural plan scenes are recorded as INSTRUMENT
 *     TRUTH (observations), never compared like-for-like;
 *   - the no-Cinematic-product-format UI-truth is recorded as a SCOPING
 *     TRUTH in the comparison records, not a parity claim;
 *   - generation wall-clock (28.4 min vs 7.4 min on identical input) is not
 *     a stable observable (LAB-08) — recorded as observation only.
 *
 * The builders are pure: (lab measurements, ingested estate) -> records.
 */

import { readFileSync } from 'node:fs';
import {
  COMPARISON_RECORD_TYPE,
  COMPARISON_SCHEMA_VERSION,
  assertRecordValid,
  type ComparisonMetric,
  type ComparisonRecord,
  type Observation,
} from './schema';
import { loadEstate, type Estate } from './ingest';
import { equalityMetric, percentPointMetric, qualitativeMetric, ratioBandMetric } from './rules';

const RECORD_STAMP = '2026-10-01T20:00:00Z';
const OPERATOR = 'wflx-p3';

const ROADMAP_STATION =
  'docs/work-items/roadmap-status.md (TL #2 station record, 2026-10-01 19:40 UTC)';

function estateRecordOf(estate: Estate, id: string): ComparisonRecord {
  const record = estate.records.find((candidate) => candidate.id === id);
  if (record === undefined) throw new Error(`estate record missing: ${id}`);
  return record;
}

function observationOf(record: ComparisonRecord, needle: string): Observation {
  const observation = record.observations.find((candidate) => candidate.text.includes(needle));
  if (observation === undefined) {
    throw new Error(`observation containing "${needle}" not found in ${record.id}`);
  }
  return observation;
}

const labObservation = (text: string, source: string): Observation => ({
  label: 'REPRODUCED',
  text,
  source,
});

interface DimensionInput {
  readonly id: string;
  readonly kind: 'dimension-comparison' | 'pending-slot';
  readonly dimension: string;
  readonly estateRecordId: string | null;
  readonly metrics: readonly ComparisonMetric[];
  readonly productObservations: readonly Observation[];
  readonly labObservations: readonly Observation[];
  readonly referenceConfig: ComparisonRecord['reference_config'];
  readonly artifactFingerprint: ComparisonRecord['artifact_fingerprint'];
  readonly capturedUtc: string | null;
  readonly durationSeconds: number | null;
  readonly customPrompt: string | null;
  readonly annotations: ComparisonRecord['annotations'];
  readonly unresolvedBehavior: readonly string[];
  readonly tlHooks: readonly string[];
  readonly evidencePaths: readonly string[];
  readonly confidence: 'low' | 'medium' | 'high';
  readonly labArtifactId: string | null;
  readonly labPipeline: string;
  readonly surface?: 'audio' | 'video' | 'cross-modal';
}

function buildRecord(input: DimensionInput): ComparisonRecord {
  const record: ComparisonRecord = {
    recordType: COMPARISON_RECORD_TYPE,
    schemaVersion: COMPARISON_SCHEMA_VERSION,
    id: input.id,
    kind: input.kind,
    timestamp_utc: RECORD_STAMP,
    operator: OPERATOR,
    surface: input.surface ?? 'video',
    dimension: input.dimension,
    reference_config: input.referenceConfig,
    source_fingerprint: null,
    artifact_fingerprint: input.artifactFingerprint,
    captured_utc: input.capturedUtc,
    duration_seconds: input.durationSeconds,
    custom_prompt: input.customPrompt,
    observations: [...input.productObservations, ...input.labObservations],
    annotations: input.annotations,
    comparison: {
      lab_artifact_id: input.labArtifactId,
      lab_pipeline: input.labPipeline,
      metrics: [...input.metrics],
    },
    confidence: input.confidence,
    unresolved_behavior: [...input.unresolvedBehavior],
    tl_hooks: [...input.tlHooks],
    evidence_paths: [...input.evidencePaths],
    status: input.kind === 'pending-slot' ? 'pending-capture' : 'compared',
  };
  assertRecordValid(record);
  return record;
}

// ---------------------------------------------------------------------------
// VIDEO-PARITY-01 — Short (EXP-V-S-01 <- LAB-07/08/09)
// ---------------------------------------------------------------------------

export interface ShortComparisonInput {
  readonly labDurationSeconds: number;
  readonly labTargetSeconds: number;
  readonly declaredBand: { readonly minSeconds: number; readonly maxSeconds: number };
  readonly labSceneCount: number;
  readonly labHookShare: number;
  readonly labGeometry: { readonly width: number; readonly height: number; readonly fps: number };
  readonly labAudioStream: { readonly codec: string; readonly channels: number; readonly sampleRateHz: number };
  readonly determinismByteIdentical: boolean;
  readonly labArtifactId: string;
  readonly sourceNote?: string;
}

export function buildShortComparisonRecord(input: ShortComparisonInput): ComparisonRecord {
  const estate = loadEstate();
  const lab07 = estate.captures['LAB-07'];
  const estateLab07 = estateRecordOf(estate, 'ESTATE-LAB-07');
  const estateLab08 = estateRecordOf(estate, 'ESTATE-LAB-08');
  const estateLab09 = estateRecordOf(estate, 'ESTATE-LAB-09');
  const productDuration = lab07.durationSeconds ?? 0;
  const labGeometryText = `${input.labGeometry.width}x${input.labGeometry.height} @ ${input.labGeometry.fps} fps h264 (16:9 landscape)`;
  const productGeometry = lab07.video;
  const productGeometryText =
    productGeometry === null
      ? 'unknown'
      : `${productGeometry.width}x${productGeometry.height} @ ${productGeometry.fps} fps h264 (${productGeometry.aspect ?? 'unknown aspect'})`;
  const labAudioText = `${input.labAudioStream.codec} ${input.labAudioStream.channels}ch @ ${input.labAudioStream.sampleRateHz} Hz`;
  const productAudio = lab07.audio;
  const productAudioText =
    productAudio === null ? 'unknown' : `${productAudio.codec} ${productAudio.channels}ch @ ${productAudio.sampleRateHz} Hz`;

  const controlWithinLabBand =
    productDuration >= input.declaredBand.minSeconds && productDuration <= input.declaredBand.maxSeconds;

  const metrics: ComparisonMetric[] = [
    {
      metric: 'short.duration.seconds',
      unit: 's',
      measurement_class: 'like-for-like',
      lab: {
        value: input.labDurationSeconds,
        source: `EXP-V-S-01 timeline duration (${input.labTargetSeconds} s target, declared band [${input.declaredBand.minSeconds}, ${input.declaredBand.maxSeconds}] s)${input.sourceNote ? ` — ${input.sourceNote}` : ''}`,
        note: null,
      },
      product: {
        value: productDuration,
        source: 'ESTATE-LAB-07 (control capture sidecar 84.82 s)',
        note: null,
      },
      delta: `n=3 product band 71.63-84.82 s (LAB-07 control 84.82 / LAB-08 twin 78.32 / LAB-09 custom focus 71.63) vs lab target ${input.labTargetSeconds} s + band [${input.declaredBand.minSeconds}, ${input.declaredBand.maxSeconds}] s; control ratio product/lab = ${(productDuration / input.labDurationSeconds).toFixed(4)}; 71.63 sits 0.37 s BELOW the lab band ceiling (recorded exactly per LAB-09) — rule: control-within-lab-band`,
      verdict: controlWithinLabBand ? 'VERIFIED' : 'DIVERGENT',
      pending_reason: null,
      confidence: 'high',
      note: 'the product Short duration is content-elastic with a band ABOVE 60 s on this fixture class (LAB-07 hypothesis, n=3); the lab 60 s target was a documented-capability reading refined by the first real captures — a duration-band parity gap, recorded honestly.',
    },
    equalityMetric({
      metric: 'short.geometry.aspect',
      lab: { value: labGeometryText, source: 'EXP-V-S-01 artifact.json media.video (fallback composition 16:9)' },
      product: { value: productGeometryText, source: 'ESTATE-LAB-07 (capture sidecar video 720x1280 9:16 vertical)' },
      confidence: 'high',
      note: 'STRUCTURAL PARITY GAP (LAB-07 OBSERVED): the product Short format is vertical 9:16; the lab Short reconstruction renders 16:9 Explainer geometry. Recorded as a gap, never normalized.',
    }),
    equalityMetric({
      metric: 'short.audioStream',
      lab: { value: labAudioText, source: 'EXP-V-S-01 artifact.json media.audio' },
      product: { value: productAudioText, source: 'ESTATE-LAB-07 (capture sidecar audio)' },
      confidence: 'high',
    }),
    {
      metric: 'short.hookProminence.share',
      unit: 'share',
      measurement_class: 'like-for-like',
      lab: {
        value: input.labHookShare,
        source: 'EXP-V-S-01 short-format-report.hookShare (x1.35 opening-beat boost)',
        note: null,
      },
      product: { value: null, source: null, note: null },
      delta: null,
      verdict: 'PENDING',
      pending_reason: 'COMPARISON PENDING REFERENCE CAPTURE',
      confidence: 'low',
      note: 'product-side structured hook annotation remains pending (curation work — the captures exist, the structured annotation does not).',
    },
    equalityMetric({
      metric: 'short.twinStochasticity',
      lab: {
        value: input.determinismByteIdentical,
        source: 'EXP-V-S-01 F4: double full-pipeline run byte-identical at every pinned layer',
      },
      product: {
        value: false,
        source: 'ESTATE-LAB-08 (identical source + settings produced a different title, -7.7% duration, different bytes)',
      },
      confidence: 'high',
      note: 'the LAB-06 audio stochasticity finding extended to the VIDEO surface (n=2); lab determinism is a control choice, not a product-fidelity property.',
    }),
    qualitativeMetric({
      metric: 'short.titleRegeneration',
      lab: {
        text: 'deterministic artifact identity: the artifact id and sidecar are seed-derived; no per-run title surface exists in the lab reconstruction',
        source: 'EXP-V-S-01 artifact.json (generator.reproducible = true)',
      },
      product: {
        text: observationOf(estateLab07, 'fresh title per run').text,
        source: 'docs/experiments/records/LAB-07.yaml',
      },
      verdict: 'DIVERGENT',
      confidence: 'high',
    }),
  ];

  return buildRecord({
    id: 'VIDEO-PARITY-01',
    kind: 'dimension-comparison',
    dimension: 'video.short',
    estateRecordId: 'ESTATE-LAB-07',
    referenceConfig: estateLab07.reference_config,
    artifactFingerprint: estateLab07.artifact_fingerprint,
    capturedUtc: estateLab07.captured_utc,
    durationSeconds: lab07.durationSeconds,
    customPrompt: null,
    annotations: estateLab07.annotations,
    metrics,
    productObservations: [
      observationOf(estateLab07, 'NOT pinned to ~60 s'),
      observationOf(estateLab07, 'VERTICAL video'),
      observationOf(estateLab08, 'both ABOVE'),
      observationOf(estateLab09, 'duration varies with content focus'),
      {
        label: 'OBSERVED',
        text: 'raw ffmpeg scene-cut instrument over the three Short captures: 3 cuts (LAB-07) / 13 (LAB-08) / 1 (LAB-09) — huge run-to-run variance. MEASUREMENT-CLASS NOTE (BINDING): the lab scene count is structural plan units; the product ffmpeg cuts are visual transitions — recorded as INSTRUMENT TRUTH only, never compared like-for-like.',
        source: ROADMAP_STATION,
      },
      {
        label: 'OBSERVED',
        text: 'generation wall-clock 28.4 min (LAB-07) vs 7.4 min (LAB-08) on identical notebook/source/format — wall-clock is heavily variable and NOT a stable observable for comparison; the lab EV-022 per-asset latencies are a different measurement class (per-episode vs per-asset, UNRESOLVED shape).',
        source: 'docs/experiments/records/LAB-08.yaml',
      },
    ],
    labObservations: [
      labObservation(
        `lab Short compile: ${input.labSceneCount} scenes, ${input.labDurationSeconds} s timeline (target ${input.labTargetSeconds} s), hookShare ${input.labHookShare}, skeleton hook/topic/topic/topic/takeaways, coverage accounting closed, double-run byte-identical (${input.determinismByteIdentical})`,
        'experiments/run-exp-v-s-01.ts (EXP-V-S-01, EV-020) — committed artifacts/video/exp-v-s-01/',
      ),
    ],
    unresolvedBehavior: [
      'product Short hook prominence: structured annotation pending (curation work) — the hookProminence metric stays PENDING',
      '9:16 vertical reconstruction: the lab renders 16:9 only (structural parity gap recorded, not claimed)',
      'scene density comparison is instrument-truth-only by the binding measurement-class note (ffmpeg cuts vs plan units are different measurement classes)',
    ],
    tlHooks: [
      'TL: land the product-side structured hook-prominence annotation for the Short captures (curation work), then re-run exp:cmpvideo to fill the short.hookProminence.share metric',
    ],
    evidencePaths: [
      'docs/experiments/records/LAB-07.yaml',
      'docs/experiments/records/LAB-08.yaml',
      'docs/experiments/records/LAB-09.yaml',
      'artifacts/reference/lab-07/artifact.json',
      'artifacts/reference/lab-08/artifact.json',
      'artifacts/reference/lab-09/artifact.json',
      'artifacts/video/exp-v-s-01/experiment-record.json',
      'docs/work-items/roadmap-status.md',
    ],
    confidence: 'high',
    labArtifactId: input.labArtifactId,
    labPipeline:
      'lab pipeline: Director short-mode plan (60 s) -> ShortFormat layer -> storyboard compiler -> full pipeline (offline deterministic fallback backend; EXP-V-S-01 / EV-020)',
  });
}

// ---------------------------------------------------------------------------
// VIDEO-PARITY-02 — Cinematic (EXP-V-CIN-01; scoping truth + PENDING)
// ---------------------------------------------------------------------------

export interface CinematicComparisonInput {
  readonly labSceneCount: number;
  readonly labJobs: number;
  readonly assetClassHistogram: Record<string, number>;
  readonly planFingerprintIdentical: boolean;
  readonly regenIsolationProven: boolean;
  readonly labArtifactId: string;
}

export function buildCinematicPendingRecord(input: CinematicComparisonInput): ComparisonRecord {
  const estate = loadEstate();
  const estateLab07 = estateRecordOf(estate, 'ESTATE-LAB-07');
  const histogramText = Object.entries(input.assetClassHistogram)
    .map(([name, count]) => `${name}x${count}`)
    .join(', ');
  const pending = (metric: string, labValue: string | null, note: string): ComparisonMetric => ({
    metric,
    unit: null,
    measurement_class: 'qualitative',
    lab:
      labValue === null
        ? { value: null, source: null, note: null }
        : { value: labValue, source: 'EXP-V-CIN-01 committed outputs (EV-021)', note: null },
    product: { value: null, source: null, note: null },
    delta: null,
    verdict: 'PENDING',
    pending_reason: 'COMPARISON PENDING REFERENCE CAPTURE',
    confidence: 'low',
    note,
  });
  return buildRecord({
    id: 'VIDEO-PARITY-02',
    kind: 'pending-slot',
    dimension: 'video.cinematic',
    estateRecordId: null,
    referenceConfig: {
      notebook: null,
      format: 'Cinematic — NO product format exists (UI-truth: the product video dialog exposes exactly Short 9:16 and Explainer 16:9)',
      language: null,
      length: null,
      visual_style: null,
      custom_prompt: null,
      other_config: null,
    },
    artifactFingerprint: {
      sha256: null,
      path: null,
      media_present: false,
      additional: [],
      note: 'no Cinematic product artifact exists to fingerprint — the lab layer is a behavior reconstruction of generative-asset workflows (scoping truth, not a parity claim)',
    },
    capturedUtc: null,
    durationSeconds: null,
    customPrompt: null,
    annotations: { transcript_path: null, scene_annotation_path: null, notes: null },
    metrics: [
      pending(
        'cinematic.shotDensity.shotClasses',
        `${input.labJobs} jobs over ${input.labSceneCount} scenes — asset classes: ${histogramText}`,
        'the product side has NO Cinematic format (scoping truth); shot density comparison has no product counterpart',
      ),
      pending(
        'cinematic.styleContinuity.constraints',
        'per-adjacency subject-carry/motif constraints + per-scene palette continuity (CinematicDirector, deterministic shot-plan vector keyed on the C-5 scene-local content hash)',
        'the product side has NO Cinematic format (scoping truth); continuity comparison has no product counterpart',
      ),
      pending(
        'cinematic.generationLatency',
        null,
        'generation wall-clock is not a stable product observable (LAB-08: 28.4 vs 7.4 min on identical input); the lab EV-022 per-asset latencies are a different measurement class — recorded UNRESOLVED-shape, not compared',
      ),
    ],
    productObservations: [
      observationOf(estateLab07, "NO 'Cinematic' format exists"),
      observationOf(estateLab07, 'focus controls'),
    ],
    labObservations: [
      labObservation(
        `lab cinematic pipeline: ${input.labJobs} jobs over ${input.labSceneCount} scenes (${histogramText}); plan fingerprint double-run identical (${input.planFingerprintIdentical}); single-asset local regeneration isolated (${input.regenIsolationProven}); validation + QA pass — OFFLINE stand-ins (EV-021), live execution EV-022`,
        'experiments/run-exp-v-cin-01.ts (EXP-V-CIN-01, EV-021) — committed artifacts/video/exp-v-cin-01/',
      ),
    ],
    unresolvedBehavior: [
      'SCOPING TRUTH (binding for the parity verdict): the product video surface exposes exactly Short (9:16) | Explainer (16:9) — NO Cinematic product format exists; the lab Cinematic layer is a behavior reconstruction of generative-asset workflows, not a product-format twin',
      'native video-clip embedding in the offline compositor UNRESOLVED (EV-021 honest boundary)',
    ],
    tlHooks: [
      'TL: this slot stays PENDING unless/until the product ships a Cinematic video format; if it ships, capture per the LAB-series pattern and re-run exp:cmpvideo to fill the metrics',
    ],
    evidencePaths: [
      'docs/experiments/records/LAB-07.yaml',
      'artifacts/reference/lab-07/artifact.json',
      'artifacts/video/exp-v-cin-01/experiment-record.json',
      'docs/experiments/records/EXP-V-CIN-01.yaml',
    ],
    confidence: 'high',
    labArtifactId: input.labArtifactId,
    labPipeline:
      'lab pipeline: storyboard compile -> CinematicDirector -> VisualAssetPlan (five frozen classes) -> offline generative stand-ins -> validation gates -> timeline/overlay -> QA (EXP-V-CIN-01 / EV-021; live arm EXP-V-CIN-LIVE-01 / EV-022)',
  });
}

// ---------------------------------------------------------------------------
// VIDEO-PARITY-03 — Explainer (EXP-E-REFRESH <- original reference + atlas)
// ---------------------------------------------------------------------------

export interface ExplainerComparisonInput {
  readonly labDurationSeconds: number;
  readonly labSceneCount: number;
  readonly labGeometry: { readonly width: number; readonly height: number; readonly fps: number };
  readonly labAudioStream: { readonly codec: string; readonly channels: number; readonly sampleRateHz: number };
  readonly labArtifactId: string;
  readonly customStyleStructureChangedScenes: number;
  readonly customStyleCoverageIdentical: boolean;
  readonly customStyleTimelineIdentical: boolean;
}

export function buildExplainerComparisonRecord(input: ExplainerComparisonInput): ComparisonRecord {
  const estate = loadEstate();
  const explainer = estate.explainer;
  const estateExplainer = estateRecordOf(estate, 'ESTATE-EXPLAINER-001');
  const labGeometryText = `${input.labGeometry.width}x${input.labGeometry.height} @ ${input.labGeometry.fps} fps h264`;
  const productGeometryText = `${explainer.width}x${explainer.height} @ ${explainer.fps} fps h264`;
  const labAudioText = `${input.labAudioStream.codec} ${input.labAudioStream.channels}ch @ ${input.labAudioStream.sampleRateHz} Hz`;
  const productAudioText = `aac ${explainer.audioChannels}ch @ ${explainer.audioSampleRateHz} Hz`;
  const metrics: ComparisonMetric[] = [
    ratioBandMetric({
      metric: 'explainer.duration.seconds',
      unit: 's',
      lab: {
        value: input.labDurationSeconds,
        source: `EXP-E-REFRESH baseline-canonical-7min timeline (${input.labDurationSeconds} s at the 7-min canonical target)`,
      },
      product: {
        value: explainer.originalDurationSeconds,
        source: `ESTATE-EXPLAINER-001 (original pin ${explainer.originalDurationSeconds} s; served variant ${explainer.servedDurationSeconds} s)`,
      },
      confidence: 'high',
      note: 'the ONE golden product Explainer sample: original pin 415.66 s / served variant 415.61 s vs lab 420 s canonical target — same duration class. Single-sample caveat: n=1 product capture of ONE mode (per-mode product truth lives in the LAB series).',
    }),
    equalityMetric({
      metric: 'explainer.geometry',
      lab: { value: labGeometryText, source: 'EXP-E-REFRESH baseline artifact.json media.video' },
      product: {
        value: productGeometryText,
        source: 'ESTATE-EXPLAINER-001 (manifest served observed_metadata; 12468 frames served)',
      },
      confidence: 'high',
    }),
    equalityMetric({
      metric: 'explainer.audioStream',
      lab: {
        value: labAudioText,
        source: 'EXP-E-REFRESH baseline artifact.json media.audio (placeholder narration)',
      },
      product: { value: productAudioText, source: 'ESTATE-EXPLAINER-001 (manifest served observed_metadata)' },
      confidence: 'high',
      note: 'stream SHAPE comparison only — the lab narration is offline placeholder synthesis, the product narration is real speech (measurement-class note).',
    }),
    qualitativeMetric({
      metric: 'explainer.narrationCoverage',
      lab: {
        text: 'placeholder narration segments cover the full timeline (per-scene narration, full duration, no gaps)',
        source: 'EXP-E-REFRESH baseline timeline.json + narration manifest',
      },
      product: {
        text: 'narration throughout the artifact: ASR transcribed the AAC mono track in 17 silence-aligned chunks; scene cuts align to narration-pause boundaries (atlas alignment field)',
        source: 'reference/annotations/reference-video-scenes.json (method.narration + per-scene narrationPauseDistanceSeconds)',
      },
      verdict: 'VERIFIED',
      confidence: 'low',
      note: 'qualitative full-duration narration on both sides; lab placeholder vs product real speech — not a quality comparison.',
    }),
  ];
  return buildRecord({
    id: 'VIDEO-PARITY-03',
    kind: 'dimension-comparison',
    dimension: 'video.explainer',
    estateRecordId: 'ESTATE-EXPLAINER-001',
    referenceConfig: estateExplainer.reference_config,
    artifactFingerprint: estateExplainer.artifact_fingerprint,
    capturedUtc: estateExplainer.captured_utc,
    durationSeconds: explainer.originalDurationSeconds,
    customPrompt: null,
    annotations: estateExplainer.annotations,
    metrics,
    productObservations: [
      observationOf(estateExplainer, 'scene atlas'),
      observationOf(estateExplainer, 'origin'),
    ],
    labObservations: [
      labObservation(
        `lab Explainer compile: ${input.labSceneCount} scenes / 6 beats, coverage 11/11, ${input.labDurationSeconds} s timeline, QA passed, packet digest double-run byte-identical; custom-style arm: ${input.customStyleStructureChangedScenes}/${input.labSceneCount} scenes change structure, coverage identical (${input.customStyleCoverageIdentical}), timeline identical (${input.customStyleTimelineIdentical})`,
        'experiments/run-exp-e-refresh.ts (EXP-E-REFRESH, EV-019) — committed artifacts/video/exp-e-refresh/',
      ),
    ],
    unresolvedBehavior: [
      `scene structure comparison is instrument-truth-only (BINDING measurement-class note): lab ${input.labSceneCount} structural plan scenes vs product ${explainer.atlasSegmentCount} ffmpeg scdet segments — different measurement classes, never compared like-for-like`,
      'the golden reference is ONE product sample of ONE mode (n=1); language not recorded in the manifest (VIDEO-PARITY-05 carries the language arm)',
      'lab narration is placeholder synthesis — speech quality parity UNRESOLVED at this layer (the audio-surface quality dimensions live in the EXP-L-02 suite)',
    ],
    tlHooks: [],
    evidencePaths: [
      'docs/reference/reference-artifact-manifest.json',
      'reference/annotations/reference-video-scenes.json',
      'artifacts/video/exp-e-refresh/baseline-canonical-7min/',
      'artifacts/video/exp-e-refresh/custom-style-7min/style-delta.json',
      'docs/experiments/records/EXP-E-REFRESH.yaml',
    ],
    confidence: 'medium',
    labArtifactId: input.labArtifactId,
    labPipeline:
      'lab pipeline: canonical plan-video-explainer-7min fixture -> storyboard compile -> SVG render -> timeline -> placeholder narration -> composition (offline deterministic fallback; EXP-E-REFRESH / EV-019)',
  });
}

// ---------------------------------------------------------------------------
// VIDEO-PARITY-04 — video custom prompt (LAB-09 vs lab custom-style layer)
// ---------------------------------------------------------------------------

export interface VideoCustomPromptComparisonInput {
  readonly customStyleStructureChangedScenes: number;
  readonly customStyleCoverageIdentical: boolean;
  readonly customStyleTimelineIdentical: boolean;
  readonly labSceneCount: number;
  readonly labArtifactId: string;
}

export function buildVideoCustomPromptComparisonRecord(
  input: VideoCustomPromptComparisonInput,
): ComparisonRecord {
  const estate = loadEstate();
  const lab07 = estate.captures['LAB-07'];
  const lab09 = estate.captures['LAB-09'];
  const estateLab09 = estateRecordOf(estate, 'ESTATE-LAB-09');
  const controlDuration = lab07.durationSeconds ?? 0;
  const customDuration = lab09.durationSeconds ?? 0;
  const productShift = ((customDuration - controlDuration) / controlDuration) * 100;
  const metrics: ComparisonMetric[] = [
    qualitativeMetric({
      metric: 'custom.steeringSemantics',
      lab: {
        text: `style-only steering: the custom style prompt changes the rendered SVG surface (palette accents); ${input.customStyleStructureChangedScenes}/${input.labSceneCount} scenes change structure, coverage identical (${input.customStyleCoverageIdentical}), timeline identical (${input.customStyleTimelineIdentical})`,
        source: 'artifacts/video/exp-e-refresh/custom-style-7min/style-delta.json (EXP-E-REFRESH arm 2 / EXP-V-07 pattern)',
      },
      product: {
        text: observationOf(estateLab09, 'MATERIALLY re-steered').text,
        source: 'docs/experiments/records/LAB-09.yaml',
      },
      verdict: 'DIVERGENT',
      confidence: 'high',
      note: 'DIFFERENT CONTROL SEMANTICS (recorded as a parity distinction, not a defect — the LAB-09 differences note): the product custom topic is an episode-level CONTENT re-plan; the lab custom layer is a STYLE surface change. The LAB-08 failed-injection run is the negative control (transcript = default content).',
    }),
    percentPointMetric({
      metric: 'custom.durationResponsePercent',
      lab: {
        value: 0,
        source: 'lab custom-style arm timeline identical to baseline (0% duration response by construction — the style layer never touches timing)',
      },
      product: {
        value: Math.round(productShift * 10) / 10,
        source: `LAB-09 71.63 s vs LAB-07 control 84.82 s = ${productShift.toFixed(1)}%`,
      },
      confidence: 'medium',
      note: 'the product duration varies with content focus (n=3 band 71.6-84.8 s); the lab style arm does not move duration at all.',
    }),
    qualitativeMetric({
      metric: 'custom.formatInvariantPreservation',
      lab: {
        text: 'format fully preserved under custom style (structure 0 changed, same geometry/codec envelope)',
        source: 'artifacts/video/exp-e-refresh/custom-style-7min/style-delta.json',
      },
      product: {
        text: observationOf(estateLab09, 'hook-question opening').text,
        source: 'docs/experiments/records/LAB-09.yaml',
      },
      verdict: 'VERIFIED',
      confidence: 'medium',
      note: 'both sides keep the format envelope invariant under custom steering (content/style changes, format does not).',
    }),
    qualitativeMetric({
      metric: 'custom.fixtureFaithfulness',
      lab: {
        text: 'claim-grounded: custom style keeps the editorial claim selection identical (coverage 11/11 both arms — grounding invariant)',
        source: 'artifacts/video/exp-e-refresh/custom-style-7min/style-delta.json (coverageIdentical)',
      },
      product: {
        text: observationOf(estateLab09, 'extrapolates a scenario').text,
        source: 'docs/experiments/records/LAB-09.yaml',
      },
      verdict: 'DIVERGENT',
      confidence: 'high',
      note: 'the product extrapolates a stylized narrative AROUND the focus angle with loose semantic anchoring (the quarterly-rotation fact itself is NOT voiced); the lab layer is strictly claim-grounded.',
    }),
  ];
  return buildRecord({
    id: 'VIDEO-PARITY-04',
    kind: 'dimension-comparison',
    dimension: 'video.custom-prompt',
    estateRecordId: 'ESTATE-LAB-09',
    referenceConfig: estateLab09.reference_config,
    artifactFingerprint: estateLab09.artifact_fingerprint,
    capturedUtc: estateLab09.captured_utc,
    durationSeconds: lab09.durationSeconds,
    customPrompt: lab09.customPrompt,
    annotations: estateLab09.annotations,
    metrics,
    productObservations: [
      observationOf(estateLab09, 'security/credentials narrative'),
      observationOf(estateLab09, 'fixture-faithfulness under steering'),
    ],
    labObservations: [
      labObservation(
        `lab custom-style arm: ${input.customStyleStructureChangedScenes}/${input.labSceneCount} scenes changed structure, coverage identical, timeline identical — the documented custom-prompt prior (style-only, never coverage) extended to the visual surface`,
        'experiments/run-exp-e-refresh.ts arm 2 (EV-019) — committed artifacts/video/exp-e-refresh/custom-style-7min/',
      ),
    ],
    unresolvedBehavior: [
      'control-semantics distinction: product focus steering re-plans content wholesale; lab style steering changes surface only — recorded as a parity distinction, not silently normalized',
    ],
    tlHooks: [],
    evidencePaths: [
      'docs/experiments/records/LAB-09.yaml',
      'docs/experiments/records/LAB-09-transcript.txt',
      'artifacts/reference/lab-09/artifact.json',
      'artifacts/video/exp-e-refresh/custom-style-7min/style-delta.json',
      'docs/experiments/records/EXP-E-REFRESH.yaml',
    ],
    confidence: 'high',
    labArtifactId: input.labArtifactId,
    labPipeline:
      'lab pipeline: canonical plan -> customStyleBible(prompt) -> storyboard compile -> render (EXP-E-REFRESH arm 2 / EV-019; the EXP-V-07 custom-style pattern on the v2 baseline)',
  });
}

// ---------------------------------------------------------------------------
// VIDEO-PARITY-05 — video language arm (PENDING slot)
// ---------------------------------------------------------------------------

export function buildVideoLanguagePendingRecord(): ComparisonRecord {
  const estate = loadEstate();
  const estateLab07 = estateRecordOf(estate, 'ESTATE-LAB-07');
  const pending = (metric: string, note: string): ComparisonMetric => ({
    metric,
    unit: null,
    measurement_class: 'qualitative',
    lab: { value: null, source: null, note: null },
    product: { value: null, source: null, note: null },
    delta: null,
    verdict: 'PENDING',
    pending_reason: 'COMPARISON PENDING REFERENCE CAPTURE',
    confidence: 'low',
    note,
  });
  return buildRecord({
    id: 'VIDEO-PARITY-05',
    kind: 'pending-slot',
    dimension: 'video.language',
    estateRecordId: null,
    referenceConfig: {
      notebook: null,
      format: 'Short / Explainer + language selection (the video dialog exposes Choose language — LAB-07 OBSERVED)',
      language: null,
      length: null,
      visual_style: null,
      custom_prompt: null,
      other_config: null,
    },
    artifactFingerprint: {
      sha256: null,
      path: null,
      media_present: false,
      additional: [],
      note: 'no non-English video capture exists (capture-matrix state: language not captured — optional follow-up)',
    },
    capturedUtc: null,
    durationSeconds: null,
    customPrompt: null,
    annotations: { transcript_path: null, scene_annotation_path: null, notes: null },
    metrics: [
      pending('language.videoStructureInvariance', 'no product-side non-English video capture exists'),
      pending('language.surfaceRegeneration', 'no product-side non-English video capture exists'),
    ],
    productObservations: [
      {
        label: 'OBSERVED',
        text: `the video dialog exposes language selection: "${estateLab07.reference_config.other_config?.dialog_exposed ?? 'dialog_exposed missing'}"`,
        source: 'docs/experiments/records/LAB-07.yaml (other_config.dialog_exposed)',
      },
      {
        label: 'OBSERVED',
        text: 'capture-matrix state: video language arm NOT captured (PENDING — non-English video arm optional follow-up per the TL station record)',
        source: ROADMAP_STATION,
      },
    ],
    labObservations: [
      labObservation(
        'lab side: the EXP-A-06 structure-invariant / surface-specific language axis is proven on the AUDIO surface; the video-surface language arm has no lab compile either (no non-English video plan fixture) — both sides pending',
        'docs/experiments/records/EXP-A-06.yaml (audio-surface analog)',
      ),
    ],
    unresolvedBehavior: [
      'video-surface language behavior: UNRESOLVED on BOTH sides (no product capture, no lab non-English video arm)',
    ],
    tlHooks: [
      'TL: land the non-English video capture (Short or Explainer + language selection, LAB-series pattern) to fill this record; the audio-surface EXP-A-06/LAB-04 axis is the working hypothesis',
    ],
    evidencePaths: [
      'docs/experiments/records/LAB-07.yaml',
      'docs/work-items/roadmap-status.md',
      'docs/experiments/records/EXP-A-06.yaml',
    ],
    confidence: 'low',
    labArtifactId: null,
    labPipeline: 'no lab non-English video arm exists (both sides pending — honest gap)',
  });
}

// ---------------------------------------------------------------------------
// VIDEO-PARITY-06 — video mutation locality (EXP-V-L-01 slot, PENDING)
// ---------------------------------------------------------------------------

export interface VideoLocalityPendingInput {
  readonly changedSvgs: number;
  readonly sceneCount: number;
  readonly targetSceneId: string;
  readonly labArtifactId: string | null;
}

export function buildVideoLocalityPendingRecord(input: VideoLocalityPendingInput): ComparisonRecord {
  const pending = (metric: string, labValue: string, note: string): ComparisonMetric => ({
    metric,
    unit: null,
    measurement_class: 'qualitative',
    lab: { value: labValue, source: 'artifacts/video/exp-v-l-01/locality-report.json (EXP-V-L-01, EV-019)', note: null },
    product: { value: null, source: null, note: null },
    delta: null,
    verdict: 'PENDING',
    pending_reason: 'COMPARISON PENDING REFERENCE CAPTURE',
    confidence: 'low',
    note,
  });
  return buildRecord({
    id: 'VIDEO-PARITY-06',
    kind: 'pending-slot',
    dimension: 'video.mutation-locality',
    estateRecordId: null,
    referenceConfig: {
      notebook: null,
      format: 'Explainer (video) + one-source mutation (the EXP-V-L-01 axis)',
      language: null,
      length: null,
      visual_style: null,
      custom_prompt: null,
      other_config: null,
    },
    artifactFingerprint: {
      sha256: null,
      path: null,
      media_present: false,
      additional: [],
      note: 'no video-side source-mutation product capture exists (LAB-05 is the AUDIO-surface mutation probe)',
    },
    capturedUtc: null,
    durationSeconds: null,
    customPrompt: null,
    annotations: { transcript_path: null, scene_annotation_path: null, notes: null },
    metrics: [
      pending(
        'videoMutation.localityClass',
        `lab C-5 video locality: a single-scene claim swap changes EXACTLY ${input.changedSvgs} scene SVG (${input.targetSceneId}) + 1 render spec + 1 narration, 0 structure reshuffle`,
        'the product-side video mutation capture does not exist (the mutation probe family is audio-side: LAB-05)',
      ),
      pending(
        'videoMutation.macroStructurePreservation',
        `lab: ${input.sceneCount} scenes, structure preserved, double-run deterministic`,
        'the product-side video mutation capture does not exist',
      ),
    ],
    productObservations: [
      {
        label: 'OBSERVED',
        text: 'the product mutation probe (LAB-05, b30 paragraph edit) is AUDIO-surface: global re-plan with macro-pattern preservation. No video-surface mutation capture exists; the audio-surface finding (global re-plan; mutation locality not separately observable above run-to-run variance) is the working hypothesis for video',
        source: 'docs/experiments/records/LAB-05.yaml + docs/experiments/records/LAB-06.yaml',
      },
    ],
    labObservations: [
      labObservation(
        `lab video locality proof (EXP-V-L-01): ${input.changedSvgs} changed SVG / ${input.sceneCount} scenes, 1 render spec, 1 narration, 0 structure reshuffle, F1-F3 PASS`,
        'experiments/run-exp-e-refresh.ts arm 3 (EV-019) — committed artifacts/video/exp-v-l-01/locality-report.json',
      ),
    ],
    unresolvedBehavior: [
      'video-surface mutation locality: no product capture — UNRESOLVED (audio-surface global-re-plan finding is the hypothesis, not video truth)',
    ],
    tlHooks: [
      'TL: land a video-surface source-mutation capture (Explainer or Short + one-source edit + regenerate, LAB-series pattern) to fill this record',
    ],
    evidencePaths: [
      'artifacts/video/exp-v-l-01/locality-report.json',
      'docs/experiments/records/EXP-V-L-01.yaml',
      'docs/experiments/records/LAB-05.yaml',
    ],
    confidence: 'medium',
    labArtifactId: input.labArtifactId,
    labPipeline:
      'lab pipeline: Director 180s explainer plan -> single-scene claim swap -> storyboard compile + SVG render per arm (EXP-V-L-01 / EV-019)',
  });
}

// ---------------------------------------------------------------------------
// Committed-output readers (for experiments/run-comparison-video.ts)
// ---------------------------------------------------------------------------

interface JsonRecord {
  readonly [key: string]: unknown;
}

function readJson(path: string): JsonRecord {
  return JSON.parse(readFileSync(path, 'utf8')) as JsonRecord;
}

function numField(record: JsonRecord, path: string[]): number {
  let current: unknown = record;
  for (const key of path) {
    if (current === null || typeof current !== 'object') {
      throw new Error(`${path.join('.')}: not an object at ${key}`);
    }
    current = (current as JsonRecord)[key];
  }
  if (typeof current !== 'number') throw new Error(`${path.join('.')}: expected number`);
  return current;
}

function strField(record: JsonRecord, path: string[]): string {
  let current: unknown = record;
  for (const key of path) {
    if (current === null || typeof current !== 'object') {
      throw new Error(`${path.join('.')}: not an object at ${key}`);
    }
    current = (current as JsonRecord)[key];
  }
  if (typeof current !== 'string') throw new Error(`${path.join('.')}: expected string`);
  return current;
}

/**
 * Build the full video comparison record set from the COMMITTED runner
 * outputs (the P2-era persisted measurements, read verbatim) + the ingested
 * estate. Used by experiments/run-comparison-video.ts and the integration
 * tests — no composition re-run, no committed-store churn.
 */
export function buildVideoComparisonRecordsFromCommittedStore(): readonly ComparisonRecord[] {
  const shortRecord = readJson('artifacts/video/exp-v-s-01/experiment-record.json');
  const shortReport = readJson('artifacts/video/exp-v-s-01/short-format-report.json');
  const shortArtifact = readJson('artifacts/video/exp-v-s-01/artifact.json');
  const cinRecord = readJson('artifacts/video/exp-v-cin-01/experiment-record.json');
  const cinHistogram = (cinRecord['assetClassHistogram'] ?? {}) as Record<string, number>;
  const runA = cinRecord['runA'] as JsonRecord;
  const explainerTimeline = readJson('artifacts/video/exp-e-refresh/baseline-canonical-7min/timeline.json');
  const explainerArtifact = readJson('artifacts/video/exp-e-refresh/baseline-canonical-7min/artifact.json');
  const explainerArmSummary = readJson('artifacts/video/exp-e-refresh/baseline-canonical-7min/arm-summary.json');
  const styleDelta = readJson('artifacts/video/exp-e-refresh/custom-style-7min/style-delta.json');
  const locality = readJson('artifacts/video/exp-v-l-01/locality-report.json');
  const measured = locality['measured'] as JsonRecord;

  return [
    buildShortComparisonRecord({
      labDurationSeconds: numField(shortRecord, ['composition', 'durationSeconds']),
      labTargetSeconds: numField(shortRecord, ['target', 'targetDurationSeconds']),
      declaredBand: {
        minSeconds: numField(shortReport, ['declaredBand', 'minSeconds']),
        maxSeconds: numField(shortReport, ['declaredBand', 'maxSeconds']),
      },
      labSceneCount: numField(shortReport, ['sceneCount']),
      labHookShare: numField(shortReport, ['hookShare']),
      labGeometry: {
        width: numField(shortArtifact, ['media', 'video', 'width']),
        height: numField(shortArtifact, ['media', 'video', 'height']),
        fps: numField(shortArtifact, ['media', 'video', 'frameRate']),
      },
      labAudioStream: {
        codec: strField(shortArtifact, ['media', 'audio', 'codec']),
        channels: numField(shortArtifact, ['media', 'audio', 'channels']),
        sampleRateHz: numField(shortArtifact, ['media', 'audio', 'sampleRateHz']),
      },
      determinismByteIdentical: shortRecord['falsifiers'] !== undefined &&
        ((shortRecord['falsifiers'] as JsonRecord)['F4_determinism'] === true),
      labArtifactId: String(shortArtifact['id']),
      sourceNote: 'committed EXP-V-S-01 outputs, read verbatim by the WFLX-P3 comparison program',
    }),
    buildCinematicPendingRecord({
      labSceneCount: numField(runA, ['scenes']),
      labJobs: numField(runA, ['jobs']),
      assetClassHistogram: cinHistogram,
      planFingerprintIdentical:
        (cinRecord['determinism'] as JsonRecord | undefined)?.['planFingerprintIdentical'] === true,
      regenIsolationProven:
        (cinRecord['falsifiers'] as JsonRecord | undefined)?.['F2_local_regeneration'] === true,
      labArtifactId: 'exp-v-cin-01 (cinematic plan fingerprint — see committed cinematic-plan-fingerprint.json)',
    }),
    buildExplainerComparisonRecord({
      labDurationSeconds: numField(explainerTimeline, ['durationSeconds']),
      labSceneCount: numField(explainerArmSummary, ['sceneCount']),
      labGeometry: {
        width: numField(explainerArtifact, ['media', 'video', 'width']),
        height: numField(explainerArtifact, ['media', 'video', 'height']),
        fps: numField(explainerArtifact, ['media', 'video', 'frameRate']),
      },
      labAudioStream: {
        codec: 'aac',
        channels: numField(explainerArtifact, ['media', 'audio', 'channels']),
        sampleRateHz: numField(explainerArtifact, ['media', 'audio', 'sampleRateHz']),
      },
      labArtifactId: String(explainerArtifact['id']),
      customStyleStructureChangedScenes: styleDelta['structureChangedScenes'] as number,
      customStyleCoverageIdentical: styleDelta['coverageIdentical'] === true,
      customStyleTimelineIdentical: styleDelta['timelineIdentical'] === true,
    }),
    buildVideoCustomPromptComparisonRecord({
      customStyleStructureChangedScenes: styleDelta['structureChangedScenes'] as number,
      customStyleCoverageIdentical: styleDelta['coverageIdentical'] === true,
      customStyleTimelineIdentical: styleDelta['timelineIdentical'] === true,
      labSceneCount: numField(explainerArmSummary, ['sceneCount']),
      labArtifactId: 'exp-e-refresh custom-style-7min (style-delta.json, EV-019)',
    }),
    buildVideoLanguagePendingRecord(),
    buildVideoLocalityPendingRecord({
      changedSvgs: measured['scenesWithChangedSvgs'] as number,
      sceneCount: (locality['invariants'] as JsonRecord)['sceneCount'] as number,
      targetSceneId: ((locality['mutation'] as JsonRecord)['targetSceneId'] as string) ?? 'scene-2',
      labArtifactId: 'exp-v-l-01 (locality-report.json, EV-019)',
    }),
  ];
}
