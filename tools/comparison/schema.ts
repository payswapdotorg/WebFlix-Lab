/**
 * Canonical comparison-record schema (WFLX-P3 Deliverable A / EV-023).
 *
 * Every record in the comparison program (docs/experiments/comparisons/**)
 * validates against ONE schema — the §3 field list of the parity-completion
 * charter, mechanical and checkable:
 *
 *   reference config, source fingerprint, artifact fingerprint (sha256),
 *   timestamp, format, language, duration, custom prompt, observations
 *   (evidence-labeled), transcript/scene annotations where present,
 *   comparison-against-lab-artifact results (metric by metric), confidence,
 *   unresolved behavior.
 *
 * Record kinds:
 *   estate-capture      — a real-product capture folded from the committed
 *                         LAB-series records / reference manifest (capture
 *                         fields; comparison metrics stay empty — the
 *                         dimension program does the comparing);
 *   dimension-comparison— lab value vs product value, metric by metric, each
 *                         with a mechanical verdict;
 *   pending-slot        — a comparison dimension whose product-side capture
 *                         does not exist yet: schema slot only, every metric
 *                         PENDING, TL-hooks for post-capture fill.
 *
 * REQUIRED-EITHER-VALUE-OR-PENDING (the honesty spine):
 *   - a metric with verdict VERIFIED or DIVERGENT carries BOTH a lab value
 *     AND a product value (never null) and NO pending_reason;
 *   - a metric with verdict PENDING carries pending_reason exactly
 *     "COMPARISON PENDING REFERENCE CAPTURE" and a NULL product value —
 *     an honest gap, never a guess (the worker NEVER fabricates
 *     product-side numbers).
 *
 * Measurement classes:
 *   like-for-like     — the two sides measure the same thing mechanically;
 *   instrument-truth  — values are recorded as instrument observations of
 *                       DIFFERENT measurement classes and are NEVER compared
 *                       as like-for-like (the binding sceneDensity note:
 *                       ffmpeg cuts vs structural plan units). Such numbers
 *                       live in observations, not comparison metrics.
 *   qualitative       — structural/behavioral alignment judged from
 *                       evidence-labeled observations on both sides.
 *
 * Verdict vocabulary (work order §3): VERIFIED / DIVERGENT / PENDING.
 */

import { z } from 'zod';
import { emitYaml, parseYaml, type YamlValue } from './yaml';

export const COMPARISON_RECORD_TYPE = 'ComparisonRecord' as const;
export const COMPARISON_SCHEMA_VERSION = '1.0.0' as const;
export const PENDING_REASON = 'COMPARISON PENDING REFERENCE CAPTURE' as const;

export const EVIDENCE_LABELS = ['OBSERVED', 'DOCUMENTED', 'HYPOTHESIS', 'REPRODUCED', 'UNRESOLVED'] as const;
export type EvidenceLabel = (typeof EVIDENCE_LABELS)[number];

export const CONFIDENCE_LEVELS = ['low', 'medium', 'high'] as const;
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];

export const VERDICTS = ['VERIFIED', 'DIVERGENT', 'PENDING'] as const;
export type Verdict = (typeof VERDICTS)[number];

export const MEASUREMENT_CLASSES = ['like-for-like', 'instrument-truth', 'qualitative'] as const;
export type MeasurementClass = (typeof MEASUREMENT_CLASSES)[number];

export const RECORD_KINDS = ['estate-capture', 'dimension-comparison', 'pending-slot'] as const;
export type RecordKind = (typeof RECORD_KINDS)[number];

export const SURFACES = ['audio', 'video', 'cross-modal'] as const;
export type Surface = (typeof SURFACES)[number];

// ---------------------------------------------------------------------------
// Zod schemas (runtime validation — the record estate is data, not prose)
// ---------------------------------------------------------------------------

const ObservationSchema = z.object({
  label: z.enum(EVIDENCE_LABELS),
  text: z.string().min(1),
  source: z.string().min(1),
});
export type Observation = z.infer<typeof ObservationSchema>;

const MetricSideSchema = z.object({
  value: z.union([z.string(), z.number(), z.boolean()]).nullable(),
  source: z.string().nullable(),
  note: z.string().nullable(),
});
export type MetricSide = z.infer<typeof MetricSideSchema>;

const ComparisonMetricSchema = z.object({
  metric: z.string().min(1),
  unit: z.string().nullable(),
  measurement_class: z.enum(MEASUREMENT_CLASSES),
  lab: MetricSideSchema,
  product: MetricSideSchema,
  delta: z.string().nullable(),
  verdict: z.enum(VERDICTS),
  pending_reason: z.literal(PENDING_REASON).nullable(),
  confidence: z.enum(CONFIDENCE_LEVELS),
  note: z.string().nullable(),
});
export type ComparisonMetric = z.infer<typeof ComparisonMetricSchema>;

const ReferenceConfigSchema = z.object({
  notebook: z.string().nullable(),
  format: z.string().nullable(),
  language: z.string().nullable(),
  length: z.string().nullable(),
  visual_style: z.string().nullable(),
  custom_prompt: z.string().nullable(),
  other_config: z.record(z.string(), z.string()).nullable(),
});
export type ReferenceConfig = z.infer<typeof ReferenceConfigSchema>;

const ArtifactFingerprintSchema = z.object({
  sha256: z.string().nullable(),
  path: z.string().nullable(),
  media_present: z.boolean(),
  additional: z.array(
    z.object({
      label: z.string().min(1),
      sha256: z.string().min(1),
      duration_seconds: z.number().nullable(),
    }),
  ),
  note: z.string().nullable(),
});
export type ArtifactFingerprint = z.infer<typeof ArtifactFingerprintSchema>;

const AnnotationsSchema = z.object({
  transcript_path: z.string().nullable(),
  scene_annotation_path: z.string().nullable(),
  notes: z.string().nullable(),
});
export type Annotations = z.infer<typeof AnnotationsSchema>;

const ComparisonSectionSchema = z.object({
  lab_artifact_id: z.string().nullable(),
  lab_pipeline: z.string().nullable(),
  metrics: z.array(ComparisonMetricSchema),
});
export type ComparisonSection = z.infer<typeof ComparisonSectionSchema>;

export const ComparisonRecordSchema = z.object({
  recordType: z.literal(COMPARISON_RECORD_TYPE),
  schemaVersion: z.string().min(1),
  id: z.string().min(1),
  kind: z.enum(RECORD_KINDS),
  timestamp_utc: z.string().min(1),
  operator: z.string().min(1),
  surface: z.enum(SURFACES),
  dimension: z.string().min(1),
  reference_config: ReferenceConfigSchema,
  source_fingerprint: z.string().nullable(),
  artifact_fingerprint: ArtifactFingerprintSchema,
  captured_utc: z.string().nullable(),
  duration_seconds: z.number().nullable(),
  custom_prompt: z.string().nullable(),
  observations: z.array(ObservationSchema).min(1),
  annotations: AnnotationsSchema,
  comparison: ComparisonSectionSchema,
  confidence: z.enum(CONFIDENCE_LEVELS),
  unresolved_behavior: z.array(z.string()),
  tl_hooks: z.array(z.string()),
  evidence_paths: z.array(z.string()).min(1),
  status: z.string().min(1),
});
export type ComparisonRecord = z.infer<typeof ComparisonRecordSchema>;

// ---------------------------------------------------------------------------
// Invariant rules (beyond shape — the required-either-value-or-pending spine)
// ---------------------------------------------------------------------------

export interface InvariantViolation {
  readonly record: string;
  readonly metric?: string;
  readonly rule: string;
  readonly detail: string;
}

function valuePresent(side: MetricSide): boolean {
  return side.value !== null && side.value !== undefined;
}

/**
 * The mechanical honesty rules. Returns the violation list (empty = clean).
 * Throw-friendly wrapper: assertInvariants.
 */
export function checkInvariants(record: ComparisonRecord): InvariantViolation[] {
  const violations: InvariantViolation[] = [];
  const push = (rule: string, detail: string, metric?: string): void => {
    violations.push({ record: record.id, metric, rule, detail });
  };

  for (const metric of record.comparison.metrics) {
    if (metric.verdict === 'PENDING') {
      if (metric.pending_reason !== PENDING_REASON) {
        push(
          'pending-reason-required',
          `verdict PENDING requires pending_reason "${PENDING_REASON}"`,
          metric.metric,
        );
      }
      if (valuePresent(metric.product)) {
        push(
          'pending-product-must-be-null',
          'a PENDING metric must not carry a product value (never fabricate product-side numbers)',
          metric.metric,
        );
      }
      if (metric.lab.value !== null && metric.lab.source === null) {
        push('lab-value-requires-source', 'a non-null lab value requires a source', metric.metric);
      }
    } else {
      if (!valuePresent(metric.lab)) {
        push('verdict-requires-lab-value', `${metric.verdict} requires a non-null lab value`, metric.metric);
      }
      if (!valuePresent(metric.product)) {
        push(
          'verdict-requires-product-value',
          `${metric.verdict} requires a non-null product value`,
          metric.metric,
        );
      }
      if (metric.pending_reason !== null) {
        push(
          'verdict-forbids-pending-reason',
          `${metric.verdict} must not carry a pending_reason`,
          metric.metric,
        );
      }
      if (metric.product.value !== null && metric.product.source === null) {
        push(
          'product-value-requires-source',
          'a non-null product value requires a source (traceability to a committed record)',
          metric.metric,
        );
      }
    }
    if (metric.measurement_class === 'instrument-truth' && metric.verdict !== 'PENDING') {
      push(
        'instrument-truth-never-compared',
        'instrument-truth metrics are recorded as observations, never compared as like-for-like (binding measurement-class note)',
        metric.metric,
      );
    }
  }

  if (record.kind === 'dimension-comparison' && record.comparison.metrics.length === 0) {
    push('dimension-requires-metrics', 'dimension-comparison records carry >= 1 metric');
  }
  if (record.kind === 'pending-slot') {
    if (record.comparison.metrics.length === 0) {
      push('pending-slot-requires-metrics', 'pending-slot records carry >= 1 metric');
    }
    for (const metric of record.comparison.metrics) {
      if (metric.verdict !== 'PENDING') {
        push('pending-slot-all-pending', `pending-slot metric ${metric.metric} must be PENDING`);
      }
    }
    if (record.tl_hooks.length === 0) {
      push('pending-slot-requires-tl-hook', 'pending-slot records carry >= 1 TL hook for post-capture fill');
    }
  }
  if (record.kind === 'estate-capture') {
    if (record.artifact_fingerprint.sha256 === null && record.artifact_fingerprint.additional.length === 0) {
      push(
        'estate-requires-artifact-fingerprint',
        'estate-capture records carry the capture sha256 (or >= 1 additional artifact fingerprints)',
      );
    }
    if (record.comparison.metrics.length > 0) {
      push(
        'estate-carries-no-metrics',
        'estate-capture records are capture-side only; comparisons live in dimension-comparison records',
      );
    }
  }
  if (record.comparison.metrics.some((m) => m.verdict === 'PENDING') && record.tl_hooks.length === 0) {
    push(
      'pending-metric-requires-record-tl-hook',
      'records with PENDING metrics carry >= 1 TL hook',
    );
  }
  for (const observation of record.observations) {
    if (!EVIDENCE_LABELS.includes(observation.label)) {
      push('observation-label-vocabulary', `unlabeled observation: ${observation.text.slice(0, 60)}`);
    }
  }
  return violations;
}

export function assertRecordValid(record: ComparisonRecord): void {
  const violations = checkInvariants(record);
  if (violations.length > 0) {
    const lines = violations
      .map((v) => `  [${v.rule}] ${v.metric ?? '-'}: ${v.detail}`)
      .join('\n');
    throw new Error(`comparison record ${record.id} violates invariants:\n${lines}`);
  }
}

// ---------------------------------------------------------------------------
// Serialization (deterministic YAML; JSON sidecars use stable stringify)
// ---------------------------------------------------------------------------

/** Canonical YAML emission — a pure function of the record. */
export function serializeRecord(record: ComparisonRecord): string {
  return emitYaml(record as unknown as { readonly [key: string]: YamlValue });
}

/** Parse + schema-validate a YAML record document. */
export function parseRecord(text: string): ComparisonRecord {
  const parsed = parseYaml(text);
  const result = ComparisonRecordSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`comparison record failed schema validation: ${result.error.message}`);
  }
  return result.data;
}

/** Deterministic JSON.stringify (sorted keys are NOT used — insertion order is canonical). */
export function stableJsonStringify(value: unknown): string {
  return `${JSON.stringify(value)}\n`;
}
