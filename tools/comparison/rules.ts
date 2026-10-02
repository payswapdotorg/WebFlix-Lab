/**
 * Declared mechanical verdict rules (WFLX-P3 / EV-023+024).
 *
 * Every numeric comparison verdict is produced by a rule DECLARED HERE —
 * never ad-hoc in a record. The rule identity and its parameters are
 * recorded in the metric's `delta` field so a reviewer can re-derive every
 * verdict from the two values alone.
 *
 * Verdict vocabulary: VERIFIED / DIVERGENT / PENDING (work order §3).
 * PENDING is produced ONLY by pendingMetric() — a missing product-side
 * capture, never a judgment call.
 */

import type { ComparisonMetric, ConfidenceLevel, MetricSide, Verdict } from './schema';
import { PENDING_REASON } from './schema';

/**
 * Declared duration-ratio band: product/lab within [0.75, 1.3333] (±1/3)
 * reads as the same duration class; outside reads DIVERGENT.
 * Rationale: the lab's placeholder narration pins realized duration to the
 * planning target exactly, so a ±1/3 envelope is the coarsest honest
 * "same class" reading (e.g. lab brief 120 s vs product brief 93.92 s).
 */
export const DURATION_RATIO_BAND = { lo: 0.75, hi: 1.3333 } as const;

/** Declared percentage-point tolerance for shift/percentage comparisons. */
export const PERCENT_POINT_TOLERANCE = 5;

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export interface MetricInput {
  readonly metric: string;
  readonly unit?: string | null;
  readonly lab: {
    readonly value: number | string | boolean;
    readonly source: string;
    readonly note?: string | null;
  };
  readonly product: {
    readonly value: number | string | boolean;
    readonly source: string;
    readonly note?: string | null;
  };
  readonly confidence: ConfidenceLevel;
  readonly note?: string | null;
}

function side(side: MetricInput['lab']): MetricSide {
  return { value: side.value, source: side.source, note: side.note ?? null };
}

/** Verdict by numeric ratio band (rule: duration-ratio-band). */
export function ratioBandMetric(input: MetricInput): ComparisonMetric {
  const lab = input.lab.value;
  const product = input.product.value;
  if (typeof lab !== 'number' || typeof product !== 'number') {
    throw new Error(`ratioBandMetric(${input.metric}): both values must be numeric`);
  }
  const ratio = product / lab;
  const verdict: Verdict = ratio >= DURATION_RATIO_BAND.lo && ratio <= DURATION_RATIO_BAND.hi ? 'VERIFIED' : 'DIVERGENT';
  return {
    metric: input.metric,
    unit: input.unit ?? null,
    measurement_class: 'like-for-like',
    lab: side(input.lab),
    product: side(input.product),
    delta: `product/lab = ${round(ratio, 4)} (lab ${lab}, product ${product}) — rule duration-ratio-band [${DURATION_RATIO_BAND.lo}, ${DURATION_RATIO_BAND.hi}]`,
    verdict,
    pending_reason: null,
    confidence: input.confidence,
    note: input.note ?? null,
  };
}

/** Verdict by exact equality of the two values (rule: equality). */
export function equalityMetric(input: MetricInput): ComparisonMetric {
  const equal = input.lab.value === input.product.value;
  const delta =
    typeof input.lab.value === 'number' && typeof input.product.value === 'number'
      ? `lab ${input.lab.value}, product ${input.product.value} — delta ${round((input.product.value as number) - (input.lab.value as number), 4)} — rule equality`
      : `lab ${JSON.stringify(input.lab.value)}, product ${JSON.stringify(input.product.value)} — rule equality`;
  return {
    metric: input.metric,
    unit: input.unit ?? null,
    measurement_class: 'like-for-like',
    lab: side(input.lab),
    product: side(input.product),
    delta,
    verdict: equal ? 'VERIFIED' : 'DIVERGENT',
    pending_reason: null,
    confidence: input.confidence,
    note: input.note ?? null,
  };
}

/**
 * Verdict for percentage-shift comparisons (rule: percent-point-tolerance):
 * |labShift% − productShift%| <= PERCENT_POINT_TOLERANCE reads VERIFIED.
 */
export function percentPointMetric(input: MetricInput): ComparisonMetric {
  const lab = input.lab.value;
  const product = input.product.value;
  if (typeof lab !== 'number' || typeof product !== 'number') {
    throw new Error(`percentPointMetric(${input.metric}): both values must be numeric percentages`);
  }
  const gap = Math.abs(product - lab);
  return {
    metric: input.metric,
    unit: input.unit ?? '%',
    measurement_class: 'like-for-like',
    lab: side(input.lab),
    product: side(input.product),
    delta: `lab ${lab}%, product ${product}% — |Δ| ${round(gap, 2)} pp — rule percent-point-tolerance <= ${PERCENT_POINT_TOLERANCE} pp`,
    verdict: gap <= PERCENT_POINT_TOLERANCE ? 'VERIFIED' : 'DIVERGENT',
    pending_reason: null,
    confidence: input.confidence,
    note: input.note ?? null,
  };
}

export interface QualitativeMetricInput {
  readonly metric: string;
  readonly lab: {
    readonly text: string;
    readonly source: string;
  };
  readonly product: {
    readonly text: string;
    readonly source: string;
  };
  /** The alignment judgment, cited to evidence-labeled observations on both sides. */
  readonly verdict: Verdict;
  readonly confidence: ConfidenceLevel;
  readonly note?: string | null;
}

/**
 * Qualitative alignment metric (rule: cited-qualitative-alignment): both
 * sides carry their evidence-labeled statement; the verdict is the recorded
 * alignment judgment between those two statements (lab side REPRODUCED /
 * DOCUMENTED, product side OBSERVED in the estate records).
 */
export function qualitativeMetric(input: QualitativeMetricInput): ComparisonMetric {
  return {
    metric: input.metric,
    unit: null,
    measurement_class: 'qualitative',
    lab: { value: input.lab.text, source: input.lab.source, note: null },
    product: { value: input.product.text, source: input.product.source, note: null },
    delta: 'rule cited-qualitative-alignment (statements recorded; judgment cited to both-side observations)',
    verdict: input.verdict,
    pending_reason: null,
    confidence: input.confidence,
    note: input.note ?? null,
  };
}

export interface PendingMetricInput {
  readonly metric: string;
  readonly unit?: string | null;
  readonly lab?: {
    readonly value: number | string | boolean;
    readonly source: string;
    readonly note?: string | null;
  };
  readonly note?: string | null;
}

/**
 * PENDING metric — the product-side capture does not exist. The worker NEVER
 * fabricates product-side numbers: the gap is recorded, never guessed.
 */
export function pendingMetric(input: PendingMetricInput): ComparisonMetric {
  return {
    metric: input.metric,
    unit: input.unit ?? null,
    measurement_class: 'like-for-like',
    lab:
      input.lab === undefined
        ? { value: null, source: null, note: null }
        : { value: input.lab.value, source: input.lab.source, note: input.lab.note ?? null },
    product: { value: null, source: null, note: null },
    delta: null,
    verdict: 'PENDING',
    pending_reason: PENDING_REASON,
    confidence: 'low',
    note: input.note ?? PENDING_REASON,
  };
}

/** Format helper: delta between two durations in seconds with percent. */
export function durationDelta(labSeconds: number, productSeconds: number): string {
  const diff = productSeconds - labSeconds;
  const pct = labSeconds === 0 ? 0 : (diff / labSeconds) * 100;
  return `${round(diff, 2)} s (${round(pct, 1)}%)`;
}
