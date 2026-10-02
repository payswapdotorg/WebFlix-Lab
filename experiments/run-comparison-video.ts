/**
 * Video comparison runner (WFLX-P3 Deliverable C / EV-025).
 *
 * Emits the canonical video comparison records fed by the ingested estate
 * (LAB-07/08/09 + the original Explainer reference + scene atlas) and the
 * COMMITTED video experiment outputs (the P2-era persisted measurements,
 * read verbatim — no composition re-run, no committed-store churn):
 *
 *   docs/experiments/comparisons/video/VIDEO-PARITY-01..06.yaml  (canonical)
 *   artifacts/reference/comparisons/video/*.json                  (sidecars)
 *   artifacts/reference/comparisons/video/video-parity-summary.json
 *
 * The three video runners (run-exp-v-s-01.ts, run-exp-v-cin-01.ts,
 * run-exp-e-refresh.ts) are WIRED to the same builders (tools/comparison/
 * video-hooks.ts) so future runs emit the schema-compliant records directly;
 * this runner canonicalizes the committed store into the docs estate.
 *
 * Honest boundaries: sceneDensity numbers are instrument truth (binding
 * measurement-class note — never compared like-for-like); the no-Cinematic-
 * product-format UI-truth is recorded as a scoping truth; language arm and
 * video mutation locality stay COMPARISON PENDING REFERENCE CAPTURE.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildVideoComparisonRecordsFromCommittedStore } from '../tools/comparison/video-hooks';
import { serializeRecord } from '../tools/comparison/schema';
import { emitYaml, type YamlValue } from '../tools/comparison/yaml';

const DOCS_OUT = 'docs/experiments/comparisons/video';
const JSON_OUT = 'artifacts/reference/comparisons/video';

function main(): void {
  const records = buildVideoComparisonRecordsFromCommittedStore();
  mkdirSync(DOCS_OUT, { recursive: true });
  mkdirSync(JSON_OUT, { recursive: true });
  for (const record of records) {
    writeFileSync(join(DOCS_OUT, `${record.id}.yaml`), serializeRecord(record), 'utf8');
    writeFileSync(join(JSON_OUT, `${record.id}.json`), `${JSON.stringify(record, null, 2)}\n`, 'utf8');
  }
  const verdictCounts = { VERIFIED: 0, DIVERGENT: 0, PENDING: 0 };
  for (const record of records) {
    for (const metric of record.comparison.metrics) verdictCounts[metric.verdict] += 1;
  }
  const summary = {
    program: 'WFLX-P3 video hook harness (EV-025)',
    stamp: '2026-10-01T20:00:00Z',
    runner: 'experiments/run-comparison-video.ts',
    harness: 'tools/comparison/video-hooks.ts',
    recordCount: records.length,
    records: records.map((record) => ({
      id: record.id,
      dimension: record.dimension,
      kind: record.kind,
      verdicts: record.comparison.metrics.map((metric) => metric.verdict),
    })),
    labMeasurementSources: 'committed P2 outputs read verbatim (artifacts/video/exp-v-s-01, exp-v-cin-01, exp-e-refresh, exp-v-l-01)',
    honestBoundaries: [
      'sceneDensity: ffmpeg cut counts (3/13/1) are INSTRUMENT TRUTH — binding measurement-class note: never compared like-for-like with structural plan units',
      'SCOPING TRUTH: no Cinematic product format exists (LAB-07 UI-truth) — VIDEO-PARITY-02 stays PENDING with the scoping note, not a parity claim',
      'video language arm + video mutation locality: COMPARISON PENDING REFERENCE CAPTURE (no product captures)',
      'generation wall-clock is not a stable observable (LAB-08: 28.4 vs 7.4 min on identical input) — recorded as observations only',
    ],
  };
  writeFileSync(
    join(JSON_OUT, 'video-parity-summary.json'),
    emitYaml(summary as unknown as { readonly [key: string]: YamlValue }),
    'utf8',
  );
  console.log(
    `[cmp:video] ${records.length} records -> ${DOCS_OUT}/ + ${JSON_OUT}/ ` +
      `(${verdictCounts.VERIFIED} VERIFIED / ${verdictCounts.DIVERGENT} DIVERGENT / ${verdictCounts.PENDING} PENDING metrics)`,
  );
}

main();
