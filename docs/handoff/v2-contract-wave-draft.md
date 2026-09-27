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
