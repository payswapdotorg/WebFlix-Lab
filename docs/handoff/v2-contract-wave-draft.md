# v2 Contract Wave — decision draft (pre-staged for the post-W3 ruling)

Status: DRAFT by TL #2, 2026-09-27 (during the platform outage; W3 still
queued). This document consolidates every v2 contract-change candidate with
its evidence base so the post-W3 ruling is a decision, not an
investigation. The wave itself remains ONE consolidated breaking change
(`CONTRACTS_VERSION` bump) after W3 lands (adjudication H-1 ruling, wave-1
document) — nothing here is decided; each candidate carries its decision
inputs and its default.

Decision inputs new since wave-1: EV-006 (EXP-A series) and the Phase 3
p3a work order (Director turn-budget allocation, pre-staged worker prompt).

## Candidate register

### C-1 — ClaimRecord: contestedness / stance / gap flags (from H-1)

- **What**: editorial flags on ClaimRecord so stance-bearing modes
  (critique/debate) carry mode intent in the plan instead of W2's
  keyword-heuristic enriched tags.
- **Evidence now**: EXP-A-02/03 confirm the plan skeleton DOES carry mode
  intent structurally (purpose pairing), while W2's heuristics cannot fire
  on Director briefs (EV-005 H-1 gap). The structural path works today; the
  flags would enrich QA precision, not enable the modes.
- **Decision inputs from W3**: does the video surface need stance flags for
  scene typing (e.g. two-sided layouts in debate video)?
- **Default posture**: include if W3 needs it; otherwise defer again (the
  structural path is proven sufficient for audio).

### C-2 — Per-claim evidence enforcement on AudioTurn (from H-5)

- **What**: enforce that AudioTurn.evidence covers every claimId the turn
  cites (today W2's realizer may fall back to graph-claim evidence).
- **Evidence now**: EXP-A arms all ran clean on canonical plans; the
  fallback-fire rate on canonical fixtures is still UNMEASURED.
- **Decision inputs**: the Phase 3 cross-modal QA measurement (checklist
  item) — measure the rate; include only if material.
- **Default posture**: defer unless the measured rate is material.

### C-3 — CoverageEntry beat-vs-turn boundary (from H-4)

- **What**: doc-only; already documented in `src/contracts/README.md`.
- **Default posture**: closed (doc landed); rides the wave only as a
  version-stamped note.

### C-4 — Interjection turn type (from H-3)

- **What**: plan-authoritative interjection/backchannel turns.
- **Evidence now**: unchanged — needs W3's golden-reference annotation
  (OBSERVED turn-taking cues) per the H-3 ruling; Phase 4 decision.
- **Default posture**: out of the v2 wave unless W3's annotation lands
  strong evidence early.

### C-5 — Per-turn content-keyed seeding (NEW, from EXP-A-04 / EV-006)

- **What**: key the realizer's seeded surface choices by a turn-LOCAL
  content hash (e.g. seed | hash(turn-brief+anchors) | slot) instead of the
  plan-global planHash, so a one-claim change does not reshuffle every
  other turn's surface.
- **Evidence now (strongest of the register)**: EXP-A-04 measured one
  paragraph changed -> graph+plan perfectly local (0/25 structures) but
  21/25 realized texts reshuffled; the mechanism (planHash keying) is
  documented (EV-005 determinism trap) and reproduced on demand. This
  defeats AGENTS.md's "regenerate the smallest failed unit" architecture
  rule at the text layer and blocks EXP-X-02 (local refinement) from
  demonstrating true smallest-unit regeneration.
- **Determinism impact**: NONE at the whole-artifact level (same plan ->
  same surfaces); only the DIFF semantics improve (unchanged inputs keep
  surfaces). Existing committed fingerprints stay valid because the key
  change is invisible to a full recompile of the SAME plan — verification:
  re-run `bun run test` + the EXP-A summary must reproduce byte-identical
  media hashes.
- **Decision inputs from W3**: does the video realizer share the same
  plan-global keying? If yes, fix both surfaces in the same wave.
- **Default posture**: INCLUDE in the v2 wave (P3B-adjacent: the change
  lives in realizer key derivation; audio side is W2-owned code, so it is a
  worker task with a tight contract note from the TL).

### C-6 — Language-bound graphs (NEW, from EXP-A-06 / EV-006)

- **What**: SemanticGraph claims are extracted language-bound (EN
  statements); ES surfaces voice EN anchors (code-switching). v2 candidate:
  either per-language graphs (extraction per language) or translated anchor
  rendering at the realizer.
- **Evidence now**: EXP-A-06 measured structure fully language-invariant
  with full-surface language switching; anchors stay EN (verified live).
  The architecture is sound; the question is editorial (is code-switching
  acceptable for the lab's research goals?).
- **Default posture**: DOCUMENTED boundary for v1; decide with W3's
  language needs (if any). Low priority unless multi-language output
  becomes a research line.

## Wave mechanics (pre-agreed)

- ONE `CONTRACTS_VERSION` bump; one breaking wave after W3 lands
  (H-1 ruling), regenerating canonical fixtures + fingerprints + red
  mutants in the same change.
- Every included candidate cites its evidence record (EV-xxx) in the wave
  commit message.
- The EXP-A runner (`experiments/run-exp-a.ts`) is the regression harness:
  its per-arm media hashes must be reproduced byte-identically after any
  candidate that claims diff-semantics-only changes (C-5).

---

# ADDENDUM 2026-09-28 (TL #2) — post-W3 / post-P3A / post-LAB decision inputs

Status: W3 MERGED (PR #6, EV-007); P3A MERGED (PR #7, EV-008); EXP-A
re-baselined under the fixed Director (836aead); LAB series EXECUTED
(EV-009). The register below updates every open decision input and adds
the new candidates from the merged surfaces + the real-product probes.

## Resolved decision inputs

- **C-5's "Decision inputs from W3" — RESOLVED: the video surface shares
  the plan-global keying.** `src/video/storyboard/compiler.ts` keys every
  stochastic choice on `${seed}|${planHash}|${mode}|${scene.id}` (line
  480): the scene.id is unit-local, but the planHash is plan-global — a
  one-claim change reshuffles every scene's seeded choices, exactly the
  audio defect class. **C-5 must cover BOTH surfaces in the one wave**
  (audio realizer key derivation + video storyboard key derivation), with
  the EXP-A runner AND the video determinism benchmark as the regression
  harnesses (byte-identical full-artifact hashes must reproduce).
- **C-5 posture nuance from LAB-05/LAB-06 (EV-009): the real product has
  NO turn-local stability either** — it globally re-plans on any change
  (mutation or mere re-run: title/duration/hook all differ on identical
  input). C-5's value is OUR lab's diff hygiene and the
  smallest-unit-regeneration architecture rule (AGENTS.md), NOT product
  parity. Keep INCLUDE posture; cite EV-009 alongside EV-006 in the wave
  commit.
- **C-4 input unchanged**: no W3 golden-reference turn-taking annotation
  landed; LAB-01/02 ASR samplings show inter-host acknowledgment tokens
  ('Exactly', 'Yeah') at high cadence — supports the candidate but is not
  the annotation evidence the H-3 ruling requires. Stays out of v2.

## New candidates

### C-7 — shared turn-rate/mass-budget contract surface (from P3A handoff 1)

- **What**: expose the turn rate model + anchor mass budgets in the shared
  contracts so the Director and W2 consume ONE authoritative rate model
  (today `TURN_PLANNING_RATE_WPS` and `FACTUAL_TURN_PURPOSES` in
  src/director/compiler.ts are documented mirrors of W2-internal constants
  in src/audio/modes/* and src/audio/dialogue/types.ts).
- **Evidence**: EV-008 — the mirror is conservative today (2.5 wps vs the
  tightest mode ceiling 2.87 wps), but a W2 retune could silently widen
  the gap. LAB-03 adds product-truth: the real Length control scales
  per-topic depth within rate ceilings — a shared rate model is the
  contract-level surface for that behavior.
- **Default posture**: INCLUDE (small, well-evidenced, one authority).

### C-8 — video narration field + motion params + narration routing (from W3 handovers)

- **What**: (a) VideoScene per-scene narration text (today narration lives
  in W3's own IR keyed by narrationRef); (b) SceneMotion/SceneTransition
  params vs StyleBible-held durations; (c) narration routing to the W2
  voice surface.
- **Evidence**: EV-007 handover items; (c) is the Phase 3 integration core
  (p3b scope — its cross-modal IR compliance task will surface the real
  shape).
- **Default posture**: WAIT for p3b's cross-modal IR delivery; adjudicate
  (a)/(b) with its HANDOFF entries in the same ruling.

### C-9 — styleBibleVersion emission in video artifact manifests (from the post-W3 reproducibility audit)

- **What**: src/video/artifacts.ts does not emit STYLE_BIBLE_VERSION in
  the GeneratedArtifact manifest (reproducibility metadata checklist item).
- **Evidence**: TL audit 2026-09-28 (e8ea606) — manifests carry
  contractVersion + per-stage provider identities but not the style bible
  version; STYLE_BIBLE_VERSION='1.0.0' exists in src/video/style-bible.ts.
- **Default posture**: INCLUDE (mechanical, rides the version bump).

### C-10 — brief-mode monologic restructure (from LAB-02 product truth)

- **What**: the real Brief is a SINGLE narrator with enumerated structure
  (First/Second/Finally, ~1.5 min); our brief skeleton is a fixed 10-turn
  two-speaker dialog. Candidate: monologic brief mode (single speaker,
  enumeration markers) in the v2 mode-semantics surface.
- **Evidence**: EV-009 LAB-02 (93.92 s single-voice Brief on the same
  source vs our 120 s 10-turn dialog).
- **Default posture**: DOCUMENTED candidate — decide with the v2 wave
  scope ruling (it changes canonical fixtures + brief mode semantics;
  the strongest product-truth delta in the register).

## Standing inputs (unchanged)

- C-1 (stance flags): wait for p3b cross-modal scene-typing needs.
- C-2 (evidence enforcement): wait for the p3b cross-modal QA measurement.
- C-3 (doc-only): rides the bump as a version-stamped note.
- C-6 (language-bound graphs): LAB-04 confirms the real product does
  NATIVE regeneration (not anchor code-switching) — raises the editorial
  priority if multi-language output becomes a research line; default
  unchanged.

---

# RULING 2026-09-29 (TL #2) — the v2 wave scope (all decision inputs in)

Inputs now complete: P3B delivered (PR #8 EV-010 cross-modal IR + HANDOFF 1
adjudication; PR #9 EV-011 EXP-V-04 run evidence + EXP-D-01 + provider
matrix). Ruling per candidate:

## IN the wave (one branch, one CONTRACTS_VERSION bump 1.0.0 → 2.0.0)

- **C-5 — per-unit content-keyed seeding, BOTH surfaces.** Strongest
  evidence in the register: EV-006 (EXP-A-04: 21/25 texts reshuffled on a
  one-paragraph mutation), EV-011 (EXP-V-04: 9/12 scene SVGs reshuffled,
  structure 0/12 — the same plan-global planHash defect class confirmed
  WITH RUN EVIDENCE on the video surface), EV-009 (LAB-05/06: the real
  product has no turn-local stability — C-5 is OUR lab's diff hygiene and
  the AGENTS.md smallest-unit-regeneration rule, not product parity).
  Scope: audio realizer keys (src/audio/dialogue/text/realizer.ts
  `seed|planHash|turnId|slot`) + audio timing gap keys (src/audio/timing/
  timing.ts `seed|planHash|gap-N|boundary`) + video storyboard keys
  (src/video/storyboard/compiler.ts `seed|planHash|mode|sceneId`) — each
  re-keyed on the OWNING unit's local content hash (turn brief + anchors /
  gap-adjacent turn content / scene brief + anchors + exactTexts).
  planHash STAYS in identification surfaces (graph meta, artifact ids,
  manifests, plan fingerprints) — it is plan-global BY DESIGN there.
- **C-7 — shared turn-rate/mass-budget contract surface** (EV-008, LAB-03):
  the authoritative rate model moves into src/contracts/; Director + W2
  consume ONE source. Additive module; values identical at landing
  (2.5 wps mirror) so no output change from C-7 alone.
- **C-9 — styleBibleVersion emission** in src/video/artifacts.ts
  (mechanical; post-W3 audit e8ea606 + p3b wave-1 pinned the gap with a
  test — the test flips to asserting PRESENCE after the emission lands).
- **C-10 — monologic brief mode** (EV-009 LAB-02: the strongest
  product-truth delta — 93.92 s single-voice enumerated Brief vs our
  120 s 10-turn two-speaker dialog). Director brief skeleton + W2 brief
  mode semantics + brief canonical fixtures regenerate together.
- **C-3** rides the bump as the version-stamped note (doc-only, closed).

## OUT of the wave (each with its recorded reason)

- **C-8 (video narration field / motion params / dual-modality plan shape):
  DEFERRED to the post-v2 line.** Its adjudication input — p3b's
  cross-modal IR delivery — came back ruling the v1 modality-exclusive plan
  DELIBERATE and compliant at the shared-spine level (HANDOFF 1, pinned by
  tests); EXP-D-01 delivers the dual-modality comparison the roadmap needed
  through the current shape. A dual-modality plan restructure has no
  blocking evidence; it is the designated v3 candidate with EV-010/EV-011
  as its standing inputs.
- **C-1 (stance flags)**: p3b surfaced no scene-typing need (cross-modal
  tests ground claims without them) — deferred again; structural path
  proven sufficient.
- **C-2 (evidence enforcement)**: the fallback-fire rate remains unmeasured
  (EXP-A arms + cross-modal tests all clean on canonical fixtures) —
  deferred unless a future measurement is material.
- **C-4 (interjection)**: still no golden-reference annotation — out.
- **C-6 (language-bound graphs)**: documented v1 boundary; priority rises
  only if multi-language becomes a research line.

## Corrected wave mechanics (honest correction of the C-5 draft note)

The draft claimed "existing committed fingerprints stay valid (the key
change is invisible to a full recompile of the same plan)". That is LOOSE:
re-keying changes the PRNG stream for every draw, so same-plan outputs
CHANGE ONCE at the wave boundary and committed fingerprints (audio
benchmarks, EXP-A artifacts, video benchmark manifests, realized-text test
pins) REGENERATE in the same change — exactly what the pre-agreed mechanics
clause prescribes ("regenerating canonical fixtures + fingerprints + red
mutants in the same change"). What C-5 preserves is determinism WITHIN a
contract version (same plan + same seed → byte-identical outputs, verified
by double-run) and the IMPROVED DIFF semantics across plan mutations
(unchanged units keep their surfaces — verified by EXP-X-02's treatment
arm: non-target turns byte-identical). EXP-X-02 (control v1 vs treatment
C-5, per docs/experiments/design-exp-x-02.md) executes AFTER the wave lands
on main, as its verification experiment.

Wave landing shape: ONE branch (work/wflx-v2-contract-wave), sequential
worker waves per ownership (audio surface → video surface → Director +
fixtures), TL-direct contracts/version pieces interleaved, ONE station
review, ONE merge, ONE version bump. Every included candidate cites its
EV record in the wave commits.
