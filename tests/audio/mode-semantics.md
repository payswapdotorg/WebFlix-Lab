# Audio Mode Semantics — Testable Specification (W2)

Status: Stage 1 specification. This document distills
`docs/notebooklm-overviews-research.md` and the repository's documented
evidence into a testable specification of Audio Overview mode semantics.

## 0. Evidence posture (read this first)

- As of this document, `docs/evidence/registry.jsonl` (EV-000..EV-002)
  contains **no audio-surface black-box runs** — existing records are
  reference-import and integration checks for the video surface.
- Therefore this document makes **zero OBSERVED claims** about audio
  behavior. Every product-behavior statement below is DOCUMENTED (official
  public materials, as cited in docs/notebooklm-overviews-research.md),
  HYPOTHESIS (structural inference, awaiting EXP-A black-box confirmation),
  or UNRESOLVED.
- Per AGENTS.md: fixture-only success is not product parity. A lab test
  passing below proves a **lab structural property**; it does not prove the
  real product shares it. Product-level confirmation requires the EXP-A
  black-box runs (TL #2 operated, per docs/reference/gemini-notebook-access.md
  "Audio experiments" section).
- Labels may only be promoted via the protocol: HYPOTHESIS → (black-box run)
  → REPRODUCED (lab demonstrates the confirmed behavior reproducibly).

## 1. Documented surface facts (config level)

Sources: official Gemini Notebook / NotebookLM support and Google blog pages
as collected in docs/notebooklm-overviews-research.md.

| ID | Fact | Label |
| --- | --- | --- |
| D-01 | Four Audio Overview formats exist: Deep Dive, Brief, Critique, Debate | DOCUMENTED |
| D-02 | User-controllable generation options include language, length, custom prompt | DOCUMENTED |
| D-03 | Generation is asynchronous; output is downloadable and shareable | DOCUMENTED |
| D-04 | An interactive mode exists where the user can join the hosts | DOCUMENTED |
| D-05 | Audio Overviews are two-host discussions grounded in the selected sources | DOCUMENTED |
| D-06 | Gemini native audio/TTS supports expressive multi-speaker output, including NotebookLM-style two-person overviews | DOCUMENTED |
| D-07 | Audio Overviews are source-grounded (grounding in selected sources is the product's stated behavior) | DOCUMENTED |

## 2. Mode semantics — hypotheses with testable predicates

> **Post-freeze alignment** (against `work/wflx-w1-contracts` @ `78be437`,
> see src/audio/DESIGN.md §16): the plan's `audioTurns` are the authoritative
> turn skeleton (speakers, frozen 10-value purpose enum, durations, coverage).
> Predicates below that name purposes outside the frozen enum
> (`assessment`, `limitation`, `verdict`, `position_statement`, `rebuttal`,
> `cross_examination`, `concession`, `acknowledgement`) are asserted against
> W2's DialogueGraph ENRICHED TAGS and/or the plan's beat/brief structure —
> on the wire they map to frozen purposes per DESIGN.md §16.2 item 5, and the
> frozen purpose always passes through unchanged. Structural mode
> differences materialize in the PLAN (W1's Director); W2 validates, realizes
> and flags. Canonical fixtures per mode are a HANDOFF (DESIGN.md §16.4
> item 2) — until they exist, mode-predicate tests run against audio-local
> stand-in plans labeled non-canonical.

Each hypothesis has: a product-level statement, the lab structural predicate
(what `tests/audio` asserts on `DialogueGraph` / `AudioTurn[]` from fixture
plans), and the product-level falsifier (what black-box observation would
refute it). Experiment mapping per `docs/experiments/matrix.md`.

### H-A-01 — Format changes editorial structure (Deep Dive → Brief) — EXP-A-01

Product statement [HYPOTHESIS]: Brief is not merely a shorter Deep Dive; it is
editorially restructured — headline framing, top-emphasis claims only, no
exploration agenda, no examples, denser pacing.

Lab predicates (structural, deterministic on fixture plan + fixed seed;
post-freeze: structural differences live in the PLANS — W2 tests compile
per-mode plans and validate realization + semantics):

1. Same source graph and target duration band, Deep Dive vs Brief plans ⇒
   different turn skeletons: Brief has no `agenda`-tagged turn, no
   `connection` turns, and (unless plan-essential) no `example` turns; Deep
   Dive has ≥1 example and ≥1 connection when budget permits.
2. Turn-count(Deep Dive plan) > turn-count(Brief plan) for the same source
   graph and target duration band.
3. Brief coverage ⊂ Deep Dive coverage, ordered by claim salience; dropped
   claims appear in the plan's `CoverageMap.omitted` with reasons — never
   silently (and W2's coverage QA re-reports them at the audio boundary).
4. Purpose distributions differ: Brief has zero/near-zero `interjection`
   and follow-up `question` turns; Deep Dive has ≥1 `question` for a plan
   of sufficient size.
5. Both plans and realizations validate: every factual turn carries
   existing claim ids.

Product-level falsifier: a real Brief that covers the same claim set as a
Deep Dive of the same source with only speaking-rate compression — or a real
Brief containing agenda/example structure.

### H-A-02 — Critical framing is structurally distinct (Deep Dive → Critique) — EXP-A-02

Product statement [HYPOTHESIS]: Critique keeps broad coverage but restructures
each topic into evaluation (assessment, limitation, implication) and closes
with a verdict rather than a summary.

Lab predicates (enriched-tag level; see §2 preamble for the frozen-enum
mapping):

1. A Critique plan/realization contains `assessment`- and `limitation`-tagged
   turns (enriched tags over `explanation`-family frozen purposes) that do not
   occur in a Deep Dive realization of the same source.
2. Every Critique topic cluster with plan-flagged weaknesses/gaps contains a
   `limitation`-tagged turn citing the flagged claim; clusters without flags
   contain an explicit "not addressed by the source" stance in realized text
   instead of an invented criticism (grounding rule). Note: plan-level
   weakness/gap flags do not exist yet — DESIGN.md §16.4 item 1 HANDOFF.
3. Critique closing realizes in verdict register (enriched `verdict` tag;
   frozen purpose `conclusion`); Deep Dive closing realizes in summary
   register — differentiated by enriched tag + realized text lexicon, not by
   frozen purpose.
4. Coverage sets are approximately equal (Critique ≈ Deep Dive), unlike Brief.
5. Opening framing differs structurally: evaluative framing token/purpose
   signature vs exploratory.

Product-level falsifier: real Critique transcripts showing summary-style
closings and no limitation/evaluation turn pattern, or coverage loss
equivalent to Brief.

### H-A-03 — Debate creates a real argument graph (Deep Dive → Debate) — EXP-A-03

Product statement [HYPOTHESIS]: Debate assigns the hosts opposing positions
over contested claims and produces position/rebuttal/cross-examination turns,
while uncontested claims are not artificially opposed.

Lab predicates (enriched-tag level; see §2 preamble):

1. A Debate plan/realization contains `position_statement`-, `rebuttal`- and
   `cross_examination`-tagged turns (enriched tags over `framing`/
   `clarification`/`question` frozen purposes) absent from Deep Dive.
2. Host stances are assigned (`pro`/`con`) and stable across the realization;
   stance derivation is deterministic from (briefs, enriched tags) and labeled
   HYPOTHESIS-grade until W1 exposes stance signals (DESIGN.md §16.4 item 1).
3. Each rebuttal-tagged turn cites different claim ids than the position it
   rebuts (rebuttal-by-restatement fails validation).
4. Uncontested plan claims are never rendered as debate positions — no
   fabricated disagreement (grounding rule).
5. Closing is an evidence-weighted synthesis; with symmetric evidence it does
   not declare a winner (no unsupported verdict text).

Product-level falsifier: real Debate where hosts agree on everything
(fake opposition), or where uncontested facts are argued, or where no
rebuttal structure exists (parallel monologues).

### H-A-04 — Natural turn-taking, not mechanical alternation

Product statement [HYPOTHESIS, asserted as binding lab rule by the W2 work
order]: hosts converse naturally — acknowledgements/backchannels, questions,
occasional same-speaker continuation; speaker alternation is not fixed parity.

Lab predicates (Deep Dive/Critique/Debate graphs of sufficient size):

1. Speaker turn-share within 35–65% (not forced 50/50). The canonical
   deep-dive plan fixture (host-a 12 / host-b 10) already satisfies this
   [REPRODUCED at plan-fixture level; product-level claim stays HYPOTHESIS].
2. Longest strict ABAB run is bounded (no whole-graph parity walk).
3. ≥1 backchannel/acknowledgement feature and ≥1 question→answer
   (`respondsTo`) link exist. Post-freeze note: separate `interjection`
   turns are PLAN-authoritative — if the plan lacks them, W2 realizes
   conversational tissue inside turn text and flags the gap as an
   `info`-severity QA note (DESIGN.md §16.4 item 3).
4. Same-speaker turns occur only within justified purpose units and are
   bounded (≤2 consecutive) — validated against the plan's turn sequence.

Product-level falsifier: real overviews showing strict host alternation with
no backchannel/interjection behavior.

### H-A-05 — Duration compression is editorial, not velocity — EXP-A-05

Product statement [HYPOTHESIS]: reducing target length removes material
(examples → digressions → low-emphasis claims) rather than speaking
proportionally faster; a floor exists below which content is cut.

Lab predicates:

1. Same plan+mode with decreasing target durations shows the DIRECTOR
   compressing coverage (plans with fewer/smaller turns and omitted-claim
   reasons in the CoverageMap), while W2's realized text density per turn
   stays within mode bounds — post-freeze, coverage cuts are plan authority
   (DESIGN.md §16.2 item 3); W2 never drops claims itself.
2. If a turn cannot honestly realize its brief within its authoritative
   target, the compiler emits an `over-budget` QA issue naming the turn —
   never silently degrades grounding.
3. Speaking-rate parameter stays within mode bounds across targets (no
   2× velocity hack).

Product-level falsifier: real short-form overviews retaining identical claim
counts with measurably proportionate speaking-rate increase and no content
omission.

### H-A-06 — Language preserves structure, re-localizes surface — EXP-A-06

Product statement [HYPOTHESIS]: changing language preserves claim selection
and order; expression and voices change.

Lab predicates:

1. Same plan+mode+seed across two languages ⇒ identical purpose sequence,
   identical claim coverage, identical link structure.
2. Surface text differs; claim ids are the invariant anchors.
3. Voice profiles switch per language; persona roles persist.

Product-level falsifier: real cross-language pairs showing different claim
selection or radically different topic order.

### H-A-07 — Custom prompts affect style, not coverage

Product statement [HYPOTHESIS]: custom instructions primarily modulate
tone/register/emphasis, not which source claims appear.

Lab predicates:

1. Style-only plan mutations (register, banned terms, emphasis boost fields)
   change `TurnStyle`/realized surface but leave the covered claim set
   unchanged.
2. If a prompt mutation is expressed by the Director as a coverage change,
   that is a Director decision (plan field), not an audio-layer inference.

Product-level falsifier: a style-only custom prompt that reliably changes
which source claims appear in real overviews.

### H-A-08 — Speaker consistency within and across generations

Product statement [HYPOTHESIS]: host voices are consistent within an artifact
and stable across regenerations of the same input (regeneration stability,
audio analog of EXP-V-08).

Lab predicates:

1. Within a run: per-speaker voice params identical across all turns.
2. Across runs with same seed: byte-identical offline audio and identical
   manifests (determinism).
3. Cross-run voice variance is a reported metric (0 for deterministic path).

Product-level falsifier: real regenerations producing audibly different host
voices/identities for identical inputs.

## 3. Documented-behavior encoding (config level, testable now)

| ID | Behavior | Label | Lab test |
| --- | --- | --- | --- |
| E-01 | Four modes accepted by the compiler | DOCUMENTED (D-01) | mode enum + per-mode compiler selection |
| E-02 | Language option honored end-to-end | DOCUMENTED (D-02) | H-A-06 predicates |
| E-03 | Length option honored | DOCUMENTED (D-02) | H-A-05 predicates (length ⇔ target duration mapping is lab-defined; product granularity UNRESOLVED) |
| E-04 | Output is a downloadable media artifact with metadata | DOCUMENTED (D-03) | artifacts/ + provenance sidecar per artifacts/README.md |
| E-05 | Two hosts, both participate | DOCUMENTED (D-05) | speaker-count == 2; both hosts own ≥1 turn; H-A-04 |

## 4. UNRESOLVED register (needs black-box evidence; do not guess)

| ID | Question |
| --- | --- |
| U-01 | Exact Brief length semantics (what "length" options mean in seconds) |
| U-02 | Critique coverage: full set vs prioritized subset |
| U-03 | Debate persona persistence across generations/sessions |
| U-04 | Interactive mode's structural effect (user joins hosts — turn insertion? barge-in?) |
| U-05 | Real gap/pause distributions per boundary class |
| U-06 | Real mastering target (LUFS) and loudness behavior |
| U-07 | Pronunciation mechanism (SSML vs prompt-level vs automatic) |
| U-08 | Speaking-rate values per mode in the real product |
| U-09 | Whether real Deep Dives include an explicit agenda turn (our threshold-based design is a guess pending transcripts) |
| U-10 | Regeneration variability of the real product (stochastic vs pinned seeds) |

## 5. Differential-analysis checklist → QA metric mapping

From docs/experiments/protocol.md (audio), mapped to the deterministic QA
metrics of src/audio/qa/ (DESIGN.md §9):

| Protocol checklist item | QA metric |
| --- | --- |
| turn count | structural count in TimingManifest/QA report |
| speaker count | speaker_consistency |
| speaker identity | speaker_consistency (params stable) |
| turn ordering | purpose/link sequence hash (determinism + diff) |
| claim coverage | coverage (groundedness, dropped-claim report) |
| examples | purpose-count(`example`) |
| host questions/interjections | purpose-count(`question`/`interjection`) + respondsTo links |
| pauses | pause_distribution |
| speaking rate | realized words/sec vs rate model |
| pronunciation | pronunciation_risk flags |
| loudness | loudness (LUFS when measurable) |
| total duration | duration_vs_target |

## 6. Test hygiene rules

1. Tests assert **structural** properties (shapes, invariants, ordering),
   never subjective quality.
2. Every product-behavior assertion in a test comment cites the hypothesis
   ID (H-A-xx) from this document; lab-only invariants are marked as such.
3. Fixture plans come from W1's canonical fixtures once frozen; until then,
   audio-local minimal fixtures are marked `audio-local` and are NOT product
   parity evidence.
4. No test may require network or credentials — the offline deterministic
   provider is the test path (binding).
5. Deterministic seeds are fixed in tests; no wall-clock or Math.random
   anywhere in the compile path (lint-enforced in Stage 2).
