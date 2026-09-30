/**
 * EXP-A series runner — Phase 3 TL integration experiments (2026-09-27).
 *
 * Executes the audio-surface experiment matrix (docs/experiments/matrix.md,
 * EXP-A-01..06) against the merged W2 audio pipeline and the H-2 canonical
 * per-mode plan fixtures, on the frozen reference-messy-note source. All runs
 * are deterministic (fixed seeds / fixed `now`); the determinism spot-check
 * re-compiles the baseline and asserts byte-identical media.
 *
 * Experiment arms:
 *   exp-a-01  mode: deep-dive (Director baseline) vs brief (canonical plan)
 *             + a 300 s de-confounder arm (Director brief at 300 s) because
 *             the brief mode canonically carries 120 s — mode is a
 *             structure+duration bundle; the de-confounder separates the two.
 *   exp-a-02  mode: deep-dive vs critique (canonical plan)
 *   exp-a-03  mode: deep-dive vs debate (canonical plan)
 *   exp-a-04  source mutation: ONE paragraph (block b30, feeds exactly the
 *             single-claim claim-credentials-redacted) changed; both arms run
 *             the SAME fresh chain MarkdownNoteAdapter -> DeterministicExtractor
 *             -> Director -> audio so the only variable is the paragraph text.
 *             NOTE: the extractor is not required to reproduce the hand-grounded
 *             gold graph (tests/source/graph/deterministic-extractor.test.ts),
 *             so the canonical fixtures are NOT the control here.
 *   exp-a-05  duration: deep-dive 300 s -> 180 s (one variable)
 *   exp-a-06  language: deep-dive en -> es (one variable)
 *
 * Outputs (provenance per artifacts/README.md — new id per generation, media
 * fingerprinted but not committed, the golden-media precedent):
 *   artifacts/audio/exp-a/<runId>/plan.json
 *   artifacts/audio/exp-a/<runId>/artifact.json        (GeneratedArtifact sidecar)
 *   artifacts/audio/exp-a/<runId>/qa-report.json
 *   artifacts/audio/exp-a/<runId>/timing-manifest.json
 *   artifacts/audio/exp-a/summary.json                  (structured experiment data)
 *
 * TL-owned Phase 3 work order item: "run ablation experiments" + "add
 * experiment result registry" (docs/work-items/tl2-work-order.md). This
 * runner consumes worker-owned trees read-only; it modifies none of them.
 */

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  compileAudioOverview,
  stableStringify,
  type AudioOverviewResult,
} from '../src/audio';
import { compileOverviewPlan, type DirectorRequest } from '../src/director/compiler';
import { MarkdownNoteAdapter } from '../src/source/markdown-note-adapter';
import { DeterministicExtractor } from '../src/source/graph/deterministic-extractor';
import type {
  AudioTurn,
  OverviewPlan,
  SemanticGraph,
  SourceArtifact,
  UtcTimestamp,
} from '../src/contracts';

// ---------------------------------------------------------------------------
// Fixed experiment constants (determinism: same values every run)
// ---------------------------------------------------------------------------

const AUDIO_SEED = 'wflx-exp-a-audio-seed';
const FIXED_NOW: UtcTimestamp = '2026-09-27T00:00:00Z';
const DIRECTOR_NOW: UtcTimestamp = '2026-09-27T00:00:00Z';
const OUT_ROOT = 'artifacts/audio/exp-a';

const CANONICAL_SOURCE: SourceArtifact = JSON.parse(
  readFileSync('fixtures/contracts/reference-messy-note.source-artifact.json', 'utf8'),
) as SourceArtifact;
const CANONICAL_GRAPH: SemanticGraph = JSON.parse(
  readFileSync('fixtures/contracts/reference-messy-note.semantic-graph.json', 'utf8'),
) as SemanticGraph;
const CANONICAL_BRIEF_PLAN: OverviewPlan = JSON.parse(
  readFileSync('fixtures/contracts/plan-audio-brief-2min.json', 'utf8'),
) as OverviewPlan;
const CANONICAL_CRITIQUE_PLAN: OverviewPlan = JSON.parse(
  readFileSync('fixtures/contracts/plan-audio-critique-5min.json', 'utf8'),
) as OverviewPlan;
const CANONICAL_DEBATE_PLAN: OverviewPlan = JSON.parse(
  readFileSync('fixtures/contracts/plan-audio-debate-5min.json', 'utf8'),
) as OverviewPlan;
const RAW_NOTE = readFileSync('fixtures/reference-messy-note-redacted.md', 'utf8');

/** EXP-A-04 mutation: block b30, the paragraph feeding exactly one claim. */
const B30_ORIGINAL = 'All credentials are `[REDACTED]`.';
const B30_MUTATED =
  'All credentials are `[REDACTED]` and are rotated quarterly by the platform team.';

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

interface RunMetrics {
  runId: string;
  experiment: string;
  planId: string;
  mode: string;
  language: string;
  targetDurationSeconds: number;
  planFingerprint: string;
  artifactId: string;
  artifactMediaSha256: string;
  graphClaimCount: number;
  beatCount: number;
  turnCount: number;
  speakers: string[];
  purposeHistogram: Record<string, number>;
  coveredClaimIds: string[];
  omittedClaimCount: number;
  coverageFraction: number;
  totalTargetSeconds: number;
  totalTurnSeconds: number;
  gapsTotalMs: number;
  wordsTotal: number;
  wordsPerSecondMean: number;
  overBudgetTurns: number;
  qaStatus: string;
  qaIssuesByCode: Record<string, number>;
}

/** Light per-run retention: everything the diff phase needs, nothing heavy.
 * Full results (WAV + synthesis buffers) are dropped after persistence so a
 * 10-run series stays well inside the station's memory headroom. */
interface SlimResult {
  readonly plan: OverviewPlan;
  readonly realized: readonly { turnId: string; text: string; wordCount: number; overBudget: boolean }[];
}

interface RunDiff {
  variant: string;
  baselineRunId: string;
  turnCountDelta: number;
  beatCountDelta: number;
  coverageAdded: string[];
  coverageRemoved: string[];
  totalTurnSecondsDelta: number;
  wordsPerSecondMeanDelta: number;
  structureChangedTurns: number;
  structureUnchangedTurns: number;
  textIdenticalTurns: number;
  textChangedTurns: number;
  notes: string[];
}

interface GraphDiff {
  claimsChanged: string[];
  claimsAdded: string[];
  claimsRemoved: string[];
  entitiesAdded: string[];
  entitiesRemoved: string[];
  topicsAdded: string[];
  topicsRemoved: string[];
}

function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

function inc(map: Record<string, number>, key: string): void {
  map[key] = (map[key] ?? 0) + 1;
}

function audioMediaSha256(result: AudioOverviewResult): string {
  return result.artifact.media.sha256;
}

function metricsFor(
  runId: string,
  experiment: string,
  result: AudioOverviewResult,
  graph: SemanticGraph,
): RunMetrics {
  const { plan, qa, timing, realized } = result;
  const purposeHistogram: Record<string, number> = {};
  const speakers = new Set<string>();
  for (const turn of plan.audioTurns) {
    inc(purposeHistogram, turn.purpose);
    speakers.add(turn.speaker);
  }
  const qaIssuesByCode: Record<string, number> = {};
  for (const issue of qa.issues) inc(qaIssuesByCode, issue.code);
  const wordsTotal = realized.reduce((sum, turn) => sum + turn.wordCount, 0);
  const covered = plan.coverage.covered.map((entry) => entry.claimId);
  return {
    runId,
    experiment,
    planId: plan.id,
    mode: plan.mode,
    language: plan.language,
    targetDurationSeconds: plan.targetDurationSeconds,
    planFingerprint: sha256(stableStringify(plan)),
    artifactId: result.artifact.id,
    artifactMediaSha256: audioMediaSha256(result),
    graphClaimCount: graph.claims.length,
    beatCount: plan.beats.length,
    turnCount: plan.audioTurns.length,
    speakers: [...speakers].sort(),
    purposeHistogram,
    coveredClaimIds: [...covered].sort(),
    omittedClaimCount: plan.coverage.omitted.length,
    coverageFraction: covered.length / graph.claims.length,
    totalTargetSeconds: timing.totalTargetSeconds,
    totalTurnSeconds: timing.totalTurnSeconds,
    gapsTotalMs: timing.gapsTotalMs,
    wordsTotal,
    wordsPerSecondMean:
      timing.totalTurnSeconds > 0 ? wordsTotal / timing.totalTurnSeconds : 0,
    overBudgetTurns: realized.filter((turn) => turn.overBudget).length,
    qaStatus: qa.status,
    qaIssuesByCode,
  };
}

/** Turn-level structural signature: everything except realized surface text. */
function turnStructureSignature(turn: AudioTurn): string {
  return JSON.stringify([
    turn.speaker,
    turn.speakerRole,
    turn.purpose,
    [...turn.claimIds].sort(),
    turn.beatId ?? null,
    turn.targetDurationSeconds,
  ]);
}

function diffRuns(
  baseline: RunMetrics,
  variant: RunMetrics,
  baselineResult: SlimResult,
  variantResult: SlimResult,
  notes: string[],
): RunDiff {
  const n = Math.min(baselineResult.plan.audioTurns.length, variantResult.plan.audioTurns.length);
  let structureChanged = 0;
  let textIdentical = 0;
  for (let i = 0; i < n; i++) {
    const a = baselineResult.plan.audioTurns[i];
    const b = variantResult.plan.audioTurns[i];
    if (a === undefined || b === undefined) continue;
    if (turnStructureSignature(a) !== turnStructureSignature(b)) structureChanged += 1;
    const ra = baselineResult.realized[i];
    const rb = variantResult.realized[i];
    if (ra !== undefined && rb !== undefined && ra.text === rb.text) textIdentical += 1;
  }
  const baselineCovered = new Set(baseline.coveredClaimIds);
  const variantCovered = new Set(variant.coveredClaimIds);
  return {
    variant: variant.runId,
    baselineRunId: baseline.runId,
    turnCountDelta: variant.turnCount - baseline.turnCount,
    beatCountDelta: variant.beatCount - baseline.beatCount,
    coverageAdded: variant.coveredClaimIds.filter((id) => !baselineCovered.has(id)),
    coverageRemoved: baseline.coveredClaimIds.filter((id) => !variantCovered.has(id)),
    totalTurnSecondsDelta:
      Math.round((variant.totalTurnSeconds - baseline.totalTurnSeconds) * 100) / 100,
    wordsPerSecondMeanDelta:
      Math.round((variant.wordsPerSecondMean - baseline.wordsPerSecondMean) * 1000) / 1000,
    structureChangedTurns: structureChanged,
    structureUnchangedTurns: n - structureChanged,
    textIdenticalTurns: textIdentical,
    textChangedTurns: n - textIdentical,
    notes,
  };
}

function diffGraphs(baseline: SemanticGraph, variant: SemanticGraph): GraphDiff {
  const baseClaims = new Map(baseline.claims.map((c) => [c.id, c.statement]));
  const varClaims = new Map(variant.claims.map((c) => [c.id, c.statement]));
  const claimsChanged: string[] = [];
  for (const [id, statement] of baseClaims) {
    const other = varClaims.get(id);
    if (other !== undefined && other !== statement) claimsChanged.push(id);
  }
  const baseEntities = new Set(baseline.entities.map((e) => e.name));
  const varEntities = new Set(variant.entities.map((e) => e.name));
  const baseTopics = new Set(baseline.topics.map((t) => t.title));
  const varTopics = new Set(variant.topics.map((t) => t.title));
  return {
    claimsChanged,
    claimsAdded: [...varClaims.keys()].filter((id) => !baseClaims.has(id)),
    claimsRemoved: [...baseClaims.keys()].filter((id) => !varClaims.has(id)),
    entitiesAdded: [...varEntities].filter((name) => !baseEntities.has(name)),
    entitiesRemoved: [...baseEntities].filter((name) => !varEntities.has(name)),
    topicsAdded: [...varTopics].filter((title) => !baseTopics.has(title)),
    topicsRemoved: [...baseTopics].filter((title) => !varTopics.has(title)),
  };
}

// ---------------------------------------------------------------------------
// Run helpers
// ---------------------------------------------------------------------------

interface AudioRun {
  runId: string;
  experiment: string;
  plan: OverviewPlan;
  graph: SemanticGraph;
  sources: readonly SourceArtifact[];
  artifactId: string;
}

async function compileRun(run: AudioRun): Promise<AudioOverviewResult> {
  return compileAudioOverview({
    plan: run.plan,
    graph: run.graph,
    sources: run.sources,
    options: {
      seed: AUDIO_SEED,
      now: FIXED_NOW,
      mastering: 'pure-ts',
      artifactId: run.artifactId,
      notes: `EXP-A series run ${run.runId} (${run.experiment}); deterministic; tl2 integration station 2026-09-27`,
    },
  });
}

function persistRun(run: AudioRun, result: AudioOverviewResult): void {
  const dir = join(OUT_ROOT, run.runId);
  mkdirSync(dir, { recursive: true });
  const write = (name: string, value: unknown): void => {
    writeFileSync(join(dir, name), `${stableStringify(value)}\n`, 'utf8');
  };
  write('plan.json', result.plan);
  write('artifact.json', result.artifact);
  write('qa-report.json', result.qa);
  write('timing-manifest.json', result.timing);
}

const DEEP_DIVE_REQUEST_BASE: Omit<DirectorRequest, 'planId'> = {
  sources: [CANONICAL_SOURCE],
  graph: CANONICAL_GRAPH,
  modality: 'audio',
  audience: 'technical',
  language: 'en',
  targetDurationSeconds: 300,
  seed: 'wflx-exp-a-director-seed',
  now: DIRECTOR_NOW,
};

interface ModeRow {
  runId: string;
  experiment: string;
  mode: string;
  duration: number;
  turnCount: number;
  beatCount: number;
  speakers: number;
  coverageFraction: number;
  totalTurnSeconds: number;
  wordsPerSecondMean: number;
  qaStatus: string;
  overBudgetTurns: number;
  topPurposes: string;
}

function modeRow(metrics: RunMetrics): ModeRow {
  const topPurposes = Object.entries(metrics.purposeHistogram)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([purpose, count]) => `${purpose}x${count}`)
    .join(', ');
  return {
    runId: metrics.runId,
    experiment: metrics.experiment,
    mode: metrics.mode,
    duration: metrics.targetDurationSeconds,
    turnCount: metrics.turnCount,
    beatCount: metrics.beatCount,
    speakers: metrics.speakers.length,
    coverageFraction: Math.round(metrics.coverageFraction * 100) / 100,
    totalTurnSeconds: Math.round(metrics.totalTurnSeconds * 10) / 10,
    wordsPerSecondMean: Math.round(metrics.wordsPerSecondMean * 100) / 100,
    qaStatus: metrics.qaStatus,
    overBudgetTurns: metrics.overBudgetTurns,
    topPurposes,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  mkdirSync(OUT_ROOT, { recursive: true });
  const started = Date.now();
  const allMetrics: RunMetrics[] = [];
  const allDiffs: RunDiff[] = [];
  const slim = new Map<string, SlimResult>();
  const mediaHashes = new Map<string, string>();

  const runAndPersist = async (run: AudioRun): Promise<SlimResult> => {
    process.stdout.write(`compiling ${run.runId} ... `);
    const result = await compileRun(run);
    persistRun(run, result);
    allMetrics.push(metricsFor(run.runId, run.experiment, result, run.graph));
    const light: SlimResult = {
      plan: result.plan,
      realized: result.realized.map((turn) => ({
        turnId: turn.turnId,
        text: turn.text,
        wordCount: turn.wordCount,
        overBudget: turn.overBudget,
      })),
    };
    slim.set(run.runId, light);
    mediaHashes.set(run.runId, audioMediaSha256(result));
    process.stdout.write(`${result.plan.audioTurns.length} turns, qa=${result.qa.status}\n`);
    return light;
  };

  // ---- baselines and mode arms (EXP-A-01/02/03) --------------------------
  await runAndPersist({
    runId: 'deepdive-5min-baseline',
    experiment: 'exp-a-01/02/03-baseline',
    plan: compileOverviewPlan({
      ...DEEP_DIVE_REQUEST_BASE,
      planId: 'plan-exp-a-audio-deepdive-5min',
    }),
    graph: CANONICAL_GRAPH,
    sources: [CANONICAL_SOURCE],
    artifactId: 'artifact-exp-a-deepdive-5min-baseline',
  });
  await runAndPersist({
    runId: 'brief-2min-canonical',
    experiment: 'exp-a-01',
    plan: CANONICAL_BRIEF_PLAN,
    graph: CANONICAL_GRAPH,
    sources: [CANONICAL_SOURCE],
    artifactId: 'artifact-exp-a-brief-2min',
  });
  await runAndPersist({
    runId: 'critique-5min-canonical',
    experiment: 'exp-a-02',
    plan: CANONICAL_CRITIQUE_PLAN,
    graph: CANONICAL_GRAPH,
    sources: [CANONICAL_SOURCE],
    artifactId: 'artifact-exp-a-critique-5min',
  });
  await runAndPersist({
    runId: 'debate-5min-canonical',
    experiment: 'exp-a-03',
    plan: CANONICAL_DEBATE_PLAN,
    graph: CANONICAL_GRAPH,
    sources: [CANONICAL_SOURCE],
    artifactId: 'artifact-exp-a-debate-5min',
  });
  await runAndPersist({
    runId: 'brief-5min-deconfound',
    experiment: 'exp-a-01-deconfound',
    plan: compileOverviewPlan({
      ...DEEP_DIVE_REQUEST_BASE,
      mode: 'brief',
      planId: 'plan-exp-a-audio-brief-5min',
    }),
    graph: CANONICAL_GRAPH,
    sources: [CANONICAL_SOURCE],
    artifactId: 'artifact-exp-a-brief-5min-deconfound',
  });

  // ---- EXP-A-04: one-paragraph source mutation ----------------------------
  if (!RAW_NOTE.includes(B30_ORIGINAL)) {
    throw new Error(`b30 paragraph not found in raw fixture: ${JSON.stringify(B30_ORIGINAL)}`);
  }
  const adapter = new MarkdownNoteAdapter();
  const extractor = new DeterministicExtractor();
  const ingestBase = {
    id: 'source-messy-note-redacted',
    label: 'fixtures/reference-messy-note-redacted.md',
    createdAt: DIRECTOR_NOW,
  } as const;
  const controlSource = await adapter.ingest({ ...ingestBase, content: RAW_NOTE });
  const mutatedRaw = RAW_NOTE.replace(B30_ORIGINAL, B30_MUTATED);
  if (mutatedRaw === RAW_NOTE) throw new Error('mutation did not apply');
  const mutatedSource = await adapter.ingest({ ...ingestBase, content: mutatedRaw });
  const extractionOptions = { createdAt: DIRECTOR_NOW } as const;
  const controlGraph = await extractor.extract({
    sources: [controlSource],
    options: extractionOptions,
  });
  const mutatedGraph = await extractor.extract({
    sources: [mutatedSource],
    options: extractionOptions,
  });
  writeFileSync(
    join(OUT_ROOT, 'exp-a04-graph-diff.json'),
    `${stableStringify(diffGraphs(controlGraph, mutatedGraph))}\n`,
    'utf8',
  );
  const a04RequestBase = {
    modality: 'audio' as const,
    audience: 'technical' as const,
    language: 'en',
    targetDurationSeconds: 300,
    seed: 'wflx-exp-a-director-seed',
    now: DIRECTOR_NOW,
    planId: 'plan-exp-a04-audio-deepdive-5min',
  } as const;
  await runAndPersist({
    runId: 'a04-control-deepdive-5min',
    experiment: 'exp-a-04-control',
    plan: compileOverviewPlan({
      ...a04RequestBase,
      sources: [controlSource],
      graph: controlGraph,
    }),
    graph: controlGraph,
    sources: [controlSource],
    artifactId: 'artifact-exp-a04-control-deepdive-5min',
  });
  await runAndPersist({
    runId: 'a04-mut-b30-deepdive-5min',
    experiment: 'exp-a-04-mutation',
    // Same planId as the control arm: the ONLY intended variable is the b30
    // paragraph text (documented in the experiment record).
    plan: compileOverviewPlan({
      ...a04RequestBase,
      sources: [mutatedSource],
      graph: mutatedGraph,
    }),
    graph: mutatedGraph,
    sources: [mutatedSource],
    artifactId: 'artifact-exp-a04-mut-b30-deepdive-5min',
  });

  // ---- EXP-A-05: duration 300 -> 180 --------------------------------------
  await runAndPersist({
    runId: 'deepdive-3min-duration',
    experiment: 'exp-a-05',
    plan: compileOverviewPlan({
      ...DEEP_DIVE_REQUEST_BASE,
      targetDurationSeconds: 180,
      planId: 'plan-exp-a-audio-deepdive-3min',
    }),
    graph: CANONICAL_GRAPH,
    sources: [CANONICAL_SOURCE],
    artifactId: 'artifact-exp-a-deepdive-3min',
  });

  // ---- EXP-A-06: language en -> es -----------------------------------------
  await runAndPersist({
    runId: 'deepdive-5min-es',
    experiment: 'exp-a-06',
    plan: compileOverviewPlan({
      ...DEEP_DIVE_REQUEST_BASE,
      language: 'es',
      planId: 'plan-exp-a-audio-deepdive-5min-es',
    }),
    graph: CANONICAL_GRAPH,
    sources: [CANONICAL_SOURCE],
    artifactId: 'artifact-exp-a-deepdive-5min-es',
  });

  // ---- determinism spot-check: baseline compiled twice --------------------
  process.stdout.write('determinism spot-check (baseline recompile) ... ');
  const baselineLight = slim.get('deepdive-5min-baseline');
  if (baselineLight === undefined) throw new Error('baseline result missing');
  const recheck = await compileRun({
    runId: 'deepdive-5min-baseline-recheck',
    experiment: 'determinism-check',
    plan: baselineLight.plan,
    graph: CANONICAL_GRAPH,
    sources: [CANONICAL_SOURCE],
    artifactId: 'artifact-exp-a-deepdive-5min-baseline',
  });
  const recheckHash = audioMediaSha256(recheck);
  const baselineHash = mediaHashes.get('deepdive-5min-baseline');
  const determinismOk = baselineHash === recheckHash;
  process.stdout.write(`${determinismOk ? 'IDENTICAL' : 'DIVERGED'} ${recheckHash.slice(0, 16)}\n`);

  // ---- diffs ---------------------------------------------------------------
  const byRunId = (runId: string): RunMetrics => {
    const m = allMetrics.find((metric) => metric.runId === runId);
    if (m === undefined) throw new Error(`missing metrics for ${runId}`);
    return m;
  };
  const resultOf = (runId: string): SlimResult => {
    const r = slim.get(runId);
    if (r === undefined) throw new Error(`missing result for ${runId}`);
    return r;
  };
  const baseline = byRunId('deepdive-5min-baseline');
  for (const variantRunId of [
    'brief-2min-canonical',
    'brief-5min-deconfound',
    'critique-5min-canonical',
    'debate-5min-canonical',
    'deepdive-3min-duration',
    'deepdive-5min-es',
  ]) {
    allDiffs.push(
      diffRuns(
        baseline,
        byRunId(variantRunId),
        resultOf('deepdive-5min-baseline'),
        resultOf(variantRunId),
        [],
      ),
    );
  }
  allDiffs.push(
    diffRuns(
      byRunId('a04-control-deepdive-5min'),
      byRunId('a04-mut-b30-deepdive-5min'),
      resultOf('a04-control-deepdive-5min'),
      resultOf('a04-mut-b30-deepdive-5min'),
      [
        'One-variable: only block b30 text differs between arms; both arms run the same adapter -> extractor -> Director -> audio chain with identical ids/seeds.',
        'Post-C-5 (v2 wave) realized-text locality is turn-LOCAL: seeded surfaces key on the turn content hash, so unchanged turns keep their texts byte-identically (the v1 planHash-keyed reshuffle — 21/25 texts per EV-006 — is fixed; this diff regenerates under C-10 with the monologic brief skeleton, which touches the brief arms only).',
      ],
    ),
  );

  // ---- summary + tables ----------------------------------------------------
  const summary = {
    generatedAtUtc: new Date().toISOString(),
    runner: 'experiments/run-exp-a.ts',
    audioSeed: AUDIO_SEED,
    fixedNow: FIXED_NOW,
    directorSeed: DEEP_DIVE_REQUEST_BASE.seed,
    determinismSpotCheck: {
      baselineRunId: 'deepdive-5min-baseline',
      recompiledMediaSha256: recheckHash,
      identical: determinismOk,
    },
    mutation: {
      experiment: 'exp-a-04',
      block: 'b30',
      original: B30_ORIGINAL,
      mutated: B30_MUTATED,
    },
    metrics: allMetrics,
    diffs: allDiffs,
    graphDiff: diffGraphs(controlGraph, mutatedGraph),
  };
  writeFileSync(join(OUT_ROOT, 'summary.json'), `${stableStringify(summary)}\n`, 'utf8');

  const rows = allMetrics.map(modeRow);
  process.stdout.write('\n=== EXP-A structural metrics ===\n');
  for (const row of rows) {
    process.stdout.write(
      `${row.runId.padEnd(28)} mode=${row.mode.padEnd(10)} dur=${String(row.duration).padEnd(4)} ` +
        `turns=${String(row.turnCount).padEnd(3)} beats=${String(row.beatCount).padEnd(3)} ` +
        `spk=${String(row.speakers).padEnd(2)} cov=${String(row.coverageFraction).padEnd(5)} ` +
        `wps=${String(row.wordsPerSecondMean).padEnd(5)} qa=${row.qaStatus} over=${row.overBudgetTurns}\n`,
    );
  }
  process.stdout.write('\n=== EXP-A diffs vs baseline (control for a04) ===\n');
  for (const diff of allDiffs) {
    process.stdout.write(
      `${diff.variant.padEnd(28)} dTurns=${String(diff.turnCountDelta).padEnd(5)} ` +
        `dBeats=${String(diff.beatCountDelta).padEnd(4)} dSec=${String(diff.totalTurnSecondsDelta).padEnd(7)} ` +
        `cov+=[${diff.coverageAdded.join(',')}] cov-=[${diff.coverageRemoved.join(',')}] ` +
        `structChg=${diff.structureChangedTurns}/${diff.structureChangedTurns + diff.structureUnchangedTurns} ` +
        `textSame=${diff.textIdenticalTurns}/${diff.textIdenticalTurns + diff.textChangedTurns}\n`,
    );
  }
  process.stdout.write(
    `\ngraph diff (a04): claimsChanged=[${summary.graphDiff.claimsChanged.join(',')}] ` +
      `added=[${summary.graphDiff.claimsAdded.join(',')}] removed=[${summary.graphDiff.claimsRemoved.join(',')}]\n`,
  );
  process.stdout.write(
    `\ndone in ${((Date.now() - started) / 1000).toFixed(1)}s -> ${OUT_ROOT}/summary.json\n`,
  );
  if (!determinismOk) {
    throw new Error('determinism spot-check FAILED: baseline recompile diverged');
  }
}

await main();
