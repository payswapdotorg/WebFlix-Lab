# HANDOFF Adjudications — Wave 1 (W2 Stage 2 entries)

Status: ADJUDICATED by TL #2, 2026-09-27. Binding rulings for Phase 3.
Reference: W2 Stage 2 completion report (PR #5, merged c90bd48);
`src/audio/DESIGN.md` §15/§16.4.

Labels per AGENTS.md. These rulings are lab design decisions (not product
claims); product-behavior items stay HYPOTHESIS/UNRESOLVED until EXP-A/V
evidence lands.

## H-1 (carried §16.4-1) — contestedness / stance / gap flags on ClaimRecord

**Ruling: ACCEPTED, DEFERRED to the Phase 3 single contract-change wave.**

Adding fields to frozen ClaimRecord requires a `CONTRACTS_VERSION` bump and
touches all three surfaces. W3's needs are not yet known; one consolidated
v2 contract wave after W3 lands beats two breaking waves. Until then:
- W2's HYPOTHESIS-grade stance heuristics remain the audio-surface behavior.
- QA must keep labeling stance-derived structure as heuristic (no silent
  promotion), which W2 already does.

## H-2 (carried §16.4-2) — canonical per-mode plan fixtures (brief/critique/debate)

**Ruling: ACCEPTED — TL-owned task in Phase 3 integration.**

The Director (merged, W1) can emit per-mode plans; generating the canonical
fixtures is integration-station work (fixtures + fingerprints + red tests),
not new worker scope. W2's audio-local stand-ins remain labeled
non-canonical until replaced; EXP-A structural re-runs on canonical plans
are tracked as a Phase 3 exit criterion.

## H-3 (carried §16.4-3) — planning interjections/backchannels as turns

**Ruling: v1 KEEPS interjections as W2-realized in-text tissue + QA info
note. Revisit with evidence in Phase 4.**

Rationale: plan-authoritative turns (§16.2 item 1: W2 never adds/drops/
reorders turns) is the load-bearing determinism invariant; moving tissue
into the plan changes who owns naturalness. W3's golden-reference
annotation (turn-taking cues, OBSERVED) will supply the evidence base for
the Phase 4 decision. The canonical fixture's 19/22 strict-alternation
stretch and zero interjections stay honestly surfaced as QA issues feeding
back to the Director (already implemented by W2).

## H-4 (new) — CoverageEntry.unitIds may cite beats with no grounding turn

**Ruling: boundary semantics DOCUMENTED — beat-only coverage is legal at
the plan layer, and the audio QA coverage-gap ERROR at the audio boundary
is correct behavior, not a defect.**

A claim covered only by a beat is expressible in a valid plan (e.g.
video-pending or agenda-only material). The audio surface, which speaks
through turns, must treat it as a coverage gap. Action (TL, Phase 3):
document this boundary in `src/contracts/README.md` alongside the v2 wave;
no code change to W1 validation.

## H-5 (new, informational) — AudioTurn.evidence per-claim coverage unenforced

**Ruling: DOCUMENTED as a known approximation.**

W2's realizer fallback (graph-claim evidence when turn evidence is too
fragmentary) stays. Cross-modal QA in Phase 3 will measure how often the
fallback fires on canonical fixtures; if the rate is material, per-claim
evidence enforcement joins the v2 contract wave.

## Consolidated v2 contract-change candidates (post-W3)

1. ClaimRecord: contestedness/stance/gap flags (H-1)
2. Per-claim evidence enforcement on AudioTurn (H-5, if QA rate material)
3. CoverageEntry beat-vs-turn boundary doc (H-4 — doc-only)
4. Interjection turn type (H-3 — only with Phase 4 evidence)
