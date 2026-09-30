/**
 * Seeded experiment configs — WFLX-P3B wave 2 integration experiment series
 * (Phase 3 checklist §2 items 4/5/6; docs/experiments/matrix.md entries).
 *
 * Three series, all executed by tools/experiments/runner.ts
 * (`bun run exp:integration`):
 *
 *   EXP-A-01..06-R2  re-runs of the audio ablation matrix through the
 *                    integration runner under the FIXED Director (EV-008
 *                    anchor-mass-aware turn budgets) on merged main. The
 *                    EV-006 artifacts reflect PRE-P3A-fix behavior; these
 *                    R2 records re-baseline the same arm set (same fixtures,
 *                    seeds and mutations) post-fix.
 *   EXP-V-01..08     first landings of the video-surface ablation matrix on
 *                    the merged W3 surface. Runs at the storyboard layer
 *                    (scene SVG set = the pinned determinism layer) except
 *                    where noted; entries needing real providers or the real
 *                    product are OUT of scope and recorded as such.
 *   EXP-D-01         same-source dual-modality comparison (checklist §2
 *                    item 5): ONE fixture source + ONE seed rendered through
 *                    BOTH full pipelines; deterministic QA metrics only.
 *
 * The EXP-A R2 arms mirror experiments/run-exp-a.ts exactly (same fixture
 * files, same Director/audio seeds, same b30 mutation, same arm set) so the
 * only deltas vs the EV-006 series are (a) the Director fix and (b) the R2
 * series stamp — the one meaningful variable is the code change.
 *
 * Authored protocol fields (hypothesis/falsifier/confidence/...) live HERE,
 * as reviewable config; every computed field is produced by the runner.
 * Nothing in this file reads a clock or the environment.
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  B30_MUTATED,
  B30_ORIGINAL,
  EXP_A_AUDIO_SEED,
  EXP_A_DIRECTOR_SEED,
  EXP_D_SEED,
  EXP_NOW,
  EXP_OPERATOR,
  EXP_RECORD_TIMESTAMP,
  EXP_V_03_PROMPT,
  EXP_V_DIRECTOR_SEED,
  EXP_V_DIRECTOR_SEED_B,
  EXP_V_VIDEO_SEED,
  EXP_V_VIDEO_SEED_B,
  FIXTURE_PLAN_BRIEF,
  FIXTURE_PLAN_CRITIQUE,
  FIXTURE_PLAN_DEBATE,
  FIXTURE_PLAN_VIDEO_7MIN,
  FIXTURE_RAW_NOTE_FILE,
  FIXTURE_SOURCE_FILE,
  SOURCE_SPLIT_MARKER,
  type ExperimentConfig,
} from './runner-types';
import { REFERENCE_INK_STYLE_BIBLE, parseStyleBible, type StyleBible } from '../../src/video/style-bible';
import type { AudienceLevel, SemanticGraph, SourceArtifact } from '../../src/contracts';

// ---------------------------------------------------------------------------
// Fixture identities (read once, deterministically)
// ---------------------------------------------------------------------------

export const CANONICAL_SOURCE: SourceArtifact = JSON.parse(
  readFileSync(FIXTURE_SOURCE_FILE, 'utf8'),
) as SourceArtifact;

export const CANONICAL_GRAPH: SemanticGraph = JSON.parse(
  readFileSync('fixtures/contracts/reference-messy-note.semantic-graph.json', 'utf8'),
) as SemanticGraph;

export const RAW_NOTE: string = readFileSync(FIXTURE_RAW_NOTE_FILE, 'utf8');

/** Protocol source fingerprint: sha256 of the raw fixture note (EV-006 convention). */
export const SOURCE_FINGERPRINT: string = createHash('sha256').update(RAW_NOTE, 'utf8').digest('hex');

const REFERENCE_NOTEBOOK =
  'reference-messy-note (lab fixture stand-in; product-side comparison pending reference access)';

const RUNNER_PATH = 'tools/experiments/runner.ts';

// ---------------------------------------------------------------------------
// EXP-V-02 style-bible variant: ONE palette role mutated (one variable)
// ---------------------------------------------------------------------------

const VARIANT_INK = '#ffd9a0';

/** One-variable style mutation: the ink role's value (light typography color). */
export const VARIANT_STYLE_BIBLE: StyleBible = parseStyleBible({
  ...(JSON.parse(JSON.stringify(REFERENCE_INK_STYLE_BIBLE)) as Record<string, unknown>),
  palette: {
    ...(JSON.parse(JSON.stringify(REFERENCE_INK_STYLE_BIBLE.palette)) as Record<string, unknown>),
    ink: {
      value: VARIANT_INK,
      evidence:
        'LAB MUTATION (EXP-V-02): ink role value mutated from #f2f4f5 to #ffd9a0 for the ' +
        'one-variable style ablation; every other StyleBible field is byte-identical to ' +
        "style-bible--reference-ink (validated through StyleBibleSchema).",
    },
  },
});

// ---------------------------------------------------------------------------
// Shared request bases
// ---------------------------------------------------------------------------

const AUDIO_R2_BASE = {
  modality: 'audio' as const,
  audience: 'technical' as AudienceLevel,
  language: 'en',
  targetDurationSeconds: 300,
  seed: EXP_A_DIRECTOR_SEED,
  now: EXP_NOW,
};

const VIDEO_V_BASE = {
  modality: 'video' as const,
  audience: 'technical' as AudienceLevel,
  language: 'en',
  targetDurationSeconds: 120,
  seed: EXP_V_DIRECTOR_SEED,
  now: EXP_NOW,
};

const B30_MUTATION = { original: B30_ORIGINAL, mutated: B30_MUTATED } as const;

const note = (text: string): readonly string[] => [text];

// ---------------------------------------------------------------------------
// EXP-A R2 series (audio re-runs under the FIXED Director)
// ---------------------------------------------------------------------------

const expAR2 = (): readonly ExperimentConfig[] => [
  {
    id: 'EXP-A-01-R2',
    matrixEntry: 'EXP-A-01',
    series: 'exp-a-r2',
    surface: 'audio',
    reference_notebook: REFERENCE_NOTEBOOK,
    source_fingerprint: SOURCE_FINGERPRINT,
    selected_sources: ['source-messy-note-redacted'],
    format: 'deep-dive (baseline) vs brief',
    language: 'en',
    length: '300 s baseline/de-confounder; canonical brief carries 120 s',
    visual_style: '',
    custom_prompt: '',
    mutation: 'output mode: deep-dive -> brief (canonical plan) + brief-at-300 s de-confounder',
    otherConfig: {
      runner: RUNNER_PATH,
      series_root: 'artifacts/audio/exp-a-r2',
      director_seed: EXP_A_DIRECTOR_SEED,
      audio_seed: EXP_A_AUDIO_SEED,
      fixed_now: EXP_NOW,
      mastering: 'pure-ts',
      mirrors: 'experiments/run-exp-a.ts arm set (EV-006) under the EV-008 fixed Director',
      seeds_mirror_ev006: true,
    },
    arms: [
      {
        kind: 'audio-director',
        runId: 'deepdive-5min-baseline',
        experiment: 'exp-a-01/02/03-baseline',
        artifactId: 'artifact-exp-a-r2-deepdive-5min-baseline',
        planId: 'plan-exp-a-r2-audio-deepdive-5min',
        request: { ...AUDIO_R2_BASE },
      },
      {
        kind: 'audio-canonical-plan',
        runId: 'brief-2min-canonical',
        experiment: 'exp-a-01',
        artifactId: 'artifact-exp-a-r2-brief-2min',
        planFile: FIXTURE_PLAN_BRIEF,
      },
      {
        kind: 'audio-director',
        runId: 'brief-5min-deconfound',
        experiment: 'exp-a-01-deconfound',
        artifactId: 'artifact-exp-a-r2-brief-5min-deconfound',
        planId: 'plan-exp-a-r2-audio-brief-5min',
        request: { ...AUDIO_R2_BASE, mode: 'brief' },
      },
    ],
    authored: {
      hypothesis:
        'Audio mode is a structure+duration bundle: brief canonically carries 120 s, so the canonical ' +
        'brief arm changes turn skeleton AND budget; at fixed 300 s (de-confounder) brief thins the ' +
        'per-beat turn skeleton while preserving the budget-driven claim coverage. Under the EV-008 ' +
        'fixed Director, every 300 s arm is additionally expected to compile with zero over-budget turns.',
      confidence: 'high',
      falsifier:
        'brief-at-300 s dropping or adding covered claims vs deep-dive-at-300 s (mode would then drive ' +
        'selection, not budget); or any over-budget turn reappearing on a 300 s arm.',
      next_experiment: 'EXP-A-02-R2 (critique framing)',
      status: 'supported',
      invariants: note(
        'Both 300 s arms use identical source/graph/seed/now/audience; only the mode differs. The ' +
          'canonical brief fixture is a W1 input regenerated ONCE at the C-10 v2-wave boundary ' +
          '(2026-09-30: monologic narrator skeleton per EV-009 LAB-02; fingerprint addendum in ' +
          'tests/contracts/fixtures.test.ts) — otherwise frozen across this series.',
      ),
      observations: note(
        'R2 context (REPRODUCED): this re-run lands through the wave-2 integration runner under the ' +
          'EV-008 fixed Director on merged main; the EV-006 EXP-A-01 numbers reflect PRE-P3A-fix behavior ' +
          '(re-baseline addenda in docs/experiments/records/EXP-A-01.yaml).',
      ),
    },
  },
  {
    id: 'EXP-A-02-R2',
    matrixEntry: 'EXP-A-02',
    series: 'exp-a-r2',
    surface: 'audio',
    reference_notebook: REFERENCE_NOTEBOOK,
    source_fingerprint: SOURCE_FINGERPRINT,
    selected_sources: ['source-messy-note-redacted'],
    format: 'deep-dive (baseline) vs critique',
    language: 'en',
    length: '300 s both arms',
    visual_style: '',
    custom_prompt: '',
    mutation: 'output mode: deep-dive -> critique (canonical plan)',
    otherConfig: {
      runner: RUNNER_PATH,
      series_root: 'artifacts/audio/exp-a-r2',
      director_seed: EXP_A_DIRECTOR_SEED,
      audio_seed: EXP_A_AUDIO_SEED,
      fixed_now: EXP_NOW,
      mastering: 'pure-ts',
      mirrors: 'experiments/run-exp-a.ts arm set (EV-006) under the EV-008 fixed Director',
    },
    arms: [
      {
        kind: 'audio-director',
        runId: 'deepdive-5min-baseline',
        experiment: 'exp-a-01/02/03-baseline',
        artifactId: 'artifact-exp-a-r2-deepdive-5min-baseline',
        planId: 'plan-exp-a-r2-audio-deepdive-5min',
        request: { ...AUDIO_R2_BASE },
      },
      {
        kind: 'audio-canonical-plan',
        runId: 'critique-5min-canonical',
        experiment: 'exp-a-02',
        artifactId: 'artifact-exp-a-r2-critique-5min',
        planFile: FIXTURE_PLAN_CRITIQUE,
      },
    ],
    authored: {
      hypothesis:
        'Critique is a structurally distinct mode: it swaps per-beat carrier purposes toward ' +
        'question/clarification (interrogative tissue) while keeping budget-driven coverage and, ' +
        'post-fix, zero over-budget turns (the pre-fix critique arm was one of the 4-over-budget arms).',
      confidence: 'high',
      falsifier:
        'critique producing the same purpose histogram as deep-dive (a re-skin, not a structure); or ' +
        'coverage differences vs the deep-dive baseline at the same duration.',
      next_experiment: 'EXP-A-03-R2 (debate framing)',
      status: 'supported',
      invariants: note('Same fixture/seed/now; only the mode (plan fixture) differs.'),
      observations: note(
        'R2 context (REPRODUCED): EV-008 fixed Director re-baseline of the EV-006 experiment.',
      ),
    },
  },
  {
    id: 'EXP-A-03-R2',
    matrixEntry: 'EXP-A-03',
    series: 'exp-a-r2',
    surface: 'audio',
    reference_notebook: REFERENCE_NOTEBOOK,
    source_fingerprint: SOURCE_FINGERPRINT,
    selected_sources: ['source-messy-note-redacted'],
    format: 'deep-dive (baseline) vs debate',
    language: 'en',
    length: '300 s both arms',
    visual_style: '',
    custom_prompt: '',
    mutation: 'output mode: deep-dive -> debate (canonical plan)',
    otherConfig: {
      runner: RUNNER_PATH,
      series_root: 'artifacts/audio/exp-a-r2',
      director_seed: EXP_A_DIRECTOR_SEED,
      audio_seed: EXP_A_AUDIO_SEED,
      fixed_now: EXP_NOW,
      mastering: 'pure-ts',
      mirrors: 'experiments/run-exp-a.ts arm set (EV-006) under the EV-008 fixed Director',
    },
    arms: [
      {
        kind: 'audio-director',
        runId: 'deepdive-5min-baseline',
        experiment: 'exp-a-01/02/03-baseline',
        artifactId: 'artifact-exp-a-r2-deepdive-5min-baseline',
        planId: 'plan-exp-a-r2-audio-deepdive-5min',
        request: { ...AUDIO_R2_BASE },
      },
      {
        kind: 'audio-canonical-plan',
        runId: 'debate-5min-canonical',
        experiment: 'exp-a-03',
        artifactId: 'artifact-exp-a-r2-debate-5min',
        planFile: FIXTURE_PLAN_DEBATE,
      },
    ],
    authored: {
      hypothesis:
        'Debate creates a real argument graph: hosts trade question/explanation slots with ' +
        'contrast-driven stance markers, distinct from both deep-dive and critique histograms, at ' +
        'identical budget-driven coverage.',
      confidence: 'high',
      falsifier:
        'debate collapsing to the deep-dive or critique purpose histogram (no argument structure); ' +
        'or coverage drift at fixed duration.',
      next_experiment: 'EXP-A-04-R2 (mutation locality)',
      status: 'supported',
      invariants: note('Same fixture/seed/now; only the mode (plan fixture) differs.'),
      observations: note(
        'R2 context (REPRODUCED): EV-008 fixed Director re-baseline of the EV-006 experiment.',
      ),
    },
  },
  {
    id: 'EXP-A-04-R2',
    matrixEntry: 'EXP-A-04',
    series: 'exp-a-r2',
    surface: 'audio',
    reference_notebook: REFERENCE_NOTEBOOK,
    source_fingerprint: SOURCE_FINGERPRINT,
    selected_sources: ['source-messy-note-redacted (fresh chain, both arms)'],
    format: 'deep-dive (fixed)',
    language: 'en',
    length: '300 s both arms',
    visual_style: '',
    custom_prompt: '',
    mutation: `one paragraph changed (block b30: "${B30_ORIGINAL}" -> "${B30_MUTATED}")`,
    otherConfig: {
      runner: RUNNER_PATH,
      series_root: 'artifacts/audio/exp-a-r2',
      mutation_block: 'b30',
      mutation_original: B30_ORIGINAL,
      mutation_mutated: B30_MUTATED,
      chain: 'MarkdownNoteAdapter -> DeterministicExtractor -> Director -> compileAudioOverview (BOTH arms; the extractor is not gold-graph-identical, so the canonical fixtures are not the control)',
      director_seed: EXP_A_DIRECTOR_SEED,
      audio_seed: EXP_A_AUDIO_SEED,
      fixed_now: EXP_NOW,
      mastering: 'pure-ts',
      mirrors: 'experiments/run-exp-a.ts EXP-A-04 arm pair (EV-006) under the EV-008 fixed Director',
    },
    arms: [
      {
        kind: 'audio-fresh-chain',
        runId: 'a04-control-deepdive-5min',
        experiment: 'exp-a-04-control',
        artifactId: 'artifact-exp-a-r2-a04-control-deepdive-5min',
        planId: 'plan-exp-a-r2-audio-deepdive-5min',
        request: { ...AUDIO_R2_BASE },
      },
      {
        kind: 'audio-fresh-chain',
        runId: 'a04-mut-b30-deepdive-5min',
        experiment: 'exp-a-04-mutation',
        artifactId: 'artifact-exp-a-r2-a04-mut-b30-deepdive-5min',
        // Same planId as the control arm: the ONLY intended variable is the b30 text.
        planId: 'plan-exp-a-r2-audio-deepdive-5min',
        request: { ...AUDIO_R2_BASE },
        mutation: B30_MUTATION,
      },
    ],
    authored: {
      hypothesis:
        'Source mutation impact is local at the semantic layers (graph: exactly the b30-fed claim; ' +
        'plan: turn structure identical) and global ONLY at the seeded surface layer, because the ' +
        'realizer keys seeded choices by (seed | planHash | turnId | slot) and ANY plan content change ' +
        '(turn briefs citing the mutated claim) changes planHash. The construction — not an editorial ' +
        'property — is the v2 contract problem (C-5 / EXP-X-02).',
      confidence: 'high',
      falsifier:
        'A one-paragraph change that alters turn structure, beat count or coverage (editorial impact ' +
        'NOT local); or unchanged realized text across turns citing the mutated claim (anchors do not ' +
        'propagate).',
      next_experiment: 'EXP-A-05-R2 (duration compression)',
      status: 'supported',
      invariants: note(
        'Both arms run the identical adapter -> extractor -> Director -> audio chain with identical ' +
          'ids/seeds/now/planId; only the b30 paragraph text differs (one variable).',
      ),
      observations: note(
        'R2 context (REPRODUCED): pre-fix baseline (EV-006, PRE-P3A Director) measured 0/25 turns with ' +
          'structure change and 4/25 byte-identical realized texts; the re-baseline addendum in ' +
          'docs/experiments/records/EXP-A-04.yaml carries the post-fix series transition. THIS record ' +
          're-measures the locality pair under the EV-008 fixed Director on merged main, through the ' +
          'wave-2 integration runner.',
      ),
    },
  },
  {
    id: 'EXP-A-05-R2',
    matrixEntry: 'EXP-A-05',
    series: 'exp-a-r2',
    surface: 'audio',
    reference_notebook: REFERENCE_NOTEBOOK,
    source_fingerprint: SOURCE_FINGERPRINT,
    selected_sources: ['source-messy-note-redacted'],
    format: 'deep-dive (fixed)',
    language: 'en',
    length: '300 s -> 180 s',
    visual_style: '',
    custom_prompt: '',
    mutation: 'target duration: 300 s -> 180 s',
    otherConfig: {
      runner: RUNNER_PATH,
      series_root: 'artifacts/audio/exp-a-r2',
      director_seed: EXP_A_DIRECTOR_SEED,
      audio_seed: EXP_A_AUDIO_SEED,
      fixed_now: EXP_NOW,
      mastering: 'pure-ts',
      mirrors: 'experiments/run-exp-a.ts arm set (EV-006) under the EV-008 fixed Director',
    },
    arms: [
      {
        kind: 'audio-director',
        runId: 'deepdive-5min-baseline',
        experiment: 'exp-a-05-baseline',
        artifactId: 'artifact-exp-a-r2-deepdive-5min-baseline',
        planId: 'plan-exp-a-r2-audio-deepdive-5min',
        request: { ...AUDIO_R2_BASE },
      },
      {
        kind: 'audio-director',
        runId: 'deepdive-3min-duration',
        experiment: 'exp-a-05',
        artifactId: 'artifact-exp-a-r2-deepdive-3min',
        planId: 'plan-exp-a-r2-audio-deepdive-3min',
        request: { ...AUDIO_R2_BASE, targetDurationSeconds: 180 },
      },
    ],
    authored: {
      hypothesis:
        'Compression is salience-driven omission first: the Director drops the lowest-salience covered ' +
        'claims (with reasons in the coverage map) rather than raising speaking rate beyond the mode ' +
        'ceiling; post-fix, the 180 s arm compiles with zero over-budget turns and a bounded wps rise ' +
        '(the pre-fix arm produced 11 turn-over-budget errors).',
      confidence: 'high',
      falsifier:
        'Compression raising wordsPerSecondMean past the mode ceiling or producing over-budget turns ' +
        '(rate-driven compression); or claims omitted without coverage-map reasons (silent drop).',
      next_experiment: 'EXP-A-06-R2 (language invariance)',
      status: 'supported',
      invariants: note('Same fixture/seed/now/mode; only targetDurationSeconds differs.'),
      observations: note(
        'R2 context (REPRODUCED): EV-008 fixed Director re-baseline of the EV-006 experiment.',
      ),
    },
  },
  {
    id: 'EXP-A-06-R2',
    matrixEntry: 'EXP-A-06',
    series: 'exp-a-r2',
    surface: 'audio',
    reference_notebook: REFERENCE_NOTEBOOK,
    source_fingerprint: SOURCE_FINGERPRINT,
    selected_sources: ['source-messy-note-redacted'],
    format: 'deep-dive (fixed)',
    language: 'en -> es',
    length: '300 s both arms',
    visual_style: '',
    custom_prompt: '',
    mutation: 'output language: en -> es',
    otherConfig: {
      runner: RUNNER_PATH,
      series_root: 'artifacts/audio/exp-a-r2',
      director_seed: EXP_A_DIRECTOR_SEED,
      audio_seed: EXP_A_AUDIO_SEED,
      fixed_now: EXP_NOW,
      mastering: 'pure-ts',
      mirrors: 'experiments/run-exp-a.ts arm set (EV-006) under the EV-008 fixed Director',
    },
    arms: [
      {
        kind: 'audio-director',
        runId: 'deepdive-5min-baseline',
        experiment: 'exp-a-06-baseline',
        artifactId: 'artifact-exp-a-r2-deepdive-5min-baseline',
        planId: 'plan-exp-a-r2-audio-deepdive-5min',
        request: { ...AUDIO_R2_BASE },
      },
      {
        kind: 'audio-director',
        runId: 'deepdive-5min-es',
        experiment: 'exp-a-06',
        artifactId: 'artifact-exp-a-r2-deepdive-5min-es',
        planId: 'plan-exp-a-r2-audio-deepdive-5min-es',
        request: { ...AUDIO_R2_BASE, language: 'es' },
      },
    ],
    authored: {
      hypothesis:
        'Structure is fully language-invariant (same turn skeleton, coverage and beat plan) while the ' +
        'realized surface is fully language-specific (Spanish connective/anchor packs).',
      confidence: 'high',
      falsifier:
        'Turn structure, beat count or coverage changing with language (structure would be ' +
        'language-coupled); or byte-identical realized text across languages (surface would not be ' +
        'localized).',
      next_experiment: 'EXP-V series (video-surface ablations, wave 2)',
      status: 'supported',
      invariants: note('Same fixture/seed/now/mode/duration; only the output language differs.'),
      observations: note(
        'R2 context (REPRODUCED): EV-008 fixed Director re-baseline of the EV-006 experiment.',
      ),
    },
  },
];

// ---------------------------------------------------------------------------
// EXP-V series (video-surface ablations; storyboard layer unless noted)
// ---------------------------------------------------------------------------

const expV = (): readonly ExperimentConfig[] => [
  {
    id: 'EXP-V-01',
    matrixEntry: 'EXP-V-01',
    series: 'exp-v',
    surface: 'video',
    reference_notebook: REFERENCE_NOTEBOOK,
    source_fingerprint: SOURCE_FINGERPRINT,
    selected_sources: ['source-messy-note-redacted'],
    format: 'explainer (baseline) vs short',
    language: 'en',
    length: '120 s both arms (duration held fixed — the duration axis is EXP-V-07)',
    visual_style: 'style-bible--reference-ink (default)',
    custom_prompt: '',
    mutation: 'output mode: explainer -> short at fixed duration',
    otherConfig: {
      runner: RUNNER_PATH,
      series_root: 'artifacts/video/exp-v',
      director_seed: EXP_V_DIRECTOR_SEED,
      video_seed: EXP_V_VIDEO_SEED,
      fixed_now: EXP_NOW,
      layer: 'storyboard (scene SVG set = pinned determinism layer; no composition)',
      matrix_question_note:
        'matrix.md bundles "output duration or mode"; this arm isolates MODE at fixed duration; EXP-V-07 isolates duration',
    },
    arms: [
      {
        kind: 'video-director',
        runId: 'explainer-120s-baseline',
        experiment: 'exp-v-01-baseline',
        planId: 'plan-exp-v-explainer-120s',
        request: { ...VIDEO_V_BASE },
      },
      {
        kind: 'video-director',
        runId: 'short-120s',
        experiment: 'exp-v-01',
        planId: 'plan-exp-v-short-120s',
        request: { ...VIDEO_V_BASE, mode: 'short' },
      },
    ],
    authored: {
      hypothesis:
        'Video mode is style-scoped, not structure-scoped: at fixed duration the short mode changes ' +
        'tone/style fields (punchy, immediate) and the storyboard seed key (mode is a key component) ' +
        'but leaves the authoritative scene skeleton — scene count, order, claim anchors, durations, ' +
        'coverage — identical to explainer.',
      confidence: 'medium',
      falsifier:
        'short-mode scenes differing in count, order, claim anchors or durations at fixed budget ' +
        '(mode would drive scene structure); or coverage changing.',
      next_experiment: 'EXP-V-02 (visual style mutation scope)',
      status: 'supported',
      invariants: note('Same fixture/graph/seed/now/duration; only the video mode differs.'),
      observations: note(
        'First EXP-V landing on the merged W3 surface (REPRODUCED at the storyboard layer; offline ' +
          'deterministic providers only — NOT product parity evidence).',
      ),
    },
  },
  {
    id: 'EXP-V-02',
    matrixEntry: 'EXP-V-02',
    series: 'exp-v',
    surface: 'video',
    reference_notebook: REFERENCE_NOTEBOOK,
    source_fingerprint: SOURCE_FINGERPRINT,
    selected_sources: ['source-messy-note-redacted'],
    format: 'explainer (canonical 7 min plan fixture)',
    language: 'en',
    length: '420 s both arms (frozen canonical plan)',
    visual_style: 'style-bible--reference-ink vs ink-mutated variant (one palette role)',
    custom_prompt: '',
    mutation: `visual style: StyleBible palette.ink.value #f2f4f5 -> ${VARIANT_INK} (one role, all else byte-identical)`,
    otherConfig: {
      runner: RUNNER_PATH,
      series_root: 'artifacts/video/exp-v',
      plan_fixture: FIXTURE_PLAN_VIDEO_7MIN,
      video_seed: EXP_V_VIDEO_SEED,
      fixed_now: EXP_NOW,
      layer: 'storyboard (compileVideoScenes options.styleBible override — the documented API)',
      style_bible_variant: 'deep clone of style-bible--reference-ink with palette.ink.value mutated; validated through StyleBibleSchema',
    },
    arms: [
      {
        kind: 'video-canonical-plan',
        runId: 'canonical-420s-reference-ink',
        experiment: 'exp-v-02-baseline',
        planFile: FIXTURE_PLAN_VIDEO_7MIN,
      },
      {
        kind: 'video-canonical-plan',
        runId: 'canonical-420s-ink-variant',
        experiment: 'exp-v-02',
        planFile: FIXTURE_PLAN_VIDEO_7MIN,
        styleBible: VARIANT_STYLE_BIBLE,
      },
    ],
    authored: {
      hypothesis:
        'Visual style mutates GLOBALLY, not per-scene: the StyleBible binds at storyboard compile ' +
        'from the plan-level reference (one bible for the whole storyboard), so a one-role palette ' +
        'mutation changes every scene SVG that carries the mutated role while the scene structure ' +
        '(count/order/anchors/durations) stays identical.',
      confidence: 'high',
      falsifier:
        'A palette-role mutation changing scene structure, claim anchors or scene count (style would ' +
        'be structure-coupled); or only a strict subset of role-carrying scenes changing with no ' +
        'structure change AND the bible resolving per-scene (would indicate per-scene style binding).',
      next_experiment: 'EXP-V-03 (custom prompt layer reach)',
      status: 'supported',
      invariants: note(
        'Same frozen plan fixture and seed; only the StyleBible ink role differs (validated ' +
          'StyleBible; plan hash unchanged by construction — the override never rewrites the plan).',
      ),
      observations: note(
        'Scope note (DOCUMENTED): compileVideoOverview does not expose a styleBible option, so this ' +
          'ablation runs at the storyboard layer through compileVideoScenes documented options.styleBible ' +
          'override; KNOWN_STYLE_BIBLES ships exactly one bible (style-bible--reference-ink).',
      ),
    },
  },
  {
    id: 'EXP-V-03',
    matrixEntry: 'EXP-V-03',
    series: 'exp-v',
    surface: 'video',
    reference_notebook: REFERENCE_NOTEBOOK,
    source_fingerprint: SOURCE_FINGERPRINT,
    selected_sources: ['source-messy-note-redacted'],
    format: 'explainer (fixed)',
    language: 'en',
    length: '120 s both arms',
    visual_style: 'style-bible--reference-ink (default)',
    custom_prompt: EXP_V_03_PROMPT,
    mutation: 'custom prompt: none -> style-scoped instruction',
    otherConfig: {
      runner: RUNNER_PATH,
      series_root: 'artifacts/video/exp-v',
      director_seed: EXP_V_DIRECTOR_SEED,
      video_seed: EXP_V_VIDEO_SEED,
      fixed_now: EXP_NOW,
      layer: 'storyboard',
      custom_prompt: EXP_V_03_PROMPT,
      director_prior: 'custom instructions affect style fields only, never claim coverage (src/director/compiler.ts contract comment)',
    },
    arms: [
      {
        kind: 'video-director',
        runId: 'ci-control-120s',
        experiment: 'exp-v-03-baseline',
        planId: 'plan-exp-v-explainer-120s-ci',
        request: { ...VIDEO_V_BASE },
      },
      {
        kind: 'video-director',
        runId: 'ci-mutated-120s',
        experiment: 'exp-v-03',
        planId: 'plan-exp-v-explainer-120s-ci',
        request: { ...VIDEO_V_BASE, customInstructions: EXP_V_03_PROMPT },
      },
    ],
    authored: {
      hypothesis:
        'Custom prompting reaches the PLAN layer only in this lab: the Director parks customInstructions ' +
        'in plan style fields and never in claim coverage (documented prior). Downstream, the storyboard ' +
        'keys seeded choices on planHash, so the surface layer still reshuffles (C-5 class keying) even ' +
        'though the editorial content is unchanged.',
      confidence: 'high',
      falsifier:
        'A style-only prompt reliably changing which source claims appear (coverage drift — the ' +
        'documented falsifier anchor); or plan style fields unchanged while coverage changes.',
      next_experiment: 'EXP-V-04 (claim mutation locality)',
      status: 'supported',
      invariants: note(
        'Same fixture/graph/seed/now/duration/mode; only customInstructions differs; both arms share ' +
          'the planId so planHash isolation is attributable to the prompt field alone.',
      ),
      observations: note(
        'First EXP-V landing on the merged W3 surface (REPRODUCED at the storyboard layer).',
      ),
    },
  },
  {
    id: 'EXP-V-04',
    matrixEntry: 'EXP-V-04',
    series: 'exp-v',
    surface: 'video',
    reference_notebook: REFERENCE_NOTEBOOK,
    source_fingerprint: SOURCE_FINGERPRINT,
    selected_sources: ['source-messy-note-redacted (fresh chain, both arms)'],
    format: 'explainer (fixed)',
    language: 'en',
    length: '300 s both arms (parallels the EXP-A-04-R2 audio pair)',
    visual_style: 'style-bible--reference-ink (default)',
    custom_prompt: '',
    mutation: `one claim changed via the b30 source paragraph (same edit as EXP-A-04): "${B30_ORIGINAL}" -> "${B30_MUTATED}"`,
    otherConfig: {
      runner: RUNNER_PATH,
      series_root: 'artifacts/video/exp-v',
      mutation_block: 'b30',
      chain: 'MarkdownNoteAdapter -> DeterministicExtractor -> Director -> compileVideoScenes -> render (BOTH arms)',
      director_seed: EXP_A_DIRECTOR_SEED,
      video_seed: EXP_V_VIDEO_SEED,
      fixed_now: EXP_NOW,
      layer: 'storyboard',
      parallels: 'EXP-A-04-R2 (identical mutation and fresh chain; video modality)',
    },
    arms: [
      {
        kind: 'video-fresh-chain',
        runId: 'v04-control-explainer-300s',
        experiment: 'exp-v-04-control',
        planId: 'plan-exp-v-explainer-300s',
        request: { ...VIDEO_V_BASE, targetDurationSeconds: 300, seed: EXP_A_DIRECTOR_SEED },
      },
      {
        kind: 'video-fresh-chain',
        runId: 'v04-mut-b30-explainer-300s',
        experiment: 'exp-v-04',
        planId: 'plan-exp-v-explainer-300s',
        request: { ...VIDEO_V_BASE, targetDurationSeconds: 300, seed: EXP_A_DIRECTOR_SEED },
        mutation: B30_MUTATION,
      },
    ],
    authored: {
      hypothesis:
        'The video analog of EXP-A-04: visual mutation impact is local at the semantic layers (graph: ' +
        'exactly the b30-fed claim; plan/storyboard: scene structure identical) and global at the ' +
        'rendered-surface layer, because the storyboard compiler keys stochastic choices on ' +
        '(seed | planHash | mode | sceneId) and any plan content change reshuffles every seeded scene ' +
        'surface — the same plan-global planHash defect class as audio (C-5, v2 wave candidate).',
      confidence: 'high',
      falsifier:
        'The b30 change altering scene structure, scene count or coverage (editorial impact NOT ' +
        'local); or unchanged rendered SVGs on scenes citing the mutated claim (anchors do not ' +
        'propagate into visuals).',
      next_experiment: 'EXP-V-05 (source ordering — blocked, W1 multi-source defect)',
      status: 'supported',
      invariants: note(
        'Both arms run the identical fresh chain with identical ids/seeds/now/planId; only the b30 ' +
          'paragraph text differs (one variable).',
      ),
      observations: note(
        'First EXP-V landing on the merged W3 surface (REPRODUCED at the storyboard layer).',
      ),
    },
  },
  {
    id: 'EXP-V-05',
    matrixEntry: 'EXP-V-05',
    series: 'exp-v',
    surface: 'video',
    reference_notebook: REFERENCE_NOTEBOOK,
    source_fingerprint: SOURCE_FINGERPRINT,
    selected_sources: ['source-note-a', 'source-note-b (raw fixture split at the Section 2 marker)'],
    format: 'explainer (fixed)',
    language: 'en',
    length: '180 s (intended)',
    visual_style: 'style-bible--reference-ink (default)',
    custom_prompt: '',
    mutation: 'source ordering: [A, B] -> [B, A] (same two sources, order swapped)',
    otherConfig: {
      runner: RUNNER_PATH,
      series_root: 'artifacts/video/exp-v',
      split_marker: SOURCE_SPLIT_MARKER,
      fixed_now: EXP_NOW,
      layer: 'blocked at ingestion/extraction (see blocker)',
    },
    arms: [
      {
        kind: 'video-blocked',
        runId: 'multisource-order-ab',
        experiment: 'exp-v-05-baseline',
        expectedBlocker: 'DeterministicExtractor produced an inconsistent graph',
      },
      {
        kind: 'video-blocked',
        runId: 'multisource-order-ba',
        experiment: 'exp-v-05',
        expectedBlocker: 'DeterministicExtractor produced an inconsistent graph',
      },
    ],
    authored: {
      hypothesis:
        'UNTESTED (blocked): source order would surface through the primary-source selection (the ' +
        'Director titles/objective follow sources[0]) and possibly through equal-salience claim ' +
        'ranking, not through scene reordering per se.',
      confidence: 'low',
      falsifier:
        'Narrative order proving strictly independent of source order (beat/scene order identical ' +
        'across the swap) would weaken any ordering-coupling hypothesis.',
      next_experiment:
        'W1 multi-source block-id fix (HANDOFF) — then re-run EXP-V-05/EXP-V-06 unchanged',
      status: 'blocked',
      invariants: note(
        'Both arms split the SAME raw fixture at the SAME marker; only the ingestion order differs.',
      ),
      observations: note(
        'BLOCKED (OBSERVED, deterministically REPRODUCED): two-source ingestion through ' +
          'MarkdownNoteAdapter + DeterministicExtractor throws before the Director ever runs — the ' +
          'adapter numbers blocks b1..bn PER SOURCE while the contract validator indexes blocks by ' +
          'block id only (src/contracts/validation.ts BlockIndex: "first definition wins"), so the ' +
          'second source blocks are all "unknown". HANDOFF (W1 territory): source-scoped block ids or ' +
          'a (sourceId, blockId) validator key.',
      ),
    },
  },
  {
    id: 'EXP-V-06',
    matrixEntry: 'EXP-V-06',
    series: 'exp-v',
    surface: 'video',
    reference_notebook: REFERENCE_NOTEBOOK,
    source_fingerprint: SOURCE_FINGERPRINT,
    selected_sources: ['source-note-a', 'source-note-b (raw fixture split at the Section 2 marker)'],
    format: 'explainer (fixed)',
    language: 'en',
    length: '180 s (intended)',
    visual_style: 'style-bible--reference-ink (default)',
    custom_prompt: '',
    mutation: 'one source removed: [A, B] -> [A]',
    otherConfig: {
      runner: RUNNER_PATH,
      series_root: 'artifacts/video/exp-v',
      split_marker: SOURCE_SPLIT_MARKER,
      fixed_now: EXP_NOW,
      layer: 'blocked at ingestion/extraction (see blocker)',
    },
    arms: [
      {
        kind: 'video-blocked',
        runId: 'multisource-baseline-ab',
        experiment: 'exp-v-06-baseline',
        expectedBlocker: 'DeterministicExtractor produced an inconsistent graph',
      },
    ],
    authored: {
      hypothesis:
        'UNTESTED (blocked): removing a source would drop that source\u2019s claims from the graph and ' +
        'recombine or drop their scenes; the coverage map would re-account every removed claim.',
      confidence: 'low',
      falsifier:
        'Scenes surviving unchanged despite their anchor claims disappearing (stale grounding) would ' +
        'falsify plan-authoritative recombination.',
      next_experiment:
        'W1 multi-source block-id fix (HANDOFF) — then re-run EXP-V-05/EXP-V-06 unchanged',
      status: 'blocked',
      invariants: note(
        'The ablation baseline requires the two-source chain; the single-source variant alone cannot ' +
          'answer the matrix question, so no partial run is claimed.',
      ),
      observations: note(
        'BLOCKED (OBSERVED, deterministically REPRODUCED): same W1 multi-source blocker as EXP-V-05 — ' +
          'the two-source baseline cannot be extracted, so the removal diff has no control arm.',
      ),
    },
  },
  {
    id: 'EXP-V-07',
    matrixEntry: 'EXP-V-07',
    series: 'exp-v',
    surface: 'video',
    reference_notebook: REFERENCE_NOTEBOOK,
    source_fingerprint: SOURCE_FINGERPRINT,
    selected_sources: ['source-messy-note-redacted'],
    format: 'explainer (fixed)',
    language: 'en',
    length: '180 s -> 90 s',
    visual_style: 'style-bible--reference-ink (default)',
    custom_prompt: '',
    mutation: 'target duration: 180 s -> 90 s',
    otherConfig: {
      runner: RUNNER_PATH,
      series_root: 'artifacts/video/exp-v',
      director_seed: EXP_V_DIRECTOR_SEED,
      video_seed: EXP_V_VIDEO_SEED,
      fixed_now: EXP_NOW,
      layer: 'storyboard',
    },
    arms: [
      {
        kind: 'video-director',
        runId: 'duration-180s-baseline',
        experiment: 'exp-v-07-baseline',
        planId: 'plan-exp-v-explainer-180s',
        request: { ...VIDEO_V_BASE, targetDurationSeconds: 180 },
      },
      {
        kind: 'video-director',
        runId: 'duration-90s',
        experiment: 'exp-v-07',
        planId: 'plan-exp-v-explainer-90s',
        request: { ...VIDEO_V_BASE, targetDurationSeconds: 90 },
      },
    ],
    authored: {
      hypothesis:
        'Video compression scales scene density with the budget (fewer scenes, fewer covered claims ' +
        'dropped by salience rank with coverage-map reasons) rather than shrinking scene durations ' +
        'below narratability; per-scene narration pacing stays in the StyleBible band.',
      confidence: 'medium',
      falsifier:
        'Scene COUNT staying fixed while durations collapse (density-invariant compression); or claims ' +
        'silently disappearing without coverage-map accounting.',
      next_experiment: 'EXP-V-08 (stochastic stability)',
      status: 'supported',
      invariants: note('Same fixture/graph/seed/now/mode; only targetDurationSeconds differs.'),
      observations: note(
        'First EXP-V landing on the merged W3 surface (REPRODUCED at the storyboard layer).',
      ),
    },
  },
  {
    id: 'EXP-V-08',
    matrixEntry: 'EXP-V-08',
    series: 'exp-v',
    surface: 'video',
    reference_notebook: REFERENCE_NOTEBOOK,
    source_fingerprint: SOURCE_FINGERPRINT,
    selected_sources: ['source-messy-note-redacted'],
    format: 'explainer (fixed)',
    language: 'en',
    length: '180 s all arms',
    visual_style: 'style-bible--reference-ink (default)',
    custom_prompt: '',
    mutation:
      'unchanged input, stochastic stream changed: (a) video surface seed only; (b) Director seed only',
    otherConfig: {
      runner: RUNNER_PATH,
      series_root: 'artifacts/video/exp-v',
      director_seed: EXP_V_DIRECTOR_SEED,
      director_seed_b: EXP_V_DIRECTOR_SEED_B,
      video_seed: EXP_V_VIDEO_SEED,
      video_seed_b: EXP_V_VIDEO_SEED_B,
      fixed_now: EXP_NOW,
      layer: 'storyboard',
      matrix_question_note:
        'matrix.md asks what stays stable across stochastic runs of unchanged input; the lab analog mutates the seed streams (the only stochastic axes) — one variable per variant arm',
    },
    arms: [
      {
        kind: 'video-director',
        runId: 'seed-baseline-180s',
        experiment: 'exp-v-08-baseline',
        planId: 'plan-exp-v-explainer-180s-s',
        request: { ...VIDEO_V_BASE, targetDurationSeconds: 180 },
        surfaceSeed: EXP_V_VIDEO_SEED,
      },
      {
        kind: 'video-director',
        runId: 'seed-surface-b-180s',
        experiment: 'exp-v-08-surface-seed',
        planId: 'plan-exp-v-explainer-180s-s',
        request: { ...VIDEO_V_BASE, targetDurationSeconds: 180 },
        surfaceSeed: EXP_V_VIDEO_SEED_B,
      },
      {
        kind: 'video-director',
        runId: 'seed-director-b-180s',
        experiment: 'exp-v-08-director-seed',
        planId: 'plan-exp-v-explainer-180s-s',
        request: { ...VIDEO_V_BASE, targetDurationSeconds: 180, seed: EXP_V_DIRECTOR_SEED_B },
        surfaceSeed: EXP_V_VIDEO_SEED,
      },
    ],
    authored: {
      hypothesis:
        'Lab analog of stochastic regeneration: the surface seed alone reshuffles rendered scene ' +
        'surfaces (seeded layout/ink choices) while the plan/storyboard structure stays byte-stable; ' +
        'the Director seed additionally reshuffles equal-salience claim ranking, so structure can move ' +
        'only where salience ties exist.',
      confidence: 'medium',
      falsifier:
        'Surface-seed-only change altering scene structure or coverage (surface randomness would be ' +
        'structure-coupled); or Director-seed change leaving every rendered byte identical (the seed ' +
        'would not participate anywhere).',
      next_experiment: 'EXP-D-01 (same-source dual-modality comparison)',
      status: 'supported',
      invariants: note(
        'Same fixture/graph/now/duration/mode; variant (a) changes only the storyboard surface seed, ' +
        'variant (b) only the Director seed; all arms share the planId.',
      ),
      observations: note(
        'First EXP-V landing on the merged W3 surface (REPRODUCED at the storyboard layer).',
      ),
    },
  },
];

// ---------------------------------------------------------------------------
// EXP-D series (same-source dual-modality comparison — checklist §2 item 5)
// ---------------------------------------------------------------------------

const expD = (): readonly ExperimentConfig[] => [
  {
    id: 'EXP-D-01',
    matrixEntry: '(not a matrix.md entry — Phase 3 checklist §2 item 5, wave 2)',
    series: 'exp-d',
    surface: 'cross-modal',
    reference_notebook: REFERENCE_NOTEBOOK,
    source_fingerprint: SOURCE_FINGERPRINT,
    selected_sources: ['source-messy-note-redacted'],
    format: 'deep-dive (audio) vs explainer (video) — each modality\u2019s default mode',
    language: 'en',
    length: '300 s both modalities (same editorial budget)',
    visual_style: 'style-bible--reference-ink (default)',
    custom_prompt: '',
    mutation: 'none — same source, same seed, same duration; the MODALITY is the comparison axis',
    otherConfig: {
      runner: RUNNER_PATH,
      series_roots: ['artifacts/audio/exp-d', 'artifacts/video/exp-d'],
      director_seed: EXP_D_SEED,
      audio_seed: EXP_D_SEED,
      video_seed: EXP_D_SEED,
      fixed_now: EXP_NOW,
      mastering: 'pure-ts',
      composition: 'video arm composes through compileVideoOverview (Remotion primary); MP4 fingerprinted (sha256 in artifact.json), NOT committed (golden-media precedent)',
      shared_spine_note:
        'v1 OverviewPlan is modality-exclusive (PR #8 / EV-010 HANDOFF 1): the shared IR is the source, graph, seed, claim universe and coverage accounting — the comparison renders one Director plan per modality',
    },
    arms: [
      {
        kind: 'dual-audio',
        runId: 'dual-audio-deepdive-300s',
        experiment: 'exp-d-01-audio',
        artifactId: 'artifact-exp-d-audio-deepdive-300s',
        planId: 'plan-exp-d-audio-deepdive-300s',
        request: { modality: 'audio', audience: 'technical', language: 'en', targetDurationSeconds: 300, seed: EXP_D_SEED, now: EXP_NOW },
      },
      {
        kind: 'dual-video',
        runId: 'dual-video-explainer-300s',
        experiment: 'exp-d-01-video',
        planId: 'plan-exp-d-video-explainer-300s',
        request: { modality: 'video', audience: 'technical', language: 'en', targetDurationSeconds: 300, seed: EXP_D_SEED, now: EXP_NOW },
      },
    ],
    authored: {
      hypothesis:
        'Same (source, graph, seed, duration) yields the SAME editorial spine across modalities — ' +
        'identical accounted/covered claim sets — while each surface realizes it with its own ' +
        'deterministic QA profile (audio: turn/timing/loudness metrics; video: scene/alignment/grounding ' +
        'metrics); both surfaces compile clean (no failing QA) on the merged main pipelines.',
      confidence: 'high',
      falsifier:
        'Covered claim sets differing across modalities at identical (seed, duration) (the shared IR ' +
        'would be modality-coupled); or either surface failing QA on the canonical fixture.',
      next_experiment: 'EXP-X-02 treatment arm (v2 C-5 per-turn keying decision)',
      status: 'supported',
      invariants: note(
        'ONE fixture source, ONE seed (director + audio + video), ONE duration; only the modality ' +
          'differs; the comparison tabulates deterministic metrics only (no wall-clock).',
      ),
      observations: note(
        'The artifact side is supplied by the wave-1 unified manifest registry ' +
          '(tools/manifest): both arms land GeneratedArtifact sidecars under their surface roots and ' +
          'are picked up by `bun run manifest:build`.',
      ),
    },
  },
];

// ---------------------------------------------------------------------------
// The full wave-2 experiment config set
// ---------------------------------------------------------------------------

export const EXPERIMENT_CONFIGS: readonly ExperimentConfig[] = [
  ...expAR2(),
  ...expV(),
  ...expD(),
];

/** Fixed metadata shared by the summary + records. */
export const RUNNER_ID = 'wflx-integration-experiment-runner';
export const RUNNER_VERSION = '0.1.0';
export const RUNNER_PATH_VALUE = RUNNER_PATH;
export const RECORDS_DIR = 'docs/experiments/records';
export const ARMS_DATA_DIR = 'artifacts/experiments/arms';
export const SUMMARY_PATH = 'artifacts/experiments/summary.json';
export const EVIDENCE_ENTRIES_PATH = 'artifacts/experiments/evidence-entries.jsonl';

export { EXP_NOW, EXP_RECORD_TIMESTAMP, EXP_OPERATOR };
