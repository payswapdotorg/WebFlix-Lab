/**
 * Audio benchmark generator (WFLX-W2, Stage 2).
 *
 * Usage: bun run audio:benchmark
 *
 * Regenerates the committed benchmark artifacts deterministically:
 *
 *  artifacts/audio/benchmark-deep-dive-42s/   — SHORT audio-local benchmark:
 *      overview.wav (committed, ~3.7 MB placeholder audio)
 *      artifact.json, timing-manifest.json, qa-report.json (committed)
 *  artifacts/audio/canonical-deep-dive-5min/  — CANONICAL W1 fixture run:
 *      artifact.json, timing-manifest.json, qa-report.json committed;
 *      overview.wav is fingerprinted (sha256 in artifact.json) but NOT
 *      committed (~27 MB) — the golden-media precedent (reference video is
 *      fingerprinted, not committed). Byte-identical regeneration is
 *      enforced by tests/audio/determinism.test.ts and the e2e parity test.
 *
 * benchmark-run.json records honest, run-specific latency/cost measurements
 * (NOT byte-reproducible; labeled as such).
 *
 * All speech is the offline deterministic placeholder — zero provider cost,
 * recorded honestly; NOT product-parity evidence (AGENTS.md).
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { compileAudioOverview } from '../../src/audio';
import { stableStringify } from '../../src/audio/dialogue/engine';
import {
  buildShortBenchmarkPlan,
  CANONICAL_GRAPH,
  CANONICAL_PLAN,
  CANONICAL_SOURCE,
  FIXED_NOW,
  FIXED_SEED,
} from './fixtures';

const ARTIFACTS_ROOT = 'artifacts/audio';

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${stableStringify(value)}\n`, 'utf8');
}

async function generateBenchmark(): Promise<void> {
  const startedAt = performance.now();

  // --- short audio-local benchmark (fully committed) ---
  const shortPlan = buildShortBenchmarkPlan();
  const short = await compileAudioOverview({
    plan: shortPlan,
    graph: CANONICAL_GRAPH,
    sources: CANONICAL_SOURCE,
    options: {
      seed: FIXED_SEED,
      now: FIXED_NOW,
      mastering: 'pure-ts', // pinned: byte-reproducible across environments
      recordLatency: false,
    },
  });
  const shortDir = join(ARTIFACTS_ROOT, 'benchmark-deep-dive-42s');
  mkdirSync(shortDir, { recursive: true });
  writeFileSync(join(shortDir, 'overview.wav'), short.wav);
  writeJson(join(shortDir, 'artifact.json'), short.artifact);
  writeJson(join(shortDir, 'timing-manifest.json'), short.timing);
  writeJson(join(shortDir, 'qa-report.json'), short.qa);
  console.log(`[benchmark] ${shortDir}: ${short.artifact.id}`);
  console.log(`[benchmark]   wav sha256: ${short.artifact.media.sha256}`);
  console.log(`[benchmark]   duration: ${(short.timing.totalDurationMs / 1000).toFixed(2)} s, qa: ${short.qa.status}`);

  // --- canonical 300 s run (sidecars committed; media fingerprinted only) ---
  const canonical = await compileAudioOverview({
    plan: CANONICAL_PLAN,
    graph: CANONICAL_GRAPH,
    sources: CANONICAL_SOURCE,
    options: {
      seed: FIXED_SEED,
      now: FIXED_NOW,
      mastering: 'pure-ts',
      recordLatency: false,
    },
  });
  const canonicalDir = join(ARTIFACTS_ROOT, 'canonical-deep-dive-5min');
  mkdirSync(canonicalDir, { recursive: true });
  // Media NOT committed (~27 MB): the sha256 in artifact.json fingerprints it.
  writeJson(join(canonicalDir, 'artifact.json'), canonical.artifact);
  writeJson(join(canonicalDir, 'timing-manifest.json'), canonical.timing);
  writeJson(join(canonicalDir, 'qa-report.json'), canonical.qa);
  console.log(`[benchmark] ${canonicalDir}: ${canonical.artifact.id}`);
  console.log(`[benchmark]   wav sha256 (fingerprint only, media not committed): ${canonical.artifact.media.sha256}`);
  console.log(`[benchmark]   duration: ${(canonical.timing.totalDurationMs / 1000).toFixed(2)} s, qa: ${canonical.qa.status}`);

  // --- honest run report (latency/cost; run-specific by nature) ---
  const elapsedMs = Math.round(performance.now() - startedAt);
  const runReport = {
    recordType: 'wflx-audio-benchmark-run',
    generatedBy: 'tests/audio/generate-benchmark.ts',
    note: 'Run-specific measurements (wall-clock latency is NOT reproducible; sidecars above are). Offline path: zero provider cost, recorded honestly. Placeholder audio is not product parity evidence.',
    seed: FIXED_SEED,
    now: FIXED_NOW,
    elapsedMs,
    runs: [
      {
        planId: shortPlan.id,
        artifactId: short.artifact.id,
        targetDurationSeconds: shortPlan.targetDurationSeconds,
        turnCount: short.turns.length,
        qaStatus: short.qa.status,
        provider: 'deterministic-offline-tts',
        providerCostUsd: 0,
        mastering: 'pure-ts',
      },
      {
        planId: CANONICAL_PLAN.id,
        artifactId: canonical.artifact.id,
        targetDurationSeconds: CANONICAL_PLAN.targetDurationSeconds,
        turnCount: canonical.turns.length,
        qaStatus: canonical.qa.status,
        provider: 'deterministic-offline-tts',
        providerCostUsd: 0,
        mastering: 'pure-ts',
      },
    ],
  };
  writeJson(join(ARTIFACTS_ROOT, 'benchmark-run.json'), runReport);
  console.log(`[benchmark] ${ARTIFACTS_ROOT}/benchmark-run.json: ${elapsedMs} ms total (run-specific)`);
}

await generateBenchmark();
