/**
 * EXP-X-02 runner — the local refinement loop experiment (v2 contract wave
 * verification; docs/experiments/design-exp-x-02.md, ruling 2026-09-29).
 *
 * Question under test (matrix.md): does smallest-unit regeneration preserve
 * quality? Concretely: when a compiled artifact fails a per-turn quality
 * gate, can we regenerate ONLY the failing turn's realized surface and
 * re-pass the gates, while every non-failing turn stays byte-identical?
 *
 * The five protocol steps (design note §3), all deterministic:
 *
 *   1. Baseline compile — the H-2 deep-dive 300 s en canonical fixture
 *      (fixtures/contracts/plan-audio-deep-dive-5min.json) at fixed
 *      (seed, now, provider set). HONEST PRECONDITION NOTE: post-EV-008 the
 *      canonical plans compile with ZERO over-budget turns (the P3A
 *      anchor-mass-aware Director fix), so the loop's precondition ("a
 *      compiled artifact fails a per-turn quality gate") is introduced via
 *      the established single-turn mutant recipe (the W2 over-packed-turn
 *      class, tests/integration/fixtures.ts buildOverBudgetTurnPlan): ONE
 *      turn (turn-3) is handed a three-claim anchor load its 10 s slot
 *      cannot voice. The pristine canonical compile is recorded alongside
 *      for context (0 over-budget, REPRODUCED).
 *   2. Measure — per-turn diagnostics (src/audio/qa/metrics.ts surface):
 *      realized.overBudget flags, gap timings, wps per turn. Target = the
 *      failing turn with the WORST gate margin (deterministic: max
 *      over-budget ratio wordCount/maxWords, tie-break by turnId).
 *   3. Local regenerate — the single-turn refinement edit (identical on
 *      both arms): the target turn's brief gains the design note's word-
 *      count cap sentence and its targetDurationSeconds 10 -> 18 s (the
 *      rate-model's own lever: anchors are verbatim claims, so the ceiling
 *      is duration-bound; both halves of the edit touch ONLY the target
 *      turn). Arms:
 *        B-treatment — wave-branch HEAD (C-5 turn-local content-keyed
 *        seeding): expect ONLY the target turn's realized surface to change
 *        (+ its two gap-adjacent boundaries, co-owned per the C-5 ruling).
 *        A-control — a git WORKTREE at 720f984 (v1 planHash keying), same
 *        recipe on the v1 tree's own fixture: expect the global reshuffle
 *        (EXP-A-04 class) — every turn's seeded key changes because the
 *        plan-global planHash changed.
 *   4. Re-measure — target passes its gate; no non-target diagnostic
 *      changed; total duration delta = the target's own delta ± 0 ms
 *      elsewhere; whole-artifact determinism double-run on every plan.
 *   5. Record — summary.json (this runner) + the registry record
 *      docs/experiments/records/EXP-X-02.yaml (authored with these numbers)
 *      + EV-014 in docs/evidence/registry.jsonl.
 *
 * TL sequencing decision (documented in the record + report): the design
 * note anticipated EXP-X-02 "post-landing" with the treatment on post-merge
 * main; this wave runs the TREATMENT arm on the wave-branch HEAD (identical
 * tree to the post-merge main — same commit content) and the CONTROL arm on
 * a worktree at 720f984. Running pre-merge catches falsifiers BEFORE the
 * merge — strictly safer, same evidence value.
 *
 * Outputs (provenance per artifacts/README.md — new artifact id per
 * generation, media fingerprinted but not committed, the golden-media
 * precedent):
 *   artifacts/audio/exp-x02/canonical-clean-deepdive-5min/
 *   artifacts/audio/exp-x02/b-baseline-defect-deepdive-5min/
 *   artifacts/audio/exp-x02/b-edited-deepdive-5min/     (treatment)
 *   artifacts/audio/exp-x02/a-control-report.json       (control arm slim)
 *   artifacts/audio/exp-x02/baseline-plan.json          (shared recipe input)
 *   artifacts/audio/exp-x02/edited-plan.json            (shared recipe input)
 *   artifacts/audio/exp-x02/summary.json                (structured data)
 *
 * Lab reproduction evidence only — NOT product-parity evidence (AGENTS.md).
 */

import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import {
  buildValidatedDialogueGraph,
  compileAudioOverview,
  modeProfileFor,
  realizeDialogue,
  realizeTurn,
  stableStringify,
  type AudioOverviewResult,
  type RealizedTurn,
} from '../src/audio';
import { PACING_MULTIPLIERS } from '../src/audio/modes/common';
import { languagePackFor } from '../src/audio/modes/language-packs';
import type {
  OverviewPlan,
  SemanticGraph,
  SourceArtifact,
  UtcTimestamp,
} from '../src/contracts';
import type { DialogueGraph } from '../src/audio/dialogue/types';
import type { RealizerContext } from '../src/audio/dialogue/text/realizer';
import type { RunSlim, TurnSlim } from './run-exp-x-02-control';

// ---------------------------------------------------------------------------
// Fixed experiment constants (determinism: same values every run; the
// control script re-declares the same recipe — see its header note)
// ---------------------------------------------------------------------------

const AUDIO_SEED = 'wflx-exp-x02-audio-seed';
const FIXED_NOW: UtcTimestamp = '2026-09-30T00:00:00Z';
const OUT_ROOT = 'artifacts/audio/exp-x02';

/** The v1 control worktree (planHash keying) — created at this pin. */
const V1_CONTROL_PIN = '720f984';
const V1_CONTROL_DIR = process.env.WFLX_X02_CONTROL_DIR ?? '/home/z/WebFlix-Lab-v1control';

/** Target turn (the defect carrier): index 2 = turn-3. */
const TARGET_TURN_INDEX = 2;
const TARGET_TURN_ID = 'turn-3';
/** Defect (W2/p3b over-packed-turn mutant class): 3 claims on a 10 s slot. */
const DEFECT_CLAIM_IDS = [
  'claim-purpose',
  'claim-oss-runtimes',
  'claim-forecasting-projects',
] as const;
/** Refinement edit (single-turn, identical on both arms). */
const EDIT_BRIEF_SUFFIX =
  ' Word-count cap (EXP-X-02 refinement): realization must fit the rate ceiling — anchors verbatim, glue minimal.';
const EDIT_DURATION_FROM = 10;
const EDIT_DURATION_TO = 18;

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const sha256 = (text: string): string =>
  createHash('sha256').update(text).digest('hex');

function slimFor(
  runId: string,
  artifactId: string,
  result: AudioOverviewResult,
  wallClockMs: number,
): RunSlim {
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

function persistRun(
  runId: string,
  result: AudioOverviewResult,
  slim: RunSlim,
): void {
  const dir = join(OUT_ROOT, runId);
  mkdirSync(dir, { recursive: true });
  const write = (name: string, value: unknown): void => {
    writeFileSync(join(dir, name), `${stableStringify(value)}\n`, 'utf8');
  };
  write('plan.json', result.plan);
  write('artifact.json', result.artifact);
  write('qa-report.json', result.qa);
  write('timing-manifest.json', result.timing);
  write('diagnostics.json', slim);
}

// ---------------------------------------------------------------------------
// Arm diffing (ONE implementation, applied to both arms' RunSlim data)
// ---------------------------------------------------------------------------

interface ArmDiff {
  arm: string;
  turnsTotal: number;
  textChangedTurns: string[];
  nonTargetTextsChanged: string[];
  audioChangedTurns: string[];
  nonTargetAudioChanged: string[];
  gapChanged: readonly { turnId: string; fromMs: number; toMs: number }[];
  nonAdjacentGapChanged: string[];
  nonTargetActualSecondsDeltaMs: number;
  targetActualSecondsDeltaMs: number;
  adjacentGapDeltaMs: number;
  totalDurationDeltaMs: number;
  wpsChangedTurns: string[];
  nonTargetWpsChanged: string[];
  overBudgetBefore: number;
  overBudgetAfter: number;
  qaStatusBefore: string;
  qaStatusAfter: string;
  targetOverBudgetAfter: boolean;
}

function diffArm(arm: string, baseline: RunSlim, edited: RunSlim): ArmDiff {
  const textChangedTurns: string[] = [];
  const audioChangedTurns: string[] = [];
  const wpsChangedTurns: string[] = [];
  let nonTargetActualSecondsDeltaMs = 0;
  let targetActualSecondsDeltaMs = 0;
  const gapChanged: { turnId: string; fromMs: number; toMs: number }[] = [];
  const n = Math.min(baseline.perTurn.length, edited.perTurn.length);
  for (let i = 0; i < n; i++) {
    const before = baseline.perTurn[i];
    const after = edited.perTurn[i];
    if (before === undefined || after === undefined) continue;
    const isTarget = before.turnId === TARGET_TURN_ID;
    if (before.textSha256 !== after.textSha256) textChangedTurns.push(before.turnId);
    if (before.synthesisAudioSha256 !== after.synthesisAudioSha256) audioChangedTurns.push(before.turnId);
    const wpsDelta = Math.abs(before.wps - after.wps);
    if (wpsDelta > 1e-9) wpsChangedTurns.push(before.turnId);
    const actualDeltaMs = Math.round((after.actualSeconds - before.actualSeconds) * 1000);
    if (isTarget) targetActualSecondsDeltaMs = actualDeltaMs;
    else nonTargetActualSecondsDeltaMs += actualDeltaMs;
    if (before.gapAfterMs !== after.gapAfterMs) {
      gapChanged.push({ turnId: before.turnId, fromMs: before.gapAfterMs, toMs: after.gapAfterMs });
    }
  }
  const nonAdjacentGapChanged = gapChanged
    // A gap AFTER turn i is target-adjacent iff turn i is the target (gap
    // target -> next) or turn i+1 is the target (gap prev -> target).
    .map((gap) => gap.turnId)
    .filter((turnId) => {
      const idx = baseline.perTurn.findIndex((turn) => turn.turnId === turnId);
      const isTarget = turnId === TARGET_TURN_ID;
      const nextIsTarget = baseline.perTurn[idx + 1]?.turnId === TARGET_TURN_ID;
      return !isTarget && !nextIsTarget;
    });
  const adjacentGapDeltaMs = gapChanged
    .filter((gap) => {
      const idx = baseline.perTurn.findIndex((turn) => turn.turnId === gap.turnId);
      return gap.turnId === TARGET_TURN_ID || baseline.perTurn[idx + 1]?.turnId === TARGET_TURN_ID;
    })
    .reduce((sum, gap) => sum + (gap.toMs - gap.fromMs), 0);
  const targetAfter = edited.perTurn.find((turn) => turn.turnId === TARGET_TURN_ID);
  return {
    arm,
    turnsTotal: n,
    textChangedTurns,
    nonTargetTextsChanged: textChangedTurns.filter((id) => id !== TARGET_TURN_ID),
    audioChangedTurns,
    nonTargetAudioChanged: audioChangedTurns.filter((id) => id !== TARGET_TURN_ID),
    gapChanged,
    nonAdjacentGapChanged,
    nonTargetActualSecondsDeltaMs,
    targetActualSecondsDeltaMs,
    adjacentGapDeltaMs,
    totalDurationDeltaMs: edited.totalDurationMs - baseline.totalDurationMs,
    wpsChangedTurns,
    nonTargetWpsChanged: wpsChangedTurns.filter((id) => id !== TARGET_TURN_ID),
    overBudgetBefore: baseline.overBudgetTurns.length,
    overBudgetAfter: edited.overBudgetTurns.length,
    qaStatusBefore: baseline.qaStatus,
    qaStatusAfter: edited.qaStatus,
    targetOverBudgetAfter: targetAfter?.overBudget ?? true,
  };
}

// ---------------------------------------------------------------------------
// A-control worktree management + spawn
// ---------------------------------------------------------------------------

function run(cwd: string, args: readonly string[]): { code: number; stdout: string; stderr: string } {
  const proc = Bun.spawnSync([...args], { cwd });
  return {
    code: proc.exitCode ?? 1,
    stdout: proc.stdout.toString(),
    stderr: proc.stderr.toString(),
  };
}

function ensureControlWorktree(): { dir: string; head: string; created: boolean } {
  const marker = join(V1_CONTROL_DIR, 'src/audio/index.ts');
  let created = false;
  if (!existsSync(marker)) {
    process.stdout.write(`[a-control] creating v1 worktree at ${V1_CONTROL_DIR} (pin ${V1_CONTROL_PIN}) ... `);
    const res = run(process.cwd(), ['git', 'worktree', 'add', V1_CONTROL_DIR, V1_CONTROL_PIN]);
    if (res.code !== 0) {
      throw new Error(`git worktree add failed: ${res.stderr}`);
    }
    created = true;
    process.stdout.write('ok\n');
  }
  if (!existsSync(join(V1_CONTROL_DIR, 'node_modules'))) {
    process.stdout.write('[a-control] bun install inside the worktree ... ');
    const res = run(V1_CONTROL_DIR, ['bun', 'install']);
    if (res.code !== 0) throw new Error(`bun install in worktree failed: ${res.stderr}`);
    process.stdout.write('ok\n');
  }
  // The control script is committed on the branch; copy it into the worktree
  // (the 720f984 tree predates it). Same bytes both sides.
  mkdirSync(join(V1_CONTROL_DIR, 'experiments'), { recursive: true });
  copyFileSync('experiments/run-exp-x-02-control.ts', join(V1_CONTROL_DIR, 'experiments/run-exp-x-02-control.ts'));
  const head = run(V1_CONTROL_DIR, ['git', 'rev-parse', 'HEAD']).stdout.trim();
  return { dir: V1_CONTROL_DIR, head, created };
}

async function runControlArm(outPath: string): Promise<RunSlim[]> {
  const worktree = ensureControlWorktree();
  process.stdout.write(`[a-control] worktree HEAD ${worktree.head.slice(0, 7)} — compiling (v1 planHash keying) ...\n`);
  const proc = Bun.spawn(['bun', 'run', 'experiments/run-exp-x-02-control.ts', outPath], {
    cwd: worktree.dir,
  });
  const code = await proc.exited;
  const stdout = await new Response(proc.stdout).text();
  process.stdout.write(stdout);
  if (code !== 0) {
    const stderr = await new Response(proc.stderr).text();
    throw new Error(`a-control arm failed (exit ${code}): ${stderr}`);
  }
  const report = JSON.parse(readFileSync(outPath, 'utf8')) as {
    runs: { baseline: RunSlim; edited: RunSlim };
    determinism: { baselineIdentical: boolean; editedIdentical: boolean };
    contractVersion: string;
    codeVersion: string;
  };
  controlMeta = {
    worktreeHead: worktree.head,
    contractVersion: report.contractVersion,
    codeVersion: report.codeVersion,
    determinism: report.determinism,
  };
  return [report.runs.baseline, report.runs.edited];
}

// set by runControlArm (module-level report metadata)
interface ControlMeta {
  worktreeHead: string;
  contractVersion: string;
  codeVersion: string;
  determinism: { baselineIdentical: boolean; editedIdentical: boolean };
}
let controlMeta: ControlMeta | undefined;

// ---------------------------------------------------------------------------
// Realizer-layer micro-benchmark (local regen vs full-graph realization)
// ---------------------------------------------------------------------------

function realizerBenchmark(editedPlan: OverviewPlan, graph: SemanticGraph): {
  fullGraphRealizationMsPerCall: number;
  singleTurnRealizationMsPerCall: number;
  iterations: number;
} {
  const dialogueGraph: DialogueGraph = buildValidatedDialogueGraph({
    plan: editedPlan,
    graph,
    seed: AUDIO_SEED,
  });
  const profile = modeProfileFor(editedPlan.mode as Parameters<typeof modeProfileFor>[0]);
  const language = languagePackFor(editedPlan.language);
  const pacingMultiplier = PACING_MULTIPLIERS[editedPlan.style.pacing ?? 'measured'] ?? 1.0;
  const ctx: RealizerContext = {
    plan: editedPlan,
    graph: dialogueGraph,
    claimIndex: new Map(graph.claims.map((claim) => [claim.id, claim])),
    beatIndex: new Map(editedPlan.beats.map((beat) => [beat.id, beat])),
    profile,
    rate: profile.rate.wordsPerSecond * pacingMultiplier,
    languageId: language.id,
    languageFallback: language.fallback,
  };
  const targetIdx = dialogueGraph.turns.findIndex((turn) => turn.id === TARGET_TURN_ID);
  const targetTurn = dialogueGraph.turns[targetIdx];
  const previous = dialogueGraph.turns[targetIdx - 1];
  if (targetTurn === undefined) throw new Error('benchmark: target turn missing from graph');
  const iterations = 200;
  const tFullStart = Date.now();
  let acc: readonly RealizedTurn[] = [];
  for (let i = 0; i < iterations; i++) acc = realizeDialogue(ctx);
  const tFull = Date.now() - tFullStart;
  const tOneStart = Date.now();
  let one: RealizedTurn | undefined;
  for (let i = 0; i < iterations; i++) one = realizeTurn(ctx, targetTurn, previous);
  const tOne = Date.now() - tOneStart;
  if (acc.length === 0 || one === undefined) throw new Error('benchmark: realization produced nothing');
  return {
    fullGraphRealizationMsPerCall: Math.round((tFull / iterations) * 1000) / 1000,
    singleTurnRealizationMsPerCall: Math.round((tOne / iterations) * 1000) / 1000,
    iterations,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

interface FalsifierCheck {
  id: string;
  description: string;
  passed: boolean;
  detail: string;
}

async function main(): Promise<void> {
  mkdirSync(OUT_ROOT, { recursive: true });
  const started = Date.now();

  const canonicalPlan: OverviewPlan = JSON.parse(
    readFileSync('fixtures/contracts/plan-audio-deep-dive-5min.json', 'utf8'),
  ) as OverviewPlan;
  const graph: SemanticGraph = JSON.parse(
    readFileSync('fixtures/contracts/reference-messy-note.semantic-graph.json', 'utf8'),
  ) as SemanticGraph;
  const source: SourceArtifact = JSON.parse(
    readFileSync('fixtures/contracts/reference-messy-note.source-artifact.json', 'utf8'),
  ) as SourceArtifact;

  // --- step 1 context: pristine canonical compile (expected 0 over-budget) --
  process.stdout.write('[b] compiling pristine canonical (context) ... ');
  const canonicalStarted = Date.now();
  const canonicalResult = await compilePlan(canonicalPlan, graph, [source], 'artifact-exp-x02-canonical-deepdive-5min');
  const canonicalWallClockMs = Date.now() - canonicalStarted;
  const canonicalSlim = slimFor('canonical-clean-deepdive-5min', 'artifact-exp-x02-canonical-deepdive-5min', canonicalResult, canonicalWallClockMs);
  persistRun(canonicalSlim.runId, canonicalResult, canonicalSlim);
  process.stdout.write(`qa=${canonicalResult.qa.status} over-budget=${canonicalSlim.overBudgetTurns.length} (${canonicalWallClockMs} ms)\n`);

  // --- step 1: baseline (canonical + single-turn defect) --------------------
  const baselinePlan: OverviewPlan = JSON.parse(JSON.stringify(canonicalPlan));
  const target = baselinePlan.audioTurns[TARGET_TURN_INDEX];
  if (target === undefined || target.id !== TARGET_TURN_ID) {
    throw new Error(`expected ${TARGET_TURN_ID} at index ${TARGET_TURN_INDEX}`);
  }
  target.claimIds = [...DEFECT_CLAIM_IDS];
  if (target.targetDurationSeconds !== EDIT_DURATION_FROM) {
    throw new Error(`expected target duration ${EDIT_DURATION_FROM}s, found ${target.targetDurationSeconds}s`);
  }
  writeFileSync(join(OUT_ROOT, 'baseline-plan.json'), `${stableStringify(baselinePlan)}\n`, 'utf8');

  process.stdout.write('[b] compiling treatment baseline x2 (determinism proof) ... ');
  const bBaselineStart = Date.now();
  const bBaseline1 = await compilePlan(baselinePlan, graph, [source], 'artifact-exp-x02-b-baseline-defect-deepdive-5min');
  const bBaselineWallClockMs = Date.now() - bBaselineStart;
  const bBaseline1Slim = slimFor('b-baseline-defect-deepdive-5min', 'artifact-exp-x02-b-baseline-defect-deepdive-5min', bBaseline1, bBaselineWallClockMs);
  const bBaseline2 = await compilePlan(baselinePlan, graph, [source], 'artifact-exp-x02-b-baseline-defect-deepdive-5min');
  const bBaselineDeterminism =
    bBaseline1.artifact.media.sha256 === bBaseline2.artifact.media.sha256 &&
    stableStringify(bBaseline1Slim.perTurn) === stableStringify(slimFor('recheck', 'recheck', bBaseline2, 0).perTurn);
  persistRun(bBaseline1Slim.runId, bBaseline1, bBaseline1Slim);
  process.stdout.write(`qa=${bBaseline1.qa.status} over-budget=${bBaseline1Slim.overBudgetTurns.length} determinism=${bBaselineDeterminism ? 'IDENTICAL' : 'DIVERGED'}\n`);

  // --- step 2: measure + select the target (worst gate margin) --------------
  const failing = bBaseline1Slim.overBudgetTurns;
  if (failing.length === 0) {
    throw new Error('EXP-X-02 precondition broken: baseline carries no over-budget turn');
  }
  const selected = [...failing].sort((a, b) => (b.ratio - a.ratio) || (a.turnId < b.turnId ? -1 : 1))[0];
  if (selected === undefined) {
    throw new Error('EXP-X-02 target selection failed: no failing turn');
  }
  if (selected.turnId !== TARGET_TURN_ID) {
    throw new Error(
      `deterministic target selection picked ${selected.turnId} (ratio ${selected.ratio.toFixed(3)}), expected ${TARGET_TURN_ID} — recipe drift`,
    );
  }
  process.stdout.write(
    `[measure] failing turns: ${failing.map((f) => `${f.turnId}(${f.wordCount}/${f.maxWords}=${f.ratio.toFixed(2)})`).join(', ')} -> target ${selected.turnId}\n`,
  );

  // --- step 3: the single-turn refinement edit (identical on both arms) ------
  const editedPlan: OverviewPlan = JSON.parse(JSON.stringify(baselinePlan));
  const editedTarget = editedPlan.audioTurns[TARGET_TURN_INDEX];
  if (editedTarget === undefined) throw new Error('edited target missing');
  editedTarget.brief = editedTarget.brief + EDIT_BRIEF_SUFFIX;
  editedTarget.targetDurationSeconds = EDIT_DURATION_TO;
  writeFileSync(join(OUT_ROOT, 'edited-plan.json'), `${stableStringify(editedPlan)}\n`, 'utf8');

  process.stdout.write('[b] compiling treatment edited x2 (determinism proof) ... ');
  const bEditedStart = Date.now();
  const bEdited1 = await compilePlan(editedPlan, graph, [source], 'artifact-exp-x02-b-edited-deepdive-5min');
  const bEditedWallClockMs = Date.now() - bEditedStart;
  const bEdited1Slim = slimFor('b-edited-deepdive-5min', 'artifact-exp-x02-b-edited-deepdive-5min', bEdited1, bEditedWallClockMs);
  const bEdited2 = await compilePlan(editedPlan, graph, [source], 'artifact-exp-x02-b-edited-deepdive-5min');
  const bEditedDeterminism =
    bEdited1.artifact.media.sha256 === bEdited2.artifact.media.sha256 &&
    stableStringify(bEdited1Slim.perTurn) === stableStringify(slimFor('recheck', 'recheck', bEdited2, 0).perTurn);
  persistRun(bEdited1Slim.runId, bEdited1, bEdited1Slim);
  process.stdout.write(`qa=${bEdited1.qa.status} over-budget=${bEdited1Slim.overBudgetTurns.length} determinism=${bEditedDeterminism ? 'IDENTICAL' : 'DIVERGED'}\n`);

  // --- step 3 (control arm): v1 worktree, same recipe ------------------------
  const controlReportPath = join(process.cwd(), OUT_ROOT, 'a-control-report.json');
  const controlRuns = await runControlArm(controlReportPath);
  const aBaseline = controlRuns[0];
  const aEdited = controlRuns[1];
  if (aBaseline === undefined || aEdited === undefined) {
    throw new Error('a-control arm returned incomplete runs');
  }

  // --- step 4: re-measure + diffs ---------------------------------------------
  const bDiff = diffArm('b-treatment (C-5 keying, wave HEAD)', bBaseline1Slim, bEdited1Slim);
  const aDiff = diffArm('a-control (v1 planHash keying, worktree 720f984)', aBaseline, aEdited);

  // --- falsifier checks --------------------------------------------------------
  const checks: FalsifierCheck[] = [
    {
      id: 'F1 (locality: B changes any non-target realized text?)',
      description: 'B-treatment non-target turns byte-identical (text sha256)',
      passed: bDiff.nonTargetTextsChanged.length === 0,
      detail:
        bDiff.nonTargetTextsChanged.length === 0
          ? `0 non-target texts changed; changed set = {${bDiff.textChangedTurns.join(',')}}`
          : `LOCALITY BROKEN: non-target texts changed: ${bDiff.nonTargetTextsChanged.join(',')}`,
    },
    {
      id: 'F2 (B degrades a global diagnostic beyond the target delta?)',
      description: 'non-target actualSeconds sum delta 0 ms; non-adjacent gaps unchanged; non-target wps unchanged; non-target audio hashes identical',
      passed:
        bDiff.nonTargetActualSecondsDeltaMs === 0 &&
        bDiff.nonAdjacentGapChanged.length === 0 &&
        bDiff.nonTargetWpsChanged.length === 0 &&
        bDiff.nonTargetAudioChanged.length === 0,
      detail:
        `non-target actualSeconds delta ${bDiff.nonTargetActualSecondsDeltaMs} ms; non-adjacent gaps changed ${bDiff.nonAdjacentGapChanged.length}; ` +
        `non-target wps changed ${bDiff.nonTargetWpsChanged.length}; non-target audio hashes changed ${bDiff.nonTargetAudioChanged.length}; ` +
        `total duration delta ${bDiff.totalDurationDeltaMs} ms = target turn ${bDiff.targetActualSecondsDeltaMs} ms + target-adjacent gaps ${bDiff.adjacentGapDeltaMs} ms`,
    },
    {
      id: 'F3 (whole-artifact determinism breaks?)',
      description: 'same plan + same seed, two compiles byte-identical (both arms, both plans)',
      passed:
        bBaselineDeterminism &&
        bEditedDeterminism &&
        (controlMeta?.determinism.baselineIdentical ?? false) &&
        (controlMeta?.determinism.editedIdentical ?? false),
      detail: `b-baseline=${bBaselineDeterminism} b-edited=${bEditedDeterminism} a-baseline=${controlMeta?.determinism.baselineIdentical} a-edited=${controlMeta?.determinism.editedIdentical}`,
    },
    {
      id: 'F4 (A-control does NOT reshuffle non-target turns?)',
      description: 'v1 planHash keying reshuffles non-target realized texts (EXP-A-04 class)',
      passed: aDiff.nonTargetTextsChanged.length > 0,
      detail: `A-control changed ${aDiff.textChangedTurns.length}/${aDiff.turnsTotal} realized texts (${aDiff.nonTargetTextsChanged.length} non-target) and ${aDiff.gapChanged.length}/${aDiff.turnsTotal} gaps; stable turns: ${aDiff.textChangedTurns.length === 0 ? 'all' : baselinePlan.audioTurns.map((t) => t.id).filter((id) => !aDiff.textChangedTurns.includes(id)).join(',')}`,
    },
  ];

  // --- station quality bar (design note §7) -------------------------------------
  const stationBar = {
    bEditedQaStatus: bEdited1.qa.status,
    bEditedOverBudget: bEdited1Slim.overBudgetTurns.length,
    bEditedTargetPassesGate: !bDiff.targetOverBudgetAfter,
    bNonTargetByteIdentical:
      bDiff.nonTargetTextsChanged.length === 0 && bDiff.nonTargetAudioChanged.length === 0,
    bTargetTextChanged: bDiff.textChangedTurns.includes(TARGET_TURN_ID),
    targetOverBudgetRatioBefore: selected.ratio,
    passed:
      bEdited1Slim.overBudgetTurns.length === 0 &&
      !bDiff.targetOverBudgetAfter &&
      bDiff.nonTargetTextsChanged.length === 0 &&
      bDiff.nonTargetAudioChanged.length === 0 &&
      bEdited1.qa.status !== 'failed',
  };

  // --- realizer-layer micro-benchmark -------------------------------------------
  const benchmark = realizerBenchmark(editedPlan, graph);

  // --- summary --------------------------------------------------------------------
  const summary = {
    experiment: 'EXP-X-02',
    generatedAtUtc: new Date().toISOString(),
    runner: 'experiments/run-exp-x-02.ts',
    designNote: 'docs/experiments/design-exp-x-02.md',
    audioSeed: AUDIO_SEED,
    fixedNow: FIXED_NOW,
    provider: 'offline deterministic (providerChoice: offline)',
    mastering: 'pure-ts',
    canonicalPlan: {
      fixture: 'fixtures/contracts/plan-audio-deep-dive-5min.json',
      planId: canonicalPlan.id,
      mode: canonicalPlan.mode,
      language: canonicalPlan.language,
      targetDurationSeconds: canonicalPlan.targetDurationSeconds,
      turnCount: canonicalPlan.audioTurns.length,
      qaStatus: canonicalSlim.qaStatus,
      overBudgetTurns: canonicalSlim.overBudgetTurns.length,
      wallClockMs: canonicalSlim.wallClockMs,
    },
    defect: {
      class: 'single-turn over-packed-turn mutant (W2/p3b recipe; the loop precondition — canonical plans compile 0-over-budget post-EV-008)',
      targetTurnId: TARGET_TURN_ID,
      claimIds: [...DEFECT_CLAIM_IDS],
      targetDurationSeconds: EDIT_DURATION_FROM,
    },
    refinementEdit: {
      class: 'single-turn plan edit (identical on both arms)',
      targetTurnId: TARGET_TURN_ID,
      briefSuffix: EDIT_BRIEF_SUFFIX,
      targetDurationSeconds: { from: EDIT_DURATION_FROM, to: EDIT_DURATION_TO },
      note: 'the design note\'s e.g. word-count-cap brief edit mapped onto the rate model\'s own lever: anchors are verbatim claims, so the ceiling is duration-bound; both halves touch ONLY the target turn',
    },
    targetSelection: {
      rule: 'max over-budget ratio (wordCount/maxWords), tie-break by turnId',
      failingTurns: failing,
      selected: selected.turnId,
    },
    treatmentArm: {
      code: 'wave-branch HEAD (C-5 turn-local content-keyed seeding; CONTRACTS_VERSION 2.0.0)',
      contractVersion: baselinePlan.contractVersion,
      baseline: bBaseline1Slim,
      edited: bEdited1Slim,
      determinism: { baselineIdentical: bBaselineDeterminism, editedIdentical: bEditedDeterminism },
      diff: bDiff,
    },
    controlArm: {
      code: controlMeta?.codeVersion ?? 'v1 worktree',
      worktreeHead: controlMeta?.worktreeHead,
      contractVersion: controlMeta?.contractVersion,
      baseline: aBaseline,
      edited: aEdited,
      determinism: controlMeta?.determinism,
      diff: aDiff,
    },
    falsifierChecks: checks,
    stationQualityBar: stationBar,
    wallClock: {
      canonicalCompileMs: canonicalWallClockMs,
      treatmentBaselineCompileMs: bBaseline1Slim.wallClockMs,
      treatmentEditedCompileMs: bEditedWallClockMs,
      controlBaselineCompileMs: aBaseline.wallClockMs,
      controlEditedCompileMs: aEdited.wallClockMs,
      note: 'the current pipeline has no incremental compile path: a local regeneration re-executes the full pipeline, so its wall-clock equals a full recompile at 22 turns (the design note\'s expected "modest compile saving"); the measured QUALITY saving is the diff: 1 vs 17 changed units to re-review at the station',
      realizerLayerBenchmark: benchmark,
    },
    metrics: {
      turnsChanged: { treatment: bDiff.textChangedTurns.length, control: aDiff.textChangedTurns.length, total: bDiff.turnsTotal },
      audioSegmentsChanged: { treatment: bDiff.audioChangedTurns.length, control: aDiff.audioChangedTurns.length },
      gapsChanged: { treatment: bDiff.gapChanged.length, control: aDiff.gapChanged.length, targetAdjacentOnly: bDiff.nonAdjacentGapChanged.length === 0 },
      overBudget: {
        before: { treatment: bDiff.overBudgetBefore, control: aDiff.overBudgetBefore },
        after: { treatment: bDiff.overBudgetAfter, control: aDiff.overBudgetAfter },
      },
      qaStatus: {
        treatment: { before: bDiff.qaStatusBefore, after: bDiff.qaStatusAfter },
        control: { before: aDiff.qaStatusBefore, after: aDiff.qaStatusAfter },
      },
      totalDurationDeltaMs: { treatment: bDiff.totalDurationDeltaMs, control: aDiff.totalDurationDeltaMs },
    },
  };
  writeFileSync(join(OUT_ROOT, 'summary.json'), `${stableStringify(summary)}\n`, 'utf8');

  // --- console report ------------------------------------------------------------
  process.stdout.write('\n=== EXP-X-02 arms ===\n');
  for (const diff of [bDiff, aDiff]) {
    process.stdout.write(
      `${diff.arm.padEnd(48)} texts ${diff.textChangedTurns.length}/${diff.turnsTotal} changed ` +
        `audio ${diff.audioChangedTurns.length}/${diff.turnsTotal} gaps ${diff.gapChanged.length}/${diff.turnsTotal} ` +
        `over-budget ${diff.overBudgetBefore}->${diff.overBudgetAfter} qa ${diff.qaStatusBefore}->${diff.qaStatusAfter}\n`,
    );
    if (diff.gapChanged.length > 0 && diff.gapChanged.length <= 4) {
      process.stdout.write(`  gaps: ${diff.gapChanged.map((g) => `${g.turnId} ${g.fromMs}->${g.toMs}ms`).join(' ')}\n`);
    }
  }
  process.stdout.write(
    `\ntotal duration delta (treatment): ${bDiff.totalDurationDeltaMs} ms = target turn ${bDiff.targetActualSecondsDeltaMs} ms + adjacent gaps ${bDiff.adjacentGapDeltaMs} ms + 0 elsewhere\n`,
  );
  process.stdout.write('\n=== falsifier checks (design note §4) ===\n');
  for (const check of checks) {
    process.stdout.write(`  ${check.passed ? 'PASS' : 'HIT '} ${check.id}\n      ${check.detail}\n`);
  }
  process.stdout.write(
    `\n=== station quality bar (design note §7): ${stationBar.passed ? 'PASSED' : 'FAILED'} ===\n` +
      `  B-treatment edited: qa=${stationBar.bEditedQaStatus}, over-budget=${stationBar.bEditedOverBudget}, target passes gate=${stationBar.bEditedTargetPassesGate}, non-target byte-identical=${stationBar.bNonTargetByteIdentical}\n`,
  );
  process.stdout.write(
    `\nrealizer layer: full graph ${benchmark.fullGraphRealizationMsPerCall} ms/call vs single turn ${benchmark.singleTurnRealizationMsPerCall} ms/call (${benchmark.iterations} iterations)\n`,
  );
  process.stdout.write(`\ndone in ${((Date.now() - started) / 1000).toFixed(1)}s -> ${OUT_ROOT}/summary.json\n`);

  // A falsifier hit is a RECORDED RESULT (architecture finding), never a
  // cover-up: the summary is persisted above; the non-zero exit surfaces the
  // hit to the station (run-exp-a's determinism-guard precedent).
  const failed = checks.filter((check) => !check.passed);
  if (failed.length > 0 || !stationBar.passed) {
    const hits = [...failed.map((check) => check.id), ...(stationBar.passed ? [] : ['station-quality-bar'])];
    throw new Error(`EXP-X-02 falsifier/station-bar hit(s): ${hits.join('; ')} — recorded in ${OUT_ROOT}/summary.json`);
  }
}

await main();
