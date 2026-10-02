/**
 * Audio parity comparison runner (WFLX-P3 Deliverable B / EV-024).
 *
 * Executes tools/comparison/audio-suite.ts (the repeatable harness: compile
 * the LAB-canonical source through the offline deterministic lab pipeline,
 * compute the metric family, pull product values from the ingested estate)
 * and emits the comparison records:
 *
 *   docs/experiments/comparisons/audio/AUDIO-PARITY-01..08.yaml  (canonical)
 *   artifacts/reference/comparisons/audio/*.json                  (sidecars)
 *   artifacts/reference/comparisons/audio/audio-parity-summary.json
 *
 * Deterministic end-to-end: fixed stamps/seeds; re-running reproduces the
 * committed records byte-identically (asserted by the integration tests).
 *
 * Honest boundaries: comparisons are against CAPTURED artifacts (the
 * scheduling-lane behavior change is banked truth); dimensions without a
 * product-side capture (LAB-10 custom prompt, Interactive Audio) are
 * recorded COMPARISON PENDING REFERENCE CAPTURE.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runAudioComparisonSuite } from '../tools/comparison/audio-suite';
import { serializeRecord } from '../tools/comparison/schema';
import { emitYaml, type YamlValue } from '../tools/comparison/yaml';

const DOCS_OUT = 'docs/experiments/comparisons/audio';
const JSON_OUT = 'artifacts/reference/comparisons/audio';

async function main(): Promise<void> {
  const started = Date.now();
  const suite = await runAudioComparisonSuite();
  mkdirSync(DOCS_OUT, { recursive: true });
  mkdirSync(JSON_OUT, { recursive: true });
  for (const record of suite.records) {
    writeFileSync(join(DOCS_OUT, `${record.id}.yaml`), serializeRecord(record), 'utf8');
    writeFileSync(join(JSON_OUT, `${record.id}.json`), `${JSON.stringify(record, null, 2)}\n`, 'utf8');
  }
  const summary = {
    program: 'WFLX-P3 audio parity comparison suite (EV-024)',
    stamp: '2026-10-01T20:00:00Z',
    runner: 'experiments/run-comparison-audio.ts',
    harness: 'tools/comparison/audio-suite.ts',
    recordCount: suite.records.length,
    records: suite.records.map((record) => ({
      id: record.id,
      dimension: record.dimension,
      kind: record.kind,
      verdicts: record.comparison.metrics.map((metric) => metric.verdict),
    })),
    determinismSpotCheck: suite.determinism,
    mutationLocality: suite.mutationLocality,
    arms: Object.fromEntries(
      Object.entries(suite.arms).map(([runId, arm]) => [
        runId,
        {
          turnCount: arm.turnCount,
          beatCount: arm.beatCount,
          speakers: arm.speakers,
          coveredClaims: arm.coveredClaims,
          omittedClaims: arm.omittedClaims,
          totalTurnSeconds: arm.totalTurnSeconds,
          wordsPerSecondMean: arm.wordsPerSecondMean,
          artifactId: arm.artifactId,
        },
      ]),
    ),
    honestBoundaries: [
      'comparisons are against the CAPTURED LAB-series artifacts, never live re-runs (the 2026-10-01 scheduling-lane behavior change is banked truth)',
      'lab placeholder narration pins realized duration to planning targets (0% shift by construction where noted — measurement-class notes are in the records)',
      'AUDIO-PARITY-07 (custom prompt, LAB-10) and AUDIO-PARITY-08 (Interactive Audio) are COMPARISON PENDING REFERENCE CAPTURE',
    ],
  };
  writeFileSync(
    join(JSON_OUT, 'audio-parity-summary.json'),
    emitYaml(summary as unknown as { readonly [key: string]: YamlValue }),
    'utf8',
  );
  const verdictCounts = { VERIFIED: 0, DIVERGENT: 0, PENDING: 0 };
  for (const record of suite.records) {
    for (const metric of record.comparison.metrics) verdictCounts[metric.verdict] += 1;
  }
  console.log(
    `[cmp:audio] ${suite.records.length} records -> ${DOCS_OUT}/ + ${JSON_OUT}/ ` +
      `(${verdictCounts.VERIFIED} VERIFIED / ${verdictCounts.DIVERGENT} DIVERGENT / ${verdictCounts.PENDING} PENDING metrics) ` +
      `in ${((Date.now() - started) / 1000).toFixed(1)}s`,
  );
}

await main();
