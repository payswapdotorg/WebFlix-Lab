# Phase 4 — Promotion Package (SKELETON, pre-staged)

Status: DRAFT skeleton pre-staged by TL #2 during the 2026-09-27 platform
outage window. Every TBD is an input that must EXIST (with an EV record)
before TL #2 evidence sign-off. No section here may be promoted from
skeleton to final without its evidence input landing first (AGENTS.md
labeling discipline applies: OBSERVED / DOCUMENTED / HYPOTHESIS /
REPRODUCED / UNRESOLVED).

## 1. Real-reference comparison evidence

- Golden reference video: IN REPO (served variant, EV-002; original pin
  preserved in the manifest awaiting operator file). [PRESENT]
- Dual-modality comparison vs reference: TBD (Phase 3 checklist §2 item 5).
- LAB black-box notebook series: TBD — blocked on operator Google session
  + notebook URL (wiped by the 2026-09-27 06:15 sandbox recycle).

## 2. Implementation artifacts

- W1 contracts + director: merged (PR #2, PR #4; EV-003). [PRESENT]
- W2 audio compiler: merged (PR #3, PR #5; EV-004). [PRESENT]
- W3 video pipeline: TBD (Phase 2B in flight).
- Phase 3 integration core: TBD (p3b work order pre-staged).

## 3. Benchmark results

- Audio determinism benchmark: present (W2 stage 2, hash-pinned). [PRESENT]
- Video determinism benchmark: TBD (W3 delivery).
- Audio-surface ablation series EXP-A-01..06: EXECUTED 2026-09-27 (EV-006;
  9 deterministic arms + byte-identical spot-check; records in
  docs/experiments/records/, structured twin artifacts/audio/exp-a/). [PRESENT]
- Video-surface ablations EXP-V: TBD (W3).
- Cross-modal (EXP-X): TBD (p3b / v2 wave).

## 4. Costs + latency

- Provider matrix: DOCUMENTED (docs/reference/provider-matrix.md, EV-006)
  — capability + determinism columns for every audio provider lane; video
  lanes PENDING W3. [PRESENT]
- Costs: all lab paths to date run the offline deterministic provider
  (zero-cost, honestly labeled — not product-parity evidence); real-adapter
  cost rows land only if/where an optional real adapter is exercised
  (Gemini TTS live dispatch remains UNRESOLVED pending TL credential
  wiring). Latency: run-specific measurements are recorded honestly in
  benchmark-run.json (W2) — not byte-reproducible by design.

## 5. Failure modes

- Known + documented so far: turn-over-budget Director allocation
  (EV-005 — fix pre-staged as p3a; COMPOUNDING evidence from EXP-A-05:
  over-budget errors rise 4 -> 11 under 180 s compression, EV-006);
  keyword-heuristic canonical gap (EV-005, H-1 documented); planHash notes
  sensitivity (EV-005); seeded-surface non-locality under source mutation
  (EXP-A-04 / EV-006: structure perfectly local, surfaces globally
  reshuffled via the plan-global planHash key — v2 wave candidate C-5,
  blocks true smallest-unit regeneration / EXP-X-02).
  TBD: video-surface failure modes (W3), integration failure modes (p3b).

## 6. Security and authorization posture

- Reference access runbook followed; no credentials/auth state in repo
  (verified per PR gate on every merge). [PRESENT]
- Worker delivery protocol: transient PAT, never persisted. [PRESENT]
- TBD: final sweep at promotion time.

## 7. Unresolved gaps

- Live (non-stub) Gemini TTS dispatch: UNRESOLVED (W2 stage 2, deferred
  pending TL credential wiring decision).
- Original reference video pin: UNRESOLVED (operator file pending).
- v2 contract wave: planned post-W3 (single consolidated wave).
- Everything TBD above.

## 8. WebFlix integration design

- TBD: how this lab's Overview Studio surfaces integrate into the WebFlix
  product. Blocked on Phase 3 outcomes; design notes live in
  `docs/overview-studio-architecture.md` (read first; do not duplicate).

## Sign-off

No production promotion without TL #2 evidence sign-off against THIS
package with every TBD resolved or explicitly accepted as a gap by the
operator.
