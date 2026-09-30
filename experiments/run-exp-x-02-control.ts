/**
 * EXP-X-02 control arm — v1 planHash-keying compile runner (2026-09-30).
 *
 * Runs INSIDE the v1 control worktree (git worktree at 720f984, created by
 * experiments/run-exp-x-02.ts) so its `../src/audio` import resolves to the
 * V1 pipeline: the realizer keys seeded choices by (seed | planHash | turnId
 * | slot) and the timing gaps by (seed | planHash | gap-N | boundary) — the
 * plan-global keying that C-5 replaced (EV-006 EXP-A-04, EV-011 EXP-V-04).
 *
 * Applies the IDENTICAL defect + refinement recipe to the v1 tree's own
 * W1-frozen deep-dive fixture (byte-identical editorial content; only the
 * contractVersion stamps differ 1.0.0 vs 2.0.0 — the arms' contract-version
 * boundary), compiles baseline + edited plans twice each (whole-artifact
 * determinism proof) and writes one slim JSON report for the main runner:
 * per-turn realized diagnostics, per-turn text + synthesis-audio hashes, gap
 * timings, QA status, media hashes, wall-clocks.
 *
 * The script is committed on the wave branch for provenance and COPIED into
 * the worktree by the main runner before execution (the 720f984 tree predates
 * it); it typechecks against the v2 tree and runs against the v1 tree (the
 * compileAudioOverview / stableStringify surfaces are shape-compatible across
 * the boundary).
 *
 * Deterministic: fixed seed / fixed now / offline provider / pure-TS
 * mastering. Lab reproduction evidence only — NOT product-parity evidence
 * (AGENTS.md).
 */

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import {
  compileAudioOverview,
  stableStringify,
  type AudioOverviewResult,
} from '../src/audio';
import type { OverviewPlan, SemanticGraph, SourceArtifact } from '../src/contracts';

// ---------------------------------------------------------------------------
// Fixed experiment constants — MUST byte-match experiments/run-exp-x-02.ts
// (the shared recipe; the main runner is the single source of truth and this
// script re-declares it only because the worktree cannot import branch files)
// ---------------------------------------------------------------------------

const AUDIO_SEED = 'wflx-exp-x02-audio-seed';
const FIXED_NOW = '2026-09-30T00:00:00Z';

/** Target turn (the defect carrier): index 2 = turn-3. */
const TARGET_TURN_INDEX = 2;
const TARGET_TURN_ID = 'turn-3';
/** Defect: the W2/p3b over-packed-turn mutant class (single-turn gate failure). */
const DEFECT_CLAIM_IDS = [
  'claim-purpose',
  'claim-oss-runtimes',
  'claim-forecasting-projects',
] as const;
/** Refinement edit: brief word-count cap + duration 10 -> 18 s (same turn only). */
const EDIT_BRIEF_SUFFIX =
  ' Word-count cap (EXP-X-02 refinement): realization must fit the rate ceiling — anchors verbatim, glue minimal.';
const EDIT_DURATION_FROM = 10;
const EDIT_DURATION_TO = 18;

// ---------------------------------------------------------------------------
// Output shape (consumed by the main runner — one implementation of RunSlim)
// ---------------------------------------------------------------------------

export interface TurnSlim {
  readonly turnId: string;
  readonly textSha256: string;
  readonly wordCount: number;
  readonly budgetWords: number;
  readonly maxWords: number;
  readonly overBudget: boolean;
  readonly actualSeconds: number;
  readonly targetSeconds: number;
  readonly gapAfterMs: number;
  readonly boundaryAfter: string;
  /** words per synthesized second (the per-turn wps diagnostic). */
  readonly wps: number;
  readonly synthesisAudioSha256: string;
}

export interface RunSlim {
  readonly runId: string;
  readonly artifactId: string;
  readonly mediaSha256: string;
  readonly planFingerprint: string;
  readonly qaStatus: string;
  readonly overBudgetTurns: readonly {
    turnId: string;
    wordCount: number;
    maxWords: number;
    ratio: number;
  }[];
  readonly wallClockMs: number;
  readonly perTurn: readonly TurnSlim[];
  readonly totalDurationMs: number;
  readonly totalWords: number;
}

interface ControlReport {
  readonly arm: 'a-control-v1';
  readonly codeVersion: string;
  readonly contractVersion: string;
  readonly planId: string;
  readonly audioSeed: string;
  readonly fixedNow: string;
  readonly targetTurnId: string;
  readonly runs: { readonly baseline: RunSlim; readonly edited: RunSlim };
  readonly determinism: { readonly baselineIdentical: boolean; readonly editedIdentical: boolean };
}

// ---------------------------------------------------------------------------

const sha256 = (text: string): string =>
  createHash('sha256').update(text).digest('hex');

function slimFor(runId: string, artifactId: string, result: AudioOverviewResult, wallClockMs: number): RunSlim {
  const byTurn = new Map(result.timing.entries.map((entry) => [entry.turnId, entry]));
  const perTurn: TurnSlim[] = result.realized.map((turn) => {
    const timing = byTurn.get(turn.turnId);
    const synthesis = result.synthesis.find((entry) => entry.turnId === turn.turnId);
    return {
      turnId: turn.turnId,
      textSha256: sha256(turn.text),
      wordCount: turn.wordCount,
      budgetWords: turn.budgetWords,
      maxWords: turn.maxWords,
      overBudget: turn.overBudget,
      actualSeconds: timing?.actualSeconds ?? 0,
      targetSeconds: timing?.targetSeconds ?? 0,
      gapAfterMs: timing?.gapAfterMs ?? 0,
      boundaryAfter: timing?.boundaryAfter ?? 'none',
      wps: timing && timing.actualSeconds > 0 ? turn.wordCount / timing.actualSeconds : 0,
      synthesisAudioSha256: synthesis
        ? createHash('sha256').update(synthesis.audio.data).digest('hex')
        : '',
    };
  });
  return {
    runId,
    artifactId,
    mediaSha256: result.artifact.media.sha256,
    planFingerprint: sha256(stableStringify(result.plan)),
    qaStatus: result.qa.status,
    overBudgetTurns: result.realized
      .filter((turn) => turn.overBudget)
      .map((turn) => ({
        turnId: turn.turnId,
        wordCount: turn.wordCount,
        maxWords: turn.maxWords,
        ratio: turn.maxWords > 0 ? turn.wordCount / turn.maxWords : 0,
      })),
    wallClockMs,
    perTurn,
    totalDurationMs: result.timing.totalDurationMs,
    totalWords: result.realized.reduce((sum, turn) => sum + turn.wordCount, 0),
  };
}

async function compilePlan(
  plan: OverviewPlan,
  graph: SemanticGraph,
  sources: readonly SourceArtifact[],
  artifactId: string,
): Promise<AudioOverviewResult> {
  return compileAudioOverview({
    plan,
    graph,
    sources,
    options: {
      seed: AUDIO_SEED,
      now: FIXED_NOW,
      providerChoice: 'offline',
      mastering: 'pure-ts',
      artifactId,
    },
  });
}

async function main(): Promise<void> {
  const outPath = process.argv[2];
  if (outPath === undefined || outPath.length === 0) {
    throw new Error('usage: run-exp-x-02-control.ts <absolute-output-json-path>');
  }

  // The v1 tree's own frozen fixtures (editorial content byte-identical to
  // the wave branch's; contractVersion stamps are the version boundary).
  const plan: OverviewPlan = JSON.parse(
    readFileSync('fixtures/contracts/plan-audio-deep-dive-5min.json', 'utf8'),
  ) as OverviewPlan;
  const graph: SemanticGraph = JSON.parse(
    readFileSync('fixtures/contracts/reference-messy-note.semantic-graph.json', 'utf8'),
  ) as SemanticGraph;
  const source: SourceArtifact = JSON.parse(
    readFileSync('fixtures/contracts/reference-messy-note.source-artifact.json', 'utf8'),
  ) as SourceArtifact;

  // --- identical recipe: baseline (defect) plan -----------------------------
  const baselinePlan: OverviewPlan = JSON.parse(JSON.stringify(plan));
  const target = baselinePlan.audioTurns[TARGET_TURN_INDEX];
  if (target === undefined || target.id !== TARGET_TURN_ID) {
    throw new Error(`control: expected ${TARGET_TURN_ID} at index ${TARGET_TURN_INDEX}`);
  }
  target.claimIds = [...DEFECT_CLAIM_IDS];

  // --- identical recipe: edited (refined) plan -------------------------------
  const editedPlan: OverviewPlan = JSON.parse(JSON.stringify(baselinePlan));
  const editedTarget = editedPlan.audioTurns[TARGET_TURN_INDEX];
  if (editedTarget === undefined) throw new Error('control: edited target missing');
  if (editedTarget.targetDurationSeconds !== EDIT_DURATION_FROM) {
    throw new Error(
      `control: expected target duration ${EDIT_DURATION_FROM}s, found ${editedTarget.targetDurationSeconds}s`,
    );
  }
  editedTarget.brief = editedTarget.brief + EDIT_BRIEF_SUFFIX;
  editedTarget.targetDurationSeconds = EDIT_DURATION_TO;

  // --- compiles: baseline x2 + edited x2 (determinism proof) ----------------
  const clock = async (
    planToCompile: OverviewPlan,
    artifactId: string,
    runId: string,
  ): Promise<RunSlim> => {
    const started = Date.now();
    const result = await compilePlan(planToCompile, graph, [source], artifactId);
    const wallClockMs = Date.now() - started;
    process.stdout.write(`  [a-control] ${runId}: qa=${result.qa.status} (${wallClockMs} ms)\n`);
    return slimFor(runId, artifactId, result, wallClockMs);
  };

  process.stdout.write('[a-control v1] compiling baseline x2 + edited x2 ...\n');
  const baselineA = await clock(baselinePlan, 'artifact-exp-x02-a-control-baseline-defect-deepdive-5min', 'a-control-baseline-defect-deepdive-5min');
  const baselineB = await clock(baselinePlan, 'artifact-exp-x02-a-control-baseline-defect-deepdive-5min', 'a-control-baseline-defect-deepdive-5min-recheck');
  const editedA = await clock(editedPlan, 'artifact-exp-x02-a-control-edited-deepdive-5min', 'a-control-edited-deepdive-5min');
  const editedB = await clock(editedPlan, 'artifact-exp-x02-a-control-edited-deepdive-5min', 'a-control-edited-deepdive-5min-recheck');

  const report: ControlReport = {
    arm: 'a-control-v1',
    codeVersion: '720f984 (v1 worktree; planHash keying)',
    contractVersion: baselinePlan.contractVersion,
    planId: baselinePlan.id,
    audioSeed: AUDIO_SEED,
    fixedNow: FIXED_NOW,
    targetTurnId: TARGET_TURN_ID,
    runs: { baseline: baselineA, edited: editedA },
    determinism: {
      baselineIdentical:
        baselineA.mediaSha256 === baselineB.mediaSha256 &&
        stableStringify(baselineA.perTurn) === stableStringify(baselineB.perTurn),
      editedIdentical:
        editedA.mediaSha256 === editedB.mediaSha256 &&
        stableStringify(editedA.perTurn) === stableStringify(editedB.perTurn),
    },
  };
  writeFileSync(outPath, `${stableStringify(report)}\n`, 'utf8');
  process.stdout.write(
    `[a-control v1] done -> ${outPath} (determinism baseline=${report.determinism.baselineIdentical} edited=${report.determinism.editedIdentical})\n`,
  );
}

await main();
