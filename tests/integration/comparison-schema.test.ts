/**
 * Comparison-record schema tests (WFLX-P3 Deliverable A validation / EV-023).
 *
 * Runs over the REAL committed comparison-record estate:
 *   docs/experiments/comparisons/estate/*.yaml   (11 ingested capture records)
 *   docs/experiments/comparisons/audio/*.yaml    (8 audio dimension records)
 *   docs/experiments/comparisons/video/*.yaml    (6 video dimension records)
 *
 * Asserts:
 *   1. SCHEMA — every committed record parses (the hand-rolled YAML subset)
 *      and validates against the canonical zod schema;
 *   2. ROUND-TRIP — parse -> re-emit is byte-identical for every record;
 *   3. REGENERATION — the in-memory builders (ingester + suites) reproduce
 *      the committed docs estate byte-identically (determinism spine);
 *   4. REQUIRED-EITHER-VALUE-OR-PENDING — every VERIFIED/DIVERGENT metric
 *      carries BOTH lab and product values; every PENDING metric carries
 *      the exact "COMPARISON PENDING REFERENCE CAPTURE" reason with a NULL
 *      product value; every non-null product value carries a source pointer
 *      (traceability to a committed record — never fabricated);
 *   5. PENDING-DISCIPLINE — pending-slot records are all-PENDING with
 *      TL-hooks; records containing PENDING metrics carry TL-hooks.
 *
 * Lab tooling only — NOT product parity evidence (AGENTS.md; tests/README.md).
 */

import { describe, expect, test } from 'bun:test';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ComparisonRecordSchema,
  PENDING_REASON,
  checkInvariants,
  parseRecord,
  serializeRecord,
  type ComparisonRecord,
} from '../../tools/comparison/schema';
import { loadEstate } from '../../tools/comparison/ingest';
import { runAudioComparisonSuite } from '../../tools/comparison/audio-suite';
import { buildVideoComparisonRecordsFromCommittedStore } from '../../tools/comparison/video-hooks';

const RECORD_SETS = [
  { docsDir: 'docs/experiments/comparisons/estate', expectedCount: 11 },
  { docsDir: 'docs/experiments/comparisons/audio', expectedCount: 8 },
  { docsDir: 'docs/experiments/comparisons/video', expectedCount: 6 },
] as const;

function readCommittedRecords(): { path: string; record: ComparisonRecord }[] {
  const records: { path: string; record: ComparisonRecord }[] = [];
  for (const set of RECORD_SETS) {
    if (!existsSync(set.docsDir)) throw new Error(`committed record set missing: ${set.docsDir}`);
    const files = readdirSync(set.docsDir).filter((name) => name.endsWith('.yaml')).sort();
    expect(files.length).toBe(set.expectedCount);
    for (const name of files) {
      const path = join(set.docsDir, name);
      records.push({ path, record: parseRecord(readFileSync(path, 'utf8')) });
    }
  }
  return records;
}

describe('comparison-record schema (EV-023)', () => {
  test('every committed record parses and schema-validates', () => {
    const records = readCommittedRecords();
    expect(records.length).toBe(25);
    for (const { path, record } of records) {
      // parseRecord already validates; re-validate explicitly for the error path.
      const result = ComparisonRecordSchema.safeParse(JSON.parse(JSON.stringify(record)));
      expect(result.success).toBe(true);
      expect(record.recordType).toBe('ComparisonRecord');
      expect(record.schemaVersion).toBe('1.0.0');
      expect(record.observations.length).toBeGreaterThan(0);
      expect(record.evidence_paths.length).toBeGreaterThan(0);
      void path;
    }
  });

  test('every committed record round-trips byte-identically', () => {
    for (const { path, record } of readCommittedRecords()) {
      const committed = readFileSync(path, 'utf8');
      expect(serializeRecord(record)).toBe(committed);
    }
  });

  test('the ingester regenerates the committed estate records byte-identically', () => {
    const estate = loadEstate();
    expect(estate.records.length).toBe(11);
    for (const record of estate.records) {
      const committed = readFileSync(join('docs/experiments/comparisons/estate', `${record.id}.yaml`), 'utf8');
      expect(serializeRecord(record)).toBe(committed);
    }
  });

  test('the video hook harness regenerates the committed video records byte-identically', () => {
    const records = buildVideoComparisonRecordsFromCommittedStore();
    expect(records.length).toBe(6);
    for (const record of records) {
      const committed = readFileSync(join('docs/experiments/comparisons/video', `${record.id}.yaml`), 'utf8');
      expect(serializeRecord(record)).toBe(committed);
    }
  });

  test('required-either-value-or-pending holds on every committed metric', () => {
    for (const { record } of readCommittedRecords()) {
      for (const metric of record.comparison.metrics) {
        if (metric.verdict === 'PENDING') {
          expect(metric.pending_reason).toBe(PENDING_REASON);
          expect(metric.product.value).toBeNull();
        } else {
          expect(metric.lab.value).not.toBeNull();
          expect(metric.product.value).not.toBeNull();
          expect(metric.pending_reason).toBeNull();
          expect(metric.product.source).not.toBeNull();
        }
        if (metric.measurement_class === 'instrument-truth') {
          // Binding measurement-class note: instrument truth is recorded as
          // observations, never compared like-for-like.
          expect(metric.verdict).toBe('PENDING');
        }
      }
    }
  });

  test('invariant checker passes on every committed record', () => {
    for (const { record } of readCommittedRecords()) {
      const violations = checkInvariants(record);
      expect(violations).toEqual([]);
    }
  });

  test('pending-slot discipline: all-PENDING metrics + TL hooks', () => {
    const pendingSlots = readCommittedRecords().filter(({ record }) => record.kind === 'pending-slot');
    const ids = pendingSlots.map(({ record }) => record.id).sort();
    expect(ids).toEqual([
      'AUDIO-PARITY-08',
      'VIDEO-PARITY-02',
      'VIDEO-PARITY-05',
      'VIDEO-PARITY-06',
    ]);
    for (const { record } of pendingSlots) {
      expect(record.comparison.metrics.length).toBeGreaterThan(0);
      for (const metric of record.comparison.metrics) {
        expect(metric.verdict).toBe('PENDING');
        expect(metric.pending_reason).toBe(PENDING_REASON);
      }
      expect(record.tl_hooks.length).toBeGreaterThan(0);
    }
  });

  test('every record with a PENDING metric carries a TL hook', () => {
    for (const { record } of readCommittedRecords()) {
      const hasPending = record.comparison.metrics.some((metric) => metric.verdict === 'PENDING');
      if (hasPending) expect(record.tl_hooks.length).toBeGreaterThan(0);
    }
  });

  test('estate captures carry artifact fingerprints and labeled observations only', () => {
    for (const { record } of readCommittedRecords()) {
      if (record.kind !== 'estate-capture') continue;
      const hasFingerprint =
        record.artifact_fingerprint.sha256 !== null || record.artifact_fingerprint.additional.length > 0;
      expect(hasFingerprint).toBe(true);
      expect(record.comparison.metrics).toEqual([]);
      for (const observation of record.observations) {
        expect(['OBSERVED', 'DOCUMENTED', 'HYPOTHESIS', 'REPRODUCED', 'UNRESOLVED']).toContain(
          observation.label,
        );
        expect(observation.source.length).toBeGreaterThan(0);
      }
    }
  });

  test('the audio suite regenerates the committed audio records byte-identically', async () => {
    const suite = await runAudioComparisonSuite();
    expect(suite.records.length).toBe(8);
    for (const record of suite.records) {
      const committed = readFileSync(join('docs/experiments/comparisons/audio', `${record.id}.yaml`), 'utf8');
      expect(serializeRecord(record)).toBe(committed);
    }
  }, 120_000);
});
