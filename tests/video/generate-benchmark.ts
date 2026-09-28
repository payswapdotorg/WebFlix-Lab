/**
 * Video benchmark generator (WFLX-W3, Phase 2B).
 *
 * Usage: bun run video:benchmark
 *
 * Regenerates the committed benchmark artifacts:
 *
 *  artifacts/video/benchmark-explainer-26s/   — SHORT all-types benchmark:
 *      overview.mp4 (committed; every visual type exercised once),
 *      artifact.json, qa-report.json, timeline.json, determinism.json
 *  artifacts/video/canonical-explainer-7min/  — CANONICAL W1 fixture run:
 *      sidecars committed; overview.mp4 is fingerprinted (sha256 in
 *      artifact.json) but NOT committed — the golden-media precedent
 *      (the 65 MB reference video is fingerprinted, not committed).
 *
 * benchmark-run.json records honest, run-specific latency measurements and
 * the composition backend used (wall-clock is NOT reproducible; labeled).
 *
 * Determinism layers (enforced by tests/video): scene SVGs, timeline,
 * narration WAV and QA reports are byte-identical for identical inputs.
 * The MP4 encode depends on the h264 encoder build; on a fixed environment
 * it is stable, but byte-stability ACROSS environments is not claimed —
 * the pinned reproducibility artifact is the SVG determinism hash.
 *
 * Offline placeholder narration and deterministic-ink illustrations are
 * NOT product parity evidence (AGENTS.md).
 */

import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtempSync } from 'node:fs';
import { compileVideoOverview, findHeadlessBrowser } from '../../src/video';
import { stableStringify } from '../../src/video/storyboard/compiler';
import { CANONICAL_GRAPH, CANONICAL_VIDEO_PLAN, FIXED_NOW, FIXED_SEED, buildAllTypesPlan } from './fixtures';

const ARTIFACTS_ROOT = 'artifacts/video';

// WFLX_BENCHMARK_TARGET = all (default) | short | canonical — lets the two
// renders run as separate foreground invocations on hosts that kill
// long-running background children.
const TARGET = (process.env.WFLX_BENCHMARK_TARGET ?? 'all') as 'all' | 'short' | 'canonical';

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${stableStringify(value)}\n`, 'utf8');
}

interface RunRecord {
  readonly generatedAt: string;
  readonly backend: string;
  readonly browser: string | null;
  readonly runs: {
    readonly name: string;
    readonly durationSeconds: number;
    readonly wallClockSeconds: number;
    readonly outputBytes: number;
    readonly sceneSvgBytes: number;
    readonly determinismHash: string;
  }[];
  readonly note: string;
}

async function run(
  name: string,
  plan: Parameters<typeof compileVideoOverview>[0],
): Promise<{
  result: Awaited<ReturnType<typeof compileVideoOverview>>;
  wallClockSeconds: number;
}> {
  const startedAt = performance.now();
  const workDir = mkdtempSync(join(tmpdir(), 'wflx-benchmark-'));
  const output = join(workDir, 'overview.mp4');
  const browser = findHeadlessBrowser();
  const result = await compileVideoOverview(plan, CANONICAL_GRAPH, {
    output,
    now: FIXED_NOW,
    seed: FIXED_SEED,
    backend: browser !== null ? 'remotion' : 'fallback',
    ...(browser !== null ? { browserExecutable: browser } : {}),
    workDir,
  });
  const wallClockSeconds = (performance.now() - startedAt) / 1000;
  return { result, wallClockSeconds };
}

async function generateBenchmark(): Promise<void> {
  const browser = findHeadlessBrowser();
  const backend = browser !== null ? 'remotion' : 'fallback (no headless browser found)';
  console.log(`[benchmark] backend: ${backend} (target: ${TARGET})`);
  const runs: RunRecord['runs'] = [];

  if (TARGET === 'all' || TARGET === 'short') {
  // --- short all-types benchmark (fully committed) ---
  const short = await run('benchmark-explainer-26s', buildAllTypesPlan());
  const shortDir = join(ARTIFACTS_ROOT, 'benchmark-explainer-26s');
  mkdirSync(shortDir, { recursive: true });
  writeFileSync(join(shortDir, 'overview.mp4'), readFileSync(short.result.composition.output));
  writeJson(join(shortDir, 'artifact.json'), short.result.artifact);
  writeJson(join(shortDir, 'qa-report.json'), short.result.qa);
  writeJson(join(shortDir, 'timeline.json'), short.result.timeline);
  writeJson(
    join(shortDir, 'determinism.json'),
    {
      sceneSvgCombinedSha256: short.result.determinismProof.hashA,
      sceneSvgCombinedSha256SecondRun: short.result.determinismProof.hashB,
      byteIdentical: short.result.determinismProof.hashA === short.result.determinismProof.hashB,
      sceneSvgBytes: short.result.render.renderBytes,
      narrative: 'Scene SVGs are the pinned determinism layer; MP4 bytes depend on the encoder build.',
    },
  );
  runs.push({
    name: 'benchmark-explainer-26s',
    durationSeconds: short.result.timeline.durationSeconds,
    wallClockSeconds: Math.round(short.wallClockSeconds * 10) / 10,
    outputBytes: short.result.composition.sizeBytes,
    sceneSvgBytes: short.result.render.renderBytes,
    determinismHash: short.result.determinismProof.hashA,
  });
  console.log(
    `[benchmark] ${shortDir}: ${short.result.artifact.id} (${(short.result.timeline.durationSeconds).toFixed(0)}s, ${short.result.composition.sizeBytes} bytes, ${short.wallClockSeconds.toFixed(1)}s wall)`,
  );
  console.log(`[benchmark]   qa: ${short.result.qa.status}, svg hash ${short.result.determinismProof.hashA.slice(0, 16)}…`);
  }

  if (TARGET === 'all' || TARGET === 'canonical') {
  // --- canonical 420 s run (sidecars committed; media fingerprinted only) ---
  const canonical = await run('canonical-explainer-7min', CANONICAL_VIDEO_PLAN);
  const canonicalDir = join(ARTIFACTS_ROOT, 'canonical-explainer-7min');
  mkdirSync(canonicalDir, { recursive: true });
  writeJson(join(canonicalDir, 'artifact.json'), canonical.result.artifact);
  writeJson(join(canonicalDir, 'qa-report.json'), canonical.result.qa);
  writeJson(join(canonicalDir, 'timeline.json'), canonical.result.timeline);
  writeJson(
    join(canonicalDir, 'determinism.json'),
    {
      sceneSvgCombinedSha256: canonical.result.determinismProof.hashA,
      sceneSvgCombinedSha256SecondRun: canonical.result.determinismProof.hashB,
      byteIdentical: canonical.result.determinismProof.hashA === canonical.result.determinismProof.hashB,
      sceneSvgBytes: canonical.result.render.renderBytes,
      mp4FingerprintOnly: existsSync(canonical.result.composition.output),
      narrative: 'MP4 is fingerprinted in artifact.json (media.sha256) but not committed (golden-media precedent).',
    },
  );
  runs.push({
    name: 'canonical-explainer-7min',
    durationSeconds: canonical.result.timeline.durationSeconds,
    wallClockSeconds: Math.round(canonical.wallClockSeconds * 10) / 10,
    outputBytes: canonical.result.composition.sizeBytes,
    sceneSvgBytes: canonical.result.render.renderBytes,
    determinismHash: canonical.result.determinismProof.hashA,
  });
  console.log(
    `[benchmark] ${canonicalDir}: ${canonical.result.artifact.id} (${canonical.result.timeline.durationSeconds.toFixed(0)}s, ${canonical.result.composition.sizeBytes} bytes, ${canonical.wallClockSeconds.toFixed(1)}s wall)`,
  );
  console.log(`[benchmark]   qa: ${canonical.result.qa.status}, svg hash ${canonical.result.determinismProof.hashA.slice(0, 16)}…`);
  }

  if (runs.length === 0) {
    throw new Error(`unknown WFLX_BENCHMARK_TARGET '${TARGET}'`);
  }

  // --- honest run record (wall-clock is NOT reproducible) ---
  // Merge with any existing record so split invocations (short | canonical)
  // accumulate their runs instead of clobbering each other.
  const runRecordPath = join(ARTIFACTS_ROOT, 'benchmark-run.json');
  let mergedRuns = [...runs];
  if (existsSync(runRecordPath)) {
    try {
      const previous = JSON.parse(readFileSync(runRecordPath, 'utf8')) as { runs?: RunRecord['runs'] };
      const names = new Set(runs.map((entry) => entry.name));
      mergedRuns = [
        ...(previous.runs ?? []).filter((entry) => !names.has(entry.name)),
        ...runs,
      ];
    } catch {
      // Corrupt previous record — overwrite cleanly.
    }
  }
  const runRecord: RunRecord = {
    generatedAt: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
    backend,
    browser,
    runs: mergedRuns,
    note: 'Wall-clock measurements are run-specific and NOT reproducible; determinism layers are the scene SVGs, timeline, narration WAV and QA reports (see determinism.json). Offline placeholders throughout — NOT product parity evidence.',
  };
  writeJson(runRecordPath, runRecord);
  console.log(`[benchmark] ${runRecordPath} written`);
}

await generateBenchmark();
