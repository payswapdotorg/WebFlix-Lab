/**
 * Audio parity comparison suite (WFLX-P3 Deliverable B / EV-024).
 *
 * A repeatable harness that, for each audio dimension with product-side
 * truth in the LAB-series capture estate:
 *   1. compiles the LAB-canonical source through the lab pipeline (the
 *      OFFLINE DETERMINISTIC DEFAULT — env-gated live providers stay off),
 *      mirroring the EXP-A series constants exactly so the measured values
 *      reproduce the committed exp-a-r2 store;
 *   2. computes the SAME metric family the LAB records observed (duration,
 *      turn counts / voice counts / roles, speaker structure, macro
 *      skeleton, mutation-locality diff on the b30 mutation — the EXP-A-04
 *      comparison axis, stochasticity surface per LAB-06);
 *   3. emits one comparison record per dimension: lab value, product value
 *      (from the ingested estate — never re-measured, never invented),
 *      delta/band, verdict VERIFIED / DIVERGENT / PENDING, confidence.
 *
 * Honest boundaries (work order §3):
 *   - the product's scheduling-lane behavior change (2026-10-01: audio
 *     generation moved to scheduled queuing) is banked truth — comparisons
 *     are against the CAPTURED artifacts, never against live re-runs;
 *   - where a lab dimension has no product-side capture yet (custom
 *     steering prompt audio = LAB-10, scheduled at capture time; the
 *     Interactive Audio surface), the comparison is recorded as
 *     COMPARISON PENDING REFERENCE CAPTURE with TL-hooks for post-capture
 *     fill.
 *
 * Pure module: runAudioComparisonSuite() performs no filesystem writes and
 * reads only the committed store; experiments/run-comparison-audio.ts emits
 * the records and tests/integration/comparison-harness.test.ts asserts the
 * invariants.
 */

import { readFileSync } from 'node:fs';
import {
  compileAudioOverview,
  type AudioOverviewResult,
} from '../../src/audio';
import { compileOverviewPlan, type DirectorRequest } from '../../src/director/compiler';
import { MarkdownNoteAdapter } from '../../src/source/markdown-note-adapter';
import { DeterministicExtractor } from '../../src/source/graph/deterministic-extractor';
import type { OverviewPlan, SemanticGraph, SourceArtifact, UtcTimestamp } from '../../src/contracts';
import {
  COMPARISON_RECORD_TYPE,
  COMPARISON_SCHEMA_VERSION,
  assertRecordValid,
  type ComparisonMetric,
  type ComparisonRecord,
  type Observation,
} from './schema';
import { loadEstate, type Estate } from './ingest';
import {
  durationDelta,
  equalityMetric,
  percentPointMetric,
  qualitativeMetric,
  ratioBandMetric,
} from './rules';

// ---------------------------------------------------------------------------
// Fixed experiment constants — EXACTLY the EXP-A series values so the
// measured numbers reproduce the committed artifacts/audio/exp-a-r2 store.
// ---------------------------------------------------------------------------

const AUDIO_SEED = 'wflx-exp-a-audio-seed';
const FIXED_NOW: UtcTimestamp = '2026-09-27T00:00:00Z';
const DIRECTOR_NOW: UtcTimestamp = '2026-09-27T00:00:00Z';
const RECORD_STAMP = '2026-10-01T20:00:00Z';
const OPERATOR = 'wflx-p3';

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

const B30_ORIGINAL = 'All credentials are `[REDACTED]`.';
const B30_MUTATED =
  'All credentials are `[REDACTED]` and are rotated quarterly by the platform team.';

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

const LAB_PIPELINE_NOTE =
  'lab pipeline: Director -> audio compile, OFFLINE deterministic default (seed wflx-exp-a-audio-seed, fixed now 2026-09-27T00:00:00Z; the EXP-A series constants — values reproduce the committed artifacts/audio/exp-a-r2 store)';

// ---------------------------------------------------------------------------
// Arm execution
// ---------------------------------------------------------------------------

export interface ArmMeasurement {
  readonly runId: string;
  readonly turnCount: number;
  readonly beatCount: number;
  readonly speakers: readonly string[];
  readonly coveredClaims: number;
  readonly omittedClaims: number;
  readonly totalTurnSeconds: number;
  readonly wordsPerSecondMean: number;
  readonly realizedTexts: readonly string[];
  readonly artifactId: string;
  readonly mediaSha256: string;
  readonly beatTitles: readonly string[];
}

function measure(runId: string, result: AudioOverviewResult): ArmMeasurement {
  const speakers = new Set<string>();
  for (const turn of result.plan.audioTurns) speakers.add(turn.speaker);
  const wordsTotal = result.realized.reduce((sum, turn) => sum + turn.wordCount, 0);
  return {
    runId,
    turnCount: result.plan.audioTurns.length,
    beatCount: result.plan.beats.length,
    speakers: [...speakers].sort(),
    coveredClaims: result.plan.coverage.covered.length,
    omittedClaims: result.plan.coverage.omitted.length,
    totalTurnSeconds: result.timing.totalTurnSeconds,
    wordsPerSecondMean:
      result.timing.totalTurnSeconds > 0
        ? Math.round((wordsTotal / result.timing.totalTurnSeconds) * 1000) / 1000
        : 0,
    realizedTexts: result.realized.map((turn) => turn.text),
    artifactId: result.artifact.id,
    mediaSha256: result.artifact.media.sha256,
    beatTitles: result.plan.beats.map((beat) => beat.title),
  };
}

async function compileArm(
  plan: OverviewPlan,
  artifactId: string,
  graph: SemanticGraph = CANONICAL_GRAPH,
  sources: readonly SourceArtifact[] = [CANONICAL_SOURCE],
): Promise<AudioOverviewResult> {
  return compileAudioOverview({
    plan,
    graph,
    sources,
    options: {
      seed: AUDIO_SEED,
      now: FIXED_NOW,
      mastering: 'pure-ts',
      artifactId,
      notes: `WFLX-P3 comparison suite arm ${artifactId}; deterministic; reproduces the exp-a-r2 store`,
    },
  });
}

// ---------------------------------------------------------------------------
// Dimension record builder
// ---------------------------------------------------------------------------

interface DimensionInput {
  readonly id: string;
  readonly surface: 'audio' | 'video';
  readonly dimension: string;
  readonly estateRecordId: string;
  readonly metrics: readonly ComparisonMetric[];
  readonly productObservations: readonly Observation[];
  readonly labObservations: readonly Observation[];
  readonly unresolvedBehavior: readonly string[];
  readonly tlHooks: readonly string[];
  readonly evidencePaths: readonly string[];
  readonly confidence: 'low' | 'medium' | 'high';
  readonly labArtifactId: string;
}

function estateById(estate: Estate, id: string): ComparisonRecord {
  const record = estate.records.find((candidate) => candidate.id === id);
  if (record === undefined) throw new Error(`estate record missing: ${id}`);
  return record;
}

/** Pull an observation verbatim from an estate record (fail-loud). */
function observationOf(record: ComparisonRecord, needle: string): Observation {
  const observation = record.observations.find((candidate) => candidate.text.includes(needle));
  if (observation === undefined) {
    throw new Error(`observation containing "${needle}" not found in ${record.id}`);
  }
  return observation;
}

function buildDimensionRecord(estate: Estate, input: DimensionInput): ComparisonRecord {
  const capture = estateById(estate, input.estateRecordId);
  const record: ComparisonRecord = {
    recordType: COMPARISON_RECORD_TYPE,
    schemaVersion: COMPARISON_SCHEMA_VERSION,
    id: input.id,
    kind: 'dimension-comparison',
    timestamp_utc: RECORD_STAMP,
    operator: OPERATOR,
    surface: input.surface,
    dimension: input.dimension,
    reference_config: capture.reference_config,
    source_fingerprint: capture.source_fingerprint,
    artifact_fingerprint: capture.artifact_fingerprint,
    captured_utc: capture.captured_utc,
    duration_seconds: capture.duration_seconds,
    custom_prompt: capture.custom_prompt,
    observations: [...input.productObservations, ...input.labObservations],
    annotations: capture.annotations,
    comparison: {
      lab_artifact_id: input.labArtifactId,
      lab_pipeline: LAB_PIPELINE_NOTE,
      metrics: [...input.metrics],
    },
    confidence: input.confidence,
    unresolved_behavior: [...input.unresolvedBehavior],
    tl_hooks: [...input.tlHooks],
    evidence_paths: [...input.evidencePaths],
    status: 'compared',
  };
  assertRecordValid(record);
  return record;
}

function pendingRecord(
  id: string,
  dimension: string,
  metrics: readonly ComparisonMetric[],
  observations: readonly Observation[],
  tlHooks: readonly string[],
  evidencePaths: readonly string[],
  notes: readonly string[],
): ComparisonRecord {
  const record: ComparisonRecord = {
    recordType: COMPARISON_RECORD_TYPE,
    schemaVersion: COMPARISON_SCHEMA_VERSION,
    id,
    kind: 'pending-slot',
    timestamp_utc: RECORD_STAMP,
    operator: OPERATOR,
    surface: 'audio',
    dimension,
    reference_config: {
      notebook: null,
      format: 'Deep Dive + custom steering prompt (product-side capture scheduled — LAB-10)',
      language: null,
      length: null,
      visual_style: null,
      custom_prompt: null,
      other_config: null,
    },
    source_fingerprint: null,
    artifact_fingerprint: {
      sha256: null,
      path: null,
      media_present: false,
      additional: [],
      note: 'product-side capture does not exist yet (LAB-10 scheduled; Interactive Audio operator-gated)',
    },
    captured_utc: null,
    duration_seconds: null,
    custom_prompt: null,
    observations: [...observations],
    annotations: { transcript_path: null, scene_annotation_path: null, notes: null },
    comparison: { lab_artifact_id: null, lab_pipeline: LAB_PIPELINE_NOTE, metrics: [...metrics] },
    confidence: 'low',
    unresolved_behavior: [...notes],
    tl_hooks: [...tlHooks],
    evidence_paths: [...evidencePaths],
    status: 'pending-capture',
  };
  assertRecordValid(record);
  return record;
}

const labObservation = (text: string, source: string): Observation => ({
  label: 'REPRODUCED',
  text,
  source,
});

const productObservation = (observation: Observation): Observation => observation;

// ---------------------------------------------------------------------------
// The suite
// ---------------------------------------------------------------------------

export interface AudioSuiteResult {
  readonly records: readonly ComparisonRecord[];
  readonly arms: Readonly<Record<string, ArmMeasurement>>;
  readonly determinism: {
    readonly baselineRunId: string;
    readonly recompiledMediaSha256: string;
    readonly byteIdentical: boolean;
  };
  readonly mutationLocality: {
    readonly textIdenticalTurns: number;
    readonly textChangedTurns: number;
    readonly structureChangedTurns: number;
    readonly mutatedContentVoiced: boolean;
  };
}

function textDiff(
  baseline: readonly string[],
  variant: readonly string[],
): { identical: number; changed: number } {
  const n = Math.min(baseline.length, variant.length);
  let identical = 0;
  for (let i = 0; i < n; i += 1) {
    if (baseline[i] === variant[i]) identical += 1;
  }
  return { identical, changed: n - identical };
}

export async function runAudioComparisonSuite(): Promise<AudioSuiteResult> {
  const estate = loadEstate();
  const lab01 = estate.captures['LAB-01'];
  const lab02 = estate.captures['LAB-02'];
  const lab03 = estate.captures['LAB-03'];
  const lab04 = estate.captures['LAB-04'];
  const lab05 = estate.captures['LAB-05'];
  const estateLab01 = estateById(estate, 'ESTATE-LAB-01');
  const estateLab02 = estateById(estate, 'ESTATE-LAB-02');
  const estateLab03 = estateById(estate, 'ESTATE-LAB-03');
  const estateLab04 = estateById(estate, 'ESTATE-LAB-04');
  const estateLab05 = estateById(estate, 'ESTATE-LAB-05');
  const estateLab06 = estateById(estate, 'ESTATE-LAB-06');

  // ---- compile the canonical arms (offline deterministic default) --------
  const arms: Record<string, ArmMeasurement> = {};

  const baseline = measure(
    'deepdive-5min-baseline',
    await compileArm(
      compileOverviewPlan({ ...DEEP_DIVE_REQUEST_BASE, planId: 'plan-exp-a-audio-deepdive-5min' }),
      'artifact-exp-a-deepdive-5min-baseline',
    ),
  );
  arms['deepdive-5min-baseline'] = baseline;

  const brief = measure(
    'brief-2min-canonical',
    await compileArm(CANONICAL_BRIEF_PLAN, 'artifact-exp-a-brief-2min'),
  );
  arms['brief-2min-canonical'] = brief;

  const critique = measure(
    'critique-5min-canonical',
    await compileArm(CANONICAL_CRITIQUE_PLAN, 'artifact-exp-a-critique-5min'),
  );
  arms['critique-5min-canonical'] = critique;

  const debate = measure(
    'debate-5min-canonical',
    await compileArm(CANONICAL_DEBATE_PLAN, 'artifact-exp-a-debate-5min'),
  );
  arms['debate-5min-canonical'] = debate;

  const short180 = measure(
    'deepdive-3min-duration',
    await compileArm(
      compileOverviewPlan({
        ...DEEP_DIVE_REQUEST_BASE,
        targetDurationSeconds: 180,
        planId: 'plan-exp-a-audio-deepdive-3min',
      }),
      'artifact-exp-a-deepdive-3min',
    ),
  );
  arms['deepdive-3min-duration'] = short180;

  const es = measure(
    'deepdive-5min-es',
    await compileArm(
      compileOverviewPlan({
        ...DEEP_DIVE_REQUEST_BASE,
        language: 'es',
        planId: 'plan-exp-a-audio-deepdive-5min-es',
      }),
      'artifact-exp-a-deepdive-5min-es',
    ),
  );
  arms['deepdive-5min-es'] = es;

  // ---- EXP-A-04 mutation chain (adapter -> extractor -> Director) --------
  if (!RAW_NOTE.includes(B30_ORIGINAL)) throw new Error('b30 paragraph not found in raw fixture');
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
  const controlGraph = await extractor.extract({ sources: [controlSource], options: extractionOptions });
  const mutatedGraph = await extractor.extract({ sources: [mutatedSource], options: extractionOptions });
  const a04RequestBase = {
    modality: 'audio' as const,
    audience: 'technical' as const,
    language: 'en',
    targetDurationSeconds: 300,
    seed: 'wflx-exp-a-director-seed',
    now: DIRECTOR_NOW,
    planId: 'plan-exp-a04-audio-deepdive-5min',
  } as const;
  const a04ControlPlan = compileOverviewPlan({
    ...a04RequestBase,
    sources: [controlSource],
    graph: controlGraph,
  });
  const a04MutPlan = compileOverviewPlan({
    ...a04RequestBase,
    sources: [mutatedSource],
    graph: mutatedGraph,
  });
  const a04Control = measure(
    'a04-control-deepdive-5min',
    await compileArm(a04ControlPlan, 'artifact-exp-a04-control-deepdive-5min', controlGraph, [controlSource]),
  );
  const a04Mut = measure(
    'a04-mut-b30-deepdive-5min',
    await compileArm(a04MutPlan, 'artifact-exp-a04-mut-b30-deepdive-5min', mutatedGraph, [mutatedSource]),
  );
  arms['a04-control-deepdive-5min'] = a04Control;
  arms['a04-mut-b30-deepdive-5min'] = a04Mut;

  // ---- determinism spot-check (the LAB-06 axis lab side) ------------------
  const recheck = await compileArm(
    compileOverviewPlan({ ...DEEP_DIVE_REQUEST_BASE, planId: 'plan-exp-a-audio-deepdive-5min' }),
    'artifact-exp-a-deepdive-5min-baseline',
  );
  const determinism = {
    baselineRunId: 'deepdive-5min-baseline',
    recompiledMediaSha256: recheck.artifact.media.sha256,
    byteIdentical: recheck.artifact.media.sha256 === baseline.mediaSha256,
  };
  if (!determinism.byteIdentical) {
    throw new Error('determinism spot-check FAILED: baseline recompile diverged');
  }

  // ---- mutation locality numbers ------------------------------------------
  const mutationTextDiff = textDiff(a04Control.realizedTexts, a04Mut.realizedTexts);
  const mutatedContentVoiced = a04Mut.realizedTexts.some((text) =>
    text.toLowerCase().includes('rotated quarterly'),
  );
  const mutationLocality = {
    textIdenticalTurns: mutationTextDiff.identical,
    textChangedTurns: mutationTextDiff.changed,
    structureChangedTurns:
      a04Control.turnCount === a04Mut.turnCount ? 0 : Math.abs(a04Mut.turnCount - a04Control.turnCount),
    mutatedContentVoiced,
  };

  const labProductDuration = lab01.durationSeconds ?? 0;
  const productBrief = lab02.formats.find((f) => f.format === 'Brief');
  const productCritique = lab02.formats.find((f) => f.format === 'Critique');
  const productDebate = lab02.formats.find((f) => f.format === 'Debate');
  if (productBrief === undefined || productCritique === undefined || productDebate === undefined) {
    throw new Error('LAB-02 sidecar missing one of Brief/Critique/Debate');
  }
  const productCompression = (lab03.durationSeconds ?? 0) / labProductDuration;
  const labCompression = short180.totalTurnSeconds / baseline.totalTurnSeconds;
  const productEsShift =
    ((lab04.durationSeconds ?? 0) - labProductDuration) / labProductDuration * 100;
  const productMutShift =
    ((lab05.durationSeconds ?? 0) - labProductDuration) / labProductDuration * 100;
  const labWpsChange =
    ((short180.wordsPerSecondMean - baseline.wordsPerSecondMean) / baseline.wordsPerSecondMean) * 100;

  const records: ComparisonRecord[] = [];

  // ---- AUDIO-PARITY-01: Deep Dive structure (LAB-01) ----------------------
  records.push(
    buildDimensionRecord(estate, {
      id: 'AUDIO-PARITY-01',
      surface: 'audio',
      dimension: 'audio.deep-dive.default',
      estateRecordId: 'ESTATE-LAB-01',
      labArtifactId: baseline.artifactId,
      confidence: 'medium',
      metrics: [
        ratioBandMetric({
          metric: 'deepdive.duration.seconds',
          unit: 's',
          lab: { value: baseline.totalTurnSeconds, source: 'artifact-exp-a-deepdive-5min-baseline (lab compile; placeholder narration pins realized duration to the 300 s planning target)' },
          product: { value: lab01.durationSeconds ?? 0, source: 'ESTATE-LAB-01 (capture sidecar 1201.82 s)' },
          confidence: 'high',
          note: 'duration-class gap: the lab canonical Deep Dive compiles at a 5 min Default target; the product Default on this fixture class ran ~20 min. The length-control dimension is AUDIO-PARITY-03. Placeholder narration pins lab duration to target exactly (measurement-class note).',
        }),
        equalityMetric({
          metric: 'deepdive.structure.speakerCount',
          lab: { value: baseline.speakers.length, source: 'artifact-exp-a-deepdive-5min-baseline (plan.audioTurns speakers: Host A, Host B)' },
          product: { value: lab01.hosts ?? 0, source: 'ESTATE-LAB-01 (capture sidecar hosts: 2)' },
          confidence: 'high',
        }),
        qualitativeMetric({
          metric: 'deepdive.structure.macroSkeleton',
          lab: {
            text: `6-beat plan skeleton: framing beat -> 4 section beats (tools / infrastructure / architecture / purpose) -> synthesis beat (${baseline.beatTitles.length} beats, ${baseline.turnCount} turns; section walk in source order)`,
            source: 'artifact-exp-a-deepdive-5min-baseline (plan.beats + audioTurns)',
          },
          product: {
            text: observationOf(estateLab01, 'three distinct strata').text,
            source: 'docs/experiments/records/LAB-01.yaml',
          },
          verdict: 'VERIFIED',
          confidence: 'medium',
          note: 'hook -> source-title reference -> roadmap -> section walk -> synthesis close observed on the product; lab plan walks the same skeleton mechanically.',
        }),
        qualitativeMetric({
          metric: 'deepdive.structure.turnsPerBeat',
          lab: {
            text: `${baseline.turnCount} turns / ${baseline.beatCount} beats = ${(baseline.turnCount / baseline.beatCount).toFixed(2)} turns per beat (plan-exact)`,
            source: 'artifact-exp-a-deepdive-5min-baseline (plan)',
          },
          product: {
            text: observationOf(estateLab01, '2-6 host turns per topic beat').text,
            source: 'docs/experiments/records/LAB-01.yaml (ASR 3x150 s sampled)',
          },
          verdict: 'VERIFIED',
          confidence: 'low',
          note: 'the plan-exact lab value lies within the product ASR-sampled observed range; measurement classes differ (plan vs sampled estimate — recorded).',
        }),
      ],
      productObservations: [
        productObservation(observationOf(estateLab01, 'exactly TWO hosts')),
        productObservation(observationOf(estateLab01, 'the episode follows the source')),
      ],
      labObservations: [
        labObservation(
          `lab compile: ${baseline.turnCount} turns, ${baseline.speakers.length} speakers (${baseline.speakers.join(' / ')}), ${baseline.beatCount} beats, ${baseline.totalTurnSeconds} s realized, coverage ${baseline.coveredClaims}/${baseline.coveredClaims + baseline.omittedClaims} claims`,
          'experiments/run-comparison-audio.ts (this suite) reproducing artifacts/audio/exp-a-r2/deepdive-5min-baseline',
        ),
      ],
      unresolvedBehavior: [
        'product turn-level structure is only ASR-sample-estimated black-box (no committed full transcript for LAB-01); turn-count parity is UNRESOLVED below the macro skeleton',
        'duration-class gap: product Default ~20 min vs lab canonical 5 min on this fixture class (recorded, not silently normalized)',
      ],
      tlHooks: [],
      evidencePaths: [
        'docs/experiments/records/LAB-01.yaml',
        'artifacts/reference/lab-01/artifact.json',
        'artifacts/audio/exp-a-r2/deepdive-5min-baseline/',
        'docs/experiments/comparisons/estate/ESTATE-LAB-01.yaml',
      ],
    }),
  );

  // ---- AUDIO-PARITY-02: mode family (LAB-02) ------------------------------
  records.push(
    buildDimensionRecord(estate, {
      id: 'AUDIO-PARITY-02',
      surface: 'audio',
      dimension: 'audio.mode-family',
      estateRecordId: 'ESTATE-LAB-02',
      labArtifactId: `${brief.artifactId} | ${critique.artifactId} | ${debate.artifactId}`,
      confidence: 'medium',
      metrics: [
        equalityMetric({
          metric: 'mode.brief.voiceCount',
          lab: { value: brief.speakers.length, source: 'artifact-exp-a-brief-2min (single Narrator — the C-10 monologic brief)' },
          product: { value: productBrief.voices ?? 0, source: 'ESTATE-LAB-02 (Brief sidecar voices: 1)' },
          confidence: 'high',
        }),
        ratioBandMetric({
          metric: 'mode.brief.duration.seconds',
          unit: 's',
          lab: { value: brief.totalTurnSeconds, source: 'artifact-exp-a-brief-2min (120 s canonical target)' },
          product: { value: productBrief.durationSeconds, source: 'ESTATE-LAB-02 (Brief sidecar 93.92 s)' },
          confidence: 'medium',
          note: `product/lab within the declared duration-ratio band (same duration class); ${durationDelta(brief.totalTurnSeconds, productBrief.durationSeconds)}`,
        }),
        qualitativeMetric({
          metric: 'mode.brief.monologicStructure',
          lab: {
            text: 'C-10 monologic brief: single Narrator over a 6-turn enumerated skeleton (explanation/framing/conclusion purposes, enumeration openers)',
            source: 'fixtures/contracts/plan-audio-brief-2min.json + src/audio mode semantics (EXP-A-01 axis)',
          },
          product: {
            text: observationOf(estateLab02, 'First... Second... Finally').text,
            source: 'docs/experiments/records/LAB-02.yaml',
          },
          verdict: 'VERIFIED',
          confidence: 'medium',
          note: 'both monologic + enumerated; the lab models the surface as a 6-turn skeleton while the product is one continuous narration (over-structuring distinction recorded in unresolved_behavior).',
        }),
        equalityMetric({
          metric: 'mode.critique.voiceCount',
          lab: { value: critique.speakers.length, source: 'artifact-exp-a-critique-5min (Host A + Host B)' },
          product: { value: productCritique.voices ?? 0, source: 'ESTATE-LAB-02 (Critique sidecar voices: 2)' },
          confidence: 'high',
        }),
        ratioBandMetric({
          metric: 'mode.critique.duration.seconds',
          unit: 's',
          lab: { value: critique.totalTurnSeconds, source: 'artifact-exp-a-critique-5min (300 s canonical target)' },
          product: { value: productCritique.durationSeconds, source: 'ESTATE-LAB-02 (Critique sidecar 1019.89 s)' },
          confidence: 'high',
          note: 'duration-class gap (dialogic modes): product Critique ~17 min vs lab canonical 5 min.',
        }),
        qualitativeMetric({
          metric: 'mode.critique.stance',
          lab: {
            text: 'critique mode semantics: two hosts in an evaluative review stance over the source (EXP-A-02 axis, canonical plan fixture)',
            source: 'fixtures/contracts/plan-audio-critique-5min.json + src/audio mode semantics',
          },
          product: {
            text: observationOf(estateLab02, 'evaluative review stance').text,
            source: 'docs/experiments/records/LAB-02.yaml',
          },
          verdict: 'VERIFIED',
          confidence: 'medium',
        }),
        equalityMetric({
          metric: 'mode.debate.voiceCount',
          lab: { value: debate.speakers.length, source: 'artifact-exp-a-debate-5min (Host A + Host B)' },
          product: { value: productDebate.voices ?? 0, source: 'ESTATE-LAB-02 (Debate sidecar voices: 2)' },
          confidence: 'high',
        }),
        ratioBandMetric({
          metric: 'mode.debate.duration.seconds',
          unit: 's',
          lab: { value: debate.totalTurnSeconds, source: 'artifact-exp-a-debate-5min (300 s canonical target)' },
          product: { value: productDebate.durationSeconds, source: 'ESTATE-LAB-02 (Debate sidecar 1049.89 s)' },
          confidence: 'high',
          note: 'duration-class gap (dialogic modes): product Debate ~17.5 min vs lab canonical 5 min.',
        }),
        qualitativeMetric({
          metric: 'mode.debate.stance',
          lab: {
            text: 'debate mode semantics: adversarial positions with rebuttal moves (EXP-A-03 axis, canonical plan fixture)',
            source: 'fixtures/contracts/plan-audio-debate-5min.json + src/audio mode semantics',
          },
          product: {
            text: observationOf(estateLab02, 'adversarial positions').text,
            source: 'docs/experiments/records/LAB-02.yaml',
          },
          verdict: 'VERIFIED',
          confidence: 'medium',
        }),
        qualitativeMetric({
          metric: 'mode.durationBandStructure',
          lab: {
            text: `lab band ordering: brief ${brief.totalTurnSeconds} s << critique ${critique.totalTurnSeconds} s ~ debate ${debate.totalTurnSeconds} s (canonical targets)`,
            source: 'artifacts/audio/exp-a-r2/{brief-2min-canonical,critique-5min-canonical,debate-5min-canonical}',
          },
          product: {
            text: observationOf(estateLab02, 'duration band').text,
            source: 'docs/experiments/records/LAB-02.yaml',
          },
          verdict: 'VERIFIED',
          confidence: 'medium',
          note: 'the three-band ORDERING matches (brief << critique ~ debate); the magnitudes diverge per the per-mode duration metrics above (recorded honestly, not normalized).',
        }),
      ],
      productObservations: [
        productObservation(observationOf(estateLab02, 'restructure, not re-skin')),
      ],
      labObservations: [
        labObservation(
          `lab compiles: brief ${brief.turnCount} turns/${brief.speakers.length} voice/${brief.totalTurnSeconds} s; critique ${critique.turnCount} turns/${critique.speakers.length} voices/${critique.totalTurnSeconds} s; debate ${debate.turnCount} turns/${debate.speakers.length} voices/${debate.totalTurnSeconds} s`,
          'experiments/run-comparison-audio.ts (this suite) reproducing artifacts/audio/exp-a-r2/',
        ),
      ],
      unresolvedBehavior: [
        'over-structuring distinction (LAB-02 differences): the lab brief is a fixed 10-turn skeleton family / 6-turn canonical fixture; the real Brief is a single continuous narration (~1.5 min) with enumeration markers',
        'dialogic-mode duration class: product ~17 min vs lab canonical 5 min (parity gap recorded)',
      ],
      tlHooks: [],
      evidencePaths: [
        'docs/experiments/records/LAB-02.yaml',
        'artifacts/reference/lab-02/artifact.json',
        'artifacts/audio/exp-a-r2/brief-2min-canonical/',
        'artifacts/audio/exp-a-r2/critique-5min-canonical/',
        'artifacts/audio/exp-a-r2/debate-5min-canonical/',
        'docs/experiments/comparisons/estate/ESTATE-LAB-02.yaml',
      ],
    }),
  );

  // ---- AUDIO-PARITY-03: length control (LAB-03) ---------------------------
  records.push(
    buildDimensionRecord(estate, {
      id: 'AUDIO-PARITY-03',
      surface: 'audio',
      dimension: 'audio.length-control',
      estateRecordId: 'ESTATE-LAB-03',
      labArtifactId: short180.artifactId,
      confidence: 'medium',
      metrics: [
        ratioBandMetric({
          metric: 'lengthControl.compressionRatio',
          lab: { value: Math.round(labCompression * 10000) / 10000, source: 'lab 180 s arm / 300 s baseline (EXP-A-05 axis)' },
          product: { value: Math.round(productCompression * 10000) / 10000, source: 'LAB-03 Short 318.21 s / LAB-01 Default 1201.82 s (estate sidecars)' },
          confidence: 'high',
          note: 'compression magnitudes differ: the product Short control compresses 3.78x; the lab duration knob compresses 1.67x on the canonical pair.',
        }),
        qualitativeMetric({
          metric: 'lengthControl.coverageBehavior',
          lab: {
            text: `salience-omission: covered claims ${baseline.coveredClaims} -> ${short180.coveredClaims} at 180 s (${short180.omittedClaims} omitted by salience, omitted-with-reason — never silently dropped)`,
            source: 'artifacts/audio/exp-a-r2/deepdive-3min-duration (plan.coverage)',
          },
          product: {
            text: observationOf(estateLab03, 'depth reduction, not structure removal').text,
            source: 'docs/experiments/records/LAB-03.yaml',
          },
          verdict: 'DIVERGENT',
          confidence: 'medium',
          note: 'compression philosophy differs: lab drops claims by salience while raising rate; the product preserves topic coverage and shrinks per-topic depth (the LAB-03 differences note — recorded, not normalized).',
        }),
        equalityMetric({
          metric: 'lengthControl.speakerCountPreserved',
          lab: { value: short180.speakers.length === baseline.speakers.length, source: 'two hosts at both 300 s and 180 s (lab compiles)' },
          product: { value: lab03.hosts === lab01.hosts, source: 'ESTATE-LAB-03 vs ESTATE-LAB-01 (hosts: 2 both)' },
          confidence: 'high',
        }),
        qualitativeMetric({
          metric: 'lengthControl.macroSkeletonPreserved',
          lab: {
            text: `same plan shape at 180 s: ${short180.beatCount} beats (frame -> sections -> synthesize), same beat titles as the 300 s baseline`,
            source: 'artifacts/audio/exp-a-r2/deepdive-3min-duration (plan.beats)',
          },
          product: {
            text: observationOf(estateLab03, 'the Short episode keeps').text,
            source: 'docs/experiments/records/LAB-03.yaml',
          },
          verdict: 'VERIFIED',
          confidence: 'medium',
        }),
        qualitativeMetric({
          metric: 'lengthControl.speakingRateResponse',
          lab: {
            text: `lab wps ${baseline.wordsPerSecondMean} (300 s) -> ${short180.wordsPerSecondMean} (180 s) = ${labWpsChange >= 0 ? '+' : ''}${labWpsChange.toFixed(1)}% under compression`,
            source: 'artifacts/audio/exp-a-r2/{deepdive-5min-baseline,deepdive-3min-duration} (timing + realized words)',
          },
          product: {
            text: 'conversational pace preserved (qualitative ASR observation; per-topic depth shrinks instead)',
            source: 'docs/experiments/records/LAB-03.yaml',
          },
          verdict: Math.abs(labWpsChange) <= 10 ? 'VERIFIED' : 'DIVERGENT',
          confidence: 'low',
          note: 'declared rule: |lab wps change| <= 10% reads as pace-preserved. The product side is not numerically measurable black-box (qualitative observation recorded; measurement-class note).',
        }),
      ],
      productObservations: [
        productObservation(observationOf(estateLab03, 'duration control is real')),
      ],
      labObservations: [
        labObservation(
          `lab compiles: 300 s baseline ${baseline.turnCount} turns coverage ${baseline.coveredClaims}/11; 180 s arm ${short180.turnCount} turns coverage ${short180.coveredClaims}/11 (wps ${baseline.wordsPerSecondMean} -> ${short180.wordsPerSecondMean})`,
          'experiments/run-comparison-audio.ts (this suite) reproducing artifacts/audio/exp-a-r2/',
        ),
      ],
      unresolvedBehavior: [
        'product claim-level coverage under compression is not measurable black-box (LAB-03: coverage observable only qualitatively from ASR sampling)',
      ],
      tlHooks: [],
      evidencePaths: [
        'docs/experiments/records/LAB-03.yaml',
        'artifacts/reference/lab-03/artifact.json',
        'artifacts/audio/exp-a-r2/deepdive-3min-duration/',
        'artifacts/audio/exp-a-r2/deepdive-5min-baseline/',
        'docs/experiments/comparisons/estate/ESTATE-LAB-03.yaml',
      ],
    }),
  );

  // ---- AUDIO-PARITY-04: language (LAB-04) ---------------------------------
  const structureInvariant =
    es.turnCount === baseline.turnCount &&
    es.speakers.length === baseline.speakers.length &&
    es.coveredClaims === baseline.coveredClaims;
  records.push(
    buildDimensionRecord(estate, {
      id: 'AUDIO-PARITY-04',
      surface: 'audio',
      dimension: 'audio.language',
      estateRecordId: 'ESTATE-LAB-04',
      labArtifactId: es.artifactId,
      confidence: 'medium',
      metrics: [
        equalityMetric({
          metric: 'language.planStructureInvariance',
          lab: { value: structureInvariant, source: `es arm: ${es.turnCount} turns / ${es.speakers.length} speakers / coverage ${es.coveredClaims} — identical to the en baseline (plan structure)` },
          product: { value: true, source: 'ESTATE-LAB-04 (invariants: discourse skeleton preserved across the language switch)' },
          confidence: 'high',
        }),
        qualitativeMetric({
          metric: 'language.surfaceRegeneration',
          lab: {
            text: 'lab ES arm: plan structure invariant, realized anchor texts surface in ENGLISH (placeholder realizer anchors are not localized — the ML1 boundary recorded by EXP-L-02/EV-017)',
            source: 'artifacts/audio/exp-a-r2/deepdive-5min-es + docs/experiments/records/EXP-A-06.yaml',
          },
          product: {
            text: observationOf(estateLab04, 'natively Spanish').text,
            source: 'docs/experiments/records/LAB-04.yaml',
          },
          verdict: 'DIVERGENT',
          confidence: 'high',
          note: 'the product regenerates the full episode natively in the target language; the lab placeholder surface stays EN — the structure-invariant/surface-specific split matches, the surface regeneration does not (honest boundary).',
        }),
        percentPointMetric({
          metric: 'language.durationShiftPercent',
          lab: { value: 0, source: 'lab placeholder synthesis pins realized duration to the 300 s target in BOTH languages (0% shift by construction)' },
          product: { value: Math.round(productEsShift * 10) / 10, source: 'LAB-04 1034.84 s vs LAB-01 1201.82 s = -13.9% at the same Default length setting' },
          confidence: 'medium',
          note: 'measurement-class note: the lab 0% is a construction artifact of placeholder timing (not a claimed parity); the product varies by language with real speech.',
        }),
      ],
      productObservations: [
        productObservation(observationOf(estateLab04, 'structure invariance')),
      ],
      labObservations: [
        labObservation(
          `lab es arm: ${es.turnCount} turns, ${es.speakers.length} speakers, coverage ${es.coveredClaims}/11, ${es.totalTurnSeconds} s — structure byte-equal to the en baseline plan at the plan layer`,
          'experiments/run-comparison-audio.ts (this suite) reproducing artifacts/audio/exp-a-r2/deepdive-5min-es',
        ),
      ],
      unresolvedBehavior: [
        'lab anchor localization gap (ML1): placeholder anchors surface EN under es — recorded boundary, not parity',
      ],
      tlHooks: [],
      evidencePaths: [
        'docs/experiments/records/LAB-04.yaml',
        'artifacts/reference/lab-04/artifact.json',
        'artifacts/audio/exp-a-r2/deepdive-5min-es/',
        'docs/experiments/comparisons/estate/ESTATE-LAB-04.yaml',
      ],
    }),
  );

  // ---- AUDIO-PARITY-05: mutation locality (LAB-05) ------------------------
  records.push(
    buildDimensionRecord(estate, {
      id: 'AUDIO-PARITY-05',
      surface: 'audio',
      dimension: 'audio.mutation-locality',
      estateRecordId: 'ESTATE-LAB-05',
      labArtifactId: a04Control.artifactId,
      confidence: 'medium',
      metrics: [
        equalityMetric({
          metric: 'mutation.mutatedContentVoiced',
          lab: { value: mutatedContentVoiced, source: `b30 mutation content ("rotated quarterly") present in the mutated arm's realized texts: ${mutatedContentVoiced}` },
          product: { value: true, source: 'ESTATE-LAB-05 (OBSERVED: the closing segment references "Quarterly rotated platform credentials" verbatim)' },
          confidence: 'high',
        }),
        qualitativeMetric({
          metric: 'mutation.macroStructurePreserved',
          lab: {
            text: `macro plan preserved: ${a04Control.turnCount} -> ${a04Mut.turnCount} turns, ${a04Control.beatCount} -> ${a04Mut.beatCount} beats, same beat titles`,
            source: 'artifacts/audio/exp-a-r2/{a04-control,a04-mut-b30}-deepdive-5min (plans)',
          },
          product: {
            text: observationOf(estateLab05, 'macro-structure preserved').text,
            source: 'docs/experiments/records/LAB-05.yaml',
          },
          verdict: 'VERIFIED',
          confidence: 'medium',
        }),
        qualitativeMetric({
          metric: 'mutation.localityClass',
          lab: {
            text: `C-5 turn-local diff hygiene: ${mutationLocality.textIdenticalTurns}/${mutationLocality.textIdenticalTurns + mutationLocality.textChangedTurns} realized texts byte-identical across the b30 mutation (seeded surfaces key on turn content hashes — unchanged turns keep their texts)`,
            source: 'artifacts/audio/exp-a-r2/{a04-control,a04-mut-b30}-deepdive-5min (realized texts, this suite)',
          },
          product: {
            text: observationOf(estateLab05, 'GLOBAL response').text,
            source: 'docs/experiments/records/LAB-05.yaml',
          },
          verdict: 'DIVERGENT',
          confidence: 'high',
          note: 'architecture-rule distinction (recorded, not a defect claim): the lab C-5 diff hygiene keeps unchanged turns stable; the product re-plans globally. LAB-06 further resolves that the product mutation delta sits WITHIN its baseline run-to-run variance (locality not separately observable).',
        }),
        percentPointMetric({
          metric: 'mutation.durationResponsePercent',
          lab: { value: 0, source: 'lab placeholder synthesis pins duration to the 300 s target in both arms (0% response by construction)' },
          product: { value: Math.round(productMutShift * 10) / 10, source: 'LAB-05 1432.25 s vs LAB-01 1201.82 s = +19.0%' },
          confidence: 'medium',
          note: 'measurement-class note: the lab 0% is a construction artifact of placeholder timing; the product responds to the source edit with a full re-plan at a different duration.',
        }),
      ],
      productObservations: [
        productObservation(observationOf(estateLab05, 'semantic propagation')),
      ],
      labObservations: [
        labObservation(
          `lab b30 arms: control ${a04Control.turnCount} turns / mut ${a04Mut.turnCount} turns; realized-text diff ${mutationLocality.textIdenticalTurns} identical / ${mutationLocality.textChangedTurns} changed; mutated content voiced: ${mutatedContentVoiced}`,
          'experiments/run-comparison-audio.ts (this suite) reproducing artifacts/audio/exp-a-r2/a04-*',
        ),
      ],
      unresolvedBehavior: [
        'the product mutation locality is not separately observable above its run-to-run stochasticity (LAB-06 falsifier RESOLVED — recorded in LAB-05/LAB-06)',
      ],
      tlHooks: [],
      evidencePaths: [
        'docs/experiments/records/LAB-05.yaml',
        'artifacts/reference/lab-05/artifact.json',
        'artifacts/audio/exp-a-r2/a04-control-deepdive-5min/',
        'artifacts/audio/exp-a-r2/a04-mut-b30-deepdive-5min/',
        'docs/experiments/comparisons/estate/ESTATE-LAB-05.yaml',
      ],
    }),
  );

  // ---- AUDIO-PARITY-06: twin stochasticity (LAB-06) -----------------------
  records.push(
    buildDimensionRecord(estate, {
      id: 'AUDIO-PARITY-06',
      surface: 'audio',
      dimension: 'audio.twin-stochasticity',
      estateRecordId: 'ESTATE-LAB-06',
      labArtifactId: baseline.artifactId,
      confidence: 'high',
      metrics: [
        equalityMetric({
          metric: 'stochasticity.runToRunByteIdentity',
          lab: { value: true, source: `double-compile of the identical plan: media sha256 ${determinism.recompiledMediaSha256.slice(0, 16)}… byte-identical (this suite's determinism spot-check)` },
          product: { value: false, source: 'ESTATE-LAB-06 (identical source + settings + fresh notebook produced a different title, +10.2% duration, different bytes)' },
          confidence: 'high',
          note: 'lab determinism is a CONTROL choice (fixed seeds -> identical artifacts), not a product-fidelity property — the LAB-06 differences note; the real product re-samples its full pipeline per run.',
        }),
        qualitativeMetric({
          metric: 'stochasticity.macroPatternStability',
          lab: {
            text: 'identical macro plan on every run (deterministic compile — the skeleton is fixed by construction)',
            source: 'this suite (determinism spot-check) + artifacts/audio/exp-a-r2',
          },
          product: {
            text: observationOf(estateLab06, 'macro-pattern stability').text,
            source: 'docs/experiments/records/LAB-06.yaml',
          },
          verdict: 'VERIFIED',
          confidence: 'medium',
          note: 'both sides keep the macro skeleton stable across runs; the product achieves it through discourse-template priors under full re-sampling.',
        }),
        qualitativeMetric({
          metric: 'stochasticity.surfaceVariance',
          lab: {
            text: 'byte-identical surface: title/duration/text all fixed by the seed (deterministic compile)',
            source: 'this suite (determinism spot-check)',
          },
          product: {
            text: observationOf(estateLab06, 'hook variance across three runs').text,
            source: 'docs/experiments/records/LAB-06.yaml',
          },
          verdict: 'DIVERGENT',
          confidence: 'high',
        }),
      ],
      productObservations: [
        productObservation(observationOf(estateLab06, 'run-to-run stochasticity')),
      ],
      labObservations: [
        labObservation(
          `lab determinism proof: recompiled baseline media sha256 ${determinism.recompiledMediaSha256} — byte-identical to the first compile (determinism spot-check, this suite)`,
          'experiments/run-comparison-audio.ts (this suite)',
        ),
      ],
      unresolvedBehavior: [
        'product stochasticity is sampled at n=2 (LAB-01 vs LAB-06) for the audio surface — more twin runs would strengthen the reading (LAB-06 falsifier note)',
      ],
      tlHooks: [],
      evidencePaths: [
        'docs/experiments/records/LAB-06.yaml',
        'artifacts/reference/lab-06/artifact.json',
        'artifacts/audio/exp-a-r2/deepdive-5min-baseline/',
        'docs/experiments/comparisons/estate/ESTATE-LAB-06.yaml',
      ],
    }),
  );

  // ---- AUDIO-PARITY-07: custom steering prompt (LAB-10) — PENDING ---------
  records.push(
    pendingRecord(
      'AUDIO-PARITY-07',
      'audio.custom-prompt',
      [
        {
          metric: 'customPrompt.steeringEffect',
          unit: null,
          measurement_class: 'like-for-like',
          lab: {
            value: 'no audio custom-steering surface in the lab default compile (the steering axis is the plan-level focus/style layer; audio custom-prompt arm is not compiled pending the product capture)',
            source: 'src/audio (compile surface) — no custom-prompt arm in the EXP-A series',
            note: null,
          },
          product: { value: null, source: null, note: null },
          delta: null,
          verdict: 'PENDING',
          pending_reason: 'COMPARISON PENDING REFERENCE CAPTURE',
          confidence: 'low',
          note: 'LAB-10 (audio custom steering prompt) is SCHEDULED on the product side — the 2026-10-01 scheduling-lane behavior change banked below.',
        },
        {
          metric: 'customPrompt.durationResponse',
          unit: 's',
          measurement_class: 'like-for-like',
          lab: { value: null, source: null, note: null },
          product: { value: null, source: null, note: null },
          delta: null,
          verdict: 'PENDING',
          pending_reason: 'COMPARISON PENDING REFERENCE CAPTURE',
          confidence: 'low',
          note: null,
        },
        {
          metric: 'customPrompt.structurePreservation',
          unit: null,
          measurement_class: 'qualitative',
          lab: { value: null, source: null, note: null },
          product: { value: null, source: null, note: null },
          delta: null,
          verdict: 'PENDING',
          pending_reason: 'COMPARISON PENDING REFERENCE CAPTURE',
          confidence: 'low',
          note: null,
        },
      ],
      [
        {
          label: 'OBSERVED',
          text: 'AUDIO-LANE BEHAVIOR CHANGE (banked product truth, 2026-10-01): the Customize Audio Overview dialog now states "This content will generate in a few hours. Or, upgrade to get it sooner." — both LAB-10 runs (an accidental empty-focus era-control + the VERIFIED custom-focus arm, 138 chars read back before Generate) are "Scheduled for after 11pm". The audio lane moved from immediate ~7-10 min generation (Sept 28 LAB-01..06 era) to scheduled queuing (Oct 1).',
          source: 'docs/work-items/roadmap-status.md (TL #2 station record, 2026-10-01 19:40 UTC)',
        },
        {
          label: 'OBSERVED',
          text: 'comparisons in this program are against the CAPTURED artifacts, never against live re-runs — the scheduling-lane change does not invalidate the LAB-01..06 captures.',
          source: 'docs/work-items/roadmap-status.md (TL #2 station record)',
        },
      ],
      [
        'TL: land LAB-10 (audio custom-steering-prompt capture) when the platform executes the scheduled runs — docs/experiments/records/LAB-10.yaml + artifacts/reference/lab-10/artifact.json per the LAB-series pattern; then extend tools/comparison/ingest.ts LAB_IDS and re-run exp:cmpaudio to fill this record',
      ],
      [
        'docs/work-items/roadmap-status.md',
        'docs/experiments/records/LAB-09.yaml (next_experiment: LAB-10 closes the audio custom-prompt matrix)',
        'docs/experiments/comparisons/estate/',
      ],
      [
        'audio custom steering prompt (LAB-10): product capture SCHEDULED, not yet landed',
        'the scheduling-lane behavior change (2026-10-01) is banked truth; the custom-prompt comparison itself remains open',
      ],
    ),
  );

  // ---- AUDIO-PARITY-08: Interactive Audio — PENDING ------------------------
  records.push(
    pendingRecord(
      'AUDIO-PARITY-08',
      'audio.interactive',
      [
        {
          metric: 'interactive.interventionSourceGrounding',
          unit: null,
          measurement_class: 'qualitative',
          lab: {
            value: 'REPRODUCED (EV-018): listener intervention at a turn boundary -> deterministic claim retrieval over the same semantic graph -> source-grounded response (W1 deep validation + W2 dialogue-graph grounding, zero issues; claims resolve; anchors voiced)',
            source: 'docs/experiments/records/EXP-L-03.yaml + artifacts/audio/interactive-01/',
            note: null,
          },
          product: { value: null, source: null, note: null },
          delta: null,
          verdict: 'PENDING',
          pending_reason: 'COMPARISON PENDING REFERENCE CAPTURE',
          confidence: 'low',
          note: 'Interactive Audio product capture is operator-gated (the listener verbally joins the hosts); no product-side capture exists yet.',
        },
        {
          metric: 'interactive.resumeOriginalOverview',
          unit: null,
          measurement_class: 'qualitative',
          lab: {
            value: 'REPRODUCED (EV-018): the ORIGINAL overview resumes with its original turns intact — every original turn WAV byte-identical across the boundary; startMs shifts by exactly the inserted response total (21171 ms session-01 / 12314 ms session-02), 0 pre-boundary',
            source: 'docs/experiments/records/EXP-L-03.yaml + artifacts/audio/interactive-01/',
            note: null,
          },
          product: { value: null, source: null, note: null },
          delta: null,
          verdict: 'PENDING',
          pending_reason: 'COMPARISON PENDING REFERENCE CAPTURE',
          confidence: 'low',
          note: null,
        },
        {
          metric: 'interactive.formatInvariants',
          unit: null,
          measurement_class: 'qualitative',
          lab: {
            value: 'REPRODUCED (EV-018): "Interactive mode" chip OBSERVED in the product player UI (LAB-01 other_config); lab prototype keeps codec/geometry invariants across the session boundary',
            source: 'docs/experiments/records/EXP-L-03.yaml + docs/experiments/records/LAB-01.yaml (player_ui)',
            note: null,
          },
          product: { value: null, source: null, note: null },
          delta: null,
          verdict: 'PENDING',
          pending_reason: 'COMPARISON PENDING REFERENCE CAPTURE',
          confidence: 'low',
          note: 'product-side: the Interactive mode chip is OBSERVED in the player UI; the full intervention->response->resume journey has no committed product capture.',
        },
      ],
      [
        {
          label: 'OBSERVED',
          text: 'the product player UI exposes an "Interactive mode" chip (recorded in the LAB-01 capture other_config)',
          source: 'docs/experiments/records/LAB-01.yaml',
        },
        {
          label: 'REPRODUCED',
          text: 'the lab Interactive Audio prototype (P1 Deliverable C / EV-018) reconstructs the observable behavior as an additive session layer with per-turn C-5 locality — lab reproduction only, NOT product parity evidence',
          source: 'docs/experiments/records/EXP-L-03.yaml',
        },
      ],
      [
        'TL: Interactive Audio real-product capture (listener verbally joins the hosts, receives a source-grounded response, original overview resumes) is operator-gated through the replay browser — land it per the LAB-series pattern, then re-run exp:cmpaudio to fill this record',
      ],
      [
        'docs/experiments/records/EXP-L-03.yaml',
        'artifacts/audio/interactive-01/',
        'docs/audio/interactive-audio-architecture.md',
        'docs/experiments/records/LAB-01.yaml',
      ],
      [
        'Interactive Audio product capture: none exists (operator-gated); the product player chip is the only product-side observable so far',
        'listener voice capture UNRESOLVED (EXP-L-03 uses text-scripted stand-ins; no speech-to-intent claimed)',
      ],
    ),
  );

  return { records, arms, determinism, mutationLocality };
}
