# v3 Line Ruling — C-8 Dual-Modality Plan Shape

Status: RULED by TL #2, 2026-10-03 (the v3 line, post-parity-close; the
operator's 2026-10-03 re-anchor — this repository is the sole source of
truth). Binding for the v3 line.

Reference: docs/promotion/promotion-decision.md (the standing follow-up
ledger: "C-8 dual-modality plan shape with EXP-D-01 standing inputs");
EV-010 / EV-011 (docs/evidence/registry.jsonl); EXP-D-01
(docs/experiments/records/EXP-D-01.yaml); EV-014 (EXP-X-02, the landed
C-5 verification); docs/handoff/v2-contract-wave-draft.md (the v2-wave
precedent this document follows).

Labels per AGENTS.md. This is a lab architecture decision, not a product
claim; product-behavior questions stay HYPOTHESIS/UNRESOLVED until
observed.

## The question (C-8, as designated by the PROMOTE ruling)

Should the OverviewPlan contract become **dual-modality** — one plan
instance carrying BOTH `audioTurns` and `videoScenes`, consumable by both
pipelines — or does the **modality-exclusive** plan shape (each plan
instance exactly one modality; the cross-modal contract living at the
shared-spine IR level) stand as the lab's architecture law?

## Standing evidence (consolidated — the ruling is a decision, not an investigation)

- **EV-010 (REPRODUCED)**: the frozen v1 OverviewPlan is modality-exclusive
  by typed cross-field checks — audio plans REQUIRE `audioTurns` and MUST
  NOT carry `videoScenes`, video plans the inverse
  (`src/contracts/overview-plan.ts`); each surface hard-rejects the other
  modality with a typed error (AudioCompilerError `audio-modality` /
  VideoCompilerError `video-modality`, asserted). The WFLX-P3B checklist's
  "SAME frozen OverviewPlan instance" wording was satisfied at the
  shared-spine level instead — HANDOFF 1, adjudicated by the promotion
  ruling as DELIBERATE and compliant.
- **EXP-D-01 / EV-011 (REPRODUCED)**: the dual-modality comparison the
  roadmap needed was DELIVERED through the current shape — same (source,
  graph, seed, 300 s) compiled through both surfaces as two per-modality
  Director plans: identical accounted/covered claim sets (11/11) across
  modalities, each surface realizing its own deterministic QA profile
  (audio: turn/timing/loudness; video: scene/alignment/grounding).
  Coverage economics are **modality-native**: audio voiced 11/11 claims,
  video visualized 7/11 (64%) at the same editorial budget — recorded as
  surface cost truth, not a defect.
- **C-5 LANDED (v2 wave; EV-014 / EXP-X-02, REPRODUCED)**: per-unit
  content-keyed seeding is in force — a one-claim change regenerates the
  smallest unit (B-treatment 1/22 texts / 1/22 audio segments vs A-control
  17/22 texts / 21/22 gaps). Mutation locality at the SURFACE layer is
  protected. Note precisely what this does and does not protect: surface
  text/segment locality, not plan-STRUCTURE locality — the plan skeleton
  is still one Director output per plan instance.

## The decision calculus

**What a dual-modality plan would add** (the honest benefit register):

1. One plan object as a first-class artifact covering both surfaces — a
   namespace/deliverable convenience (one JSON to point at).
2. Nothing else measured: cross-modal editorial consistency is already
   enforced at the spine (EXP-D-01: identical accounted/covered claim
   sets), and per-surface QA already evaluates each realization.

**What it would cost** (the honest cost register):

1. A breaking `CONTRACTS_VERSION` wave: the cross-field checks, both
   surface compilers, the Director, and every consumer of the plan shape
   change together (the v2-wave consolidated-change law — never two
   breaking waves where one suffices, and this one has no enabling
   feature behind it).
2. **Coverage-accounting falsification risk**: the surfaces have
   measurably different per-claim costs (11/11 voiced vs 7/11 visualized
   at the same 300 s budget — EXP-D-01, REPRODUCED). A single plan must
   either carry per-modality coverage sections — which recreates the
   current two-plan shape inside one object, at full rewrite cost and no
   new capability — or collapse to one shared accounting, which would
   falsify at least one surface's coverage truth. Neither branch buys a
   capability the spine does not already deliver.
3. **Re-plan granularity coupling**: the Director would emit both
   surfaces' structures in one pass, so any single-surface refinement
   re-plans BOTH surfaces' skeletons. C-5 protects surface-text locality
   only; plan-structure locality would regress from per-modality
   (independent) to coupled. This moves AGAINST the AGENTS.md
   smallest-regenerable-unit architecture rule, which C-5 just landed to
   satisfy.
4. **No v3 feature requires it**: the v3 line's actual work — the
   multi-source extractor consistency (WFLX-V3A, in-flight) and the
   EXP-V-05/06 honest re-runs — operates BELOW the plan layer, in the
   source/graph spine. The one dual-modality deliverable ever asked for
   (the cross-modal comparison, Phase 3 §2 item) is complete through the
   current shape.

## RULING

**C-8 stays OUT. The modality-exclusive plan shape is the lab's
architecture law for the v3 line.**

- The **shared spine** — source, SemanticGraph, seed, claim universe,
  coverage accounting — is the cross-modal contract (EXP-D-01 REPRODUCED:
  identical accounted/covered claim sets across surfaces).
- **Per-modality Director plans are surface realizations of that spine**,
  and the typed modality-exclusion checks are deliberate (EV-010): they
  keep each plan instance honest about exactly one surface's structure
  and coverage truth.
- A dual-modality plan restructure is **REJECTED with recorded reasons**
  (no enabling feature; modality-native coverage economics; re-plan
  granularity coupling against the smallest-unit law; a breaking wave
  with no capability gain). This closes the C-8 ledger line from the
  promotion decision as **ADJUDICATED-OUT (v3)**, with this document as
  the pointer.
- **Revisit trigger (recorded, not scheduled)**: a future feature that
  requires one-plan-both-surfaces as a first-class artifact — e.g.
  OBSERVED product behavior where a single product plan object
  demonstrably drives both output modalities in one generation pass.
  Absent that observation, the question does not reopen. Lab-side
  convenience alone is not a trigger.

## Dispositions of the other standing v3 follow-ups (from the PROMOTE ruling)

- **EXP-V-05/06 multi-source extractor consistency**: IN FLIGHT — the
  WFLX-V3A worker (the BlockIndex pair-keying root-cause fix + sibling
  namespace audit + the honest record-flip re-runs per the HANDOFF law).
- **Compositor encoder nondeterminism**: stays **excluded-by-rule**
  (composition pinned by content fingerprint; raw MP4 bytes never
  recorded) — unchanged.
- **C-1 / C-2 / C-4 / C-6**: stay **OUT with recorded reasons**
  (promotion decision §"unresolved ledger") — unchanged.
- **Interactive Audio product capture (AUDIO-PARITY-08)**: stays
  **OPERATOR-GATED** — the ask stands in the operator outbox; the TL
  fills the comparison record mechanically when the capture lands.

## Consequences for the v3 lane

- No contract wave is scheduled for C-8; `CONTRACTS_VERSION` stays.
- The v3 line's energy concentrates on the multi-source spine (V3A) and
  the honest experiment re-runs; the plan layer is ruled stable.
- This document is TL-owned (the shared-contracts ownership law); no
  worker scope is created by this ruling.

**TL #2 (resident orchestrator, payswapdotorg/WebFlix-Lab integration
station) — 2026-10-03.**
