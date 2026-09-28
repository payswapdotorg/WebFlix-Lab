# TL #2 Roadmap Status — live position

Updated: 2026-09-28 20:20 UTC by TL #2 — Phase 3 core fix P3A MERGED (PR
#7, 0ecd561, EV-008): Director turn-budget allocation fixed (zero
over-budget on canonical plans + compression arm); station gates 338/338.
WFLX-P3B (cross-modal integration + experiment series) DISPATCHED 20:15 UTC
(session be5d9368) and generating. LAB series UNBLOCKED — operator Google
login present in the replay browser; LAB-01 probe starting.

This file is the operator-visible progress surface for the work order in
`tl2-work-order.md`. It is updated by the TL between merges; the commit
history plus `docs/evidence/registry.jsonl` remain the durable record.

## Phase position

| Phase | State | Evidence |
|---|---|---|
| 0 — bootstrap / reference access | COMPLETE | EV-000, EV-001, EV-002 (golden video served-variant in repo, provenance recorded) |
| 1 — W1 contracts + director | COMPLETE | PR #2 (ed6ffec), PR #4 (50e8161); station gates 128/128; EV-003 |
| 2A — W2 audio | COMPLETE | PR #3 design (eaa1eea), PR #5 stage-2 implementation (c90bd48); gates 237/237; EV-004; HANDOFFs adjudicated (1444e10) |
| 2B — W3 video | **COMPLETE** | PR #6 merged (ba60a36, EV-007): StyleBible v1.0.0, storyboard compiler, deterministic SVG renderer, illustration/motion provider ports, compositor (Remotion primary + sealed offline fallback), QA pass 0 issues both benchmarks; station gates 332/332 (251 baseline + 81 video); determinism spot-check clean; credential sweep clean |
| 3 — TL integration | IN FLIGHT | Prep done (checklist 20cd14d; H-2 fixtures 9128369/EV-005; H-4 docs e6a9b17; EXP-A series EV-006; experiment registry + provider matrix live; v2 contract draft 9ec6521; station-review automation 95b0b9d). **P3A Director turn-budget fix MERGED (PR #7, 0ecd561, EV-008): anchor-mass-aware allocation, zero turn-over-budget on all canonical modes + the 180 s compression arm; canonical fingerprint transition documented (3 plans + s15/s16/s17 mutants re-pinned); station gates 338/338; determinism proven; credential sweep clean.** WFLX-P3B (cross-modal integration + experiment series, checklist §2) DISPATCHED 20:15 UTC (session be5d9368, GLM-5.3, Full-Stack). EXP-V + EXP-X-02 run + cross-modal IR tasks are p3b/TL scope |
| 4 — promotion gate | PENDING | Inputs collected throughout; no promotion without TL evidence sign-off |

## Current position (honest state)

**The 9/27-9/28 platform outage is OVER** (root-caused 9/28 ~14:00 UTC as a
read-path regression: chat-detail API stopped embedding message content;
assistant replies existed but read as empty — every DOWN verdict after the
chat queue recovered midday 9/27 was a false negative; agents queue
recovered 9/28 ~13:56). Residual: intermittent GLM-5.3 capacity events
(17:11-18:16 UTC window observed) that admit ONE agent generation per
account — worker dispatches run as SEQUENTIAL waves; the wave watch +
continue loops + station-review chain enforce the cycle
monitor -> harvest -> station review -> merge -> dispatch next.

W3 recovered from a mid-delivery turn-death (capacity event) via
context-correcting continuation; delivered 18:28 UTC; PR #6 merged
(ba60a36). P3A (fresh session 9178a7ce after the capacity-event reap of
53e2d8c8) ran ~1 h and DELIVERED 19:45 UTC: PR #7, root cause documented
(three duration-blind steps in the audio-turn construction), honest-gap
test flip, 338/338 gates, byte-identical double-runs, EV-008 registered.
Station review APPROVED (scope OK, no src/contracts changes); merged
20:07 UTC (0ecd561). P3A HANDOFF entries pending TL adjudication in the
v2 contract wave: (1) shared rate-model/mass-budget contract surface,
(2) EXP-A re-run under the fixed Director (artifacts reflect pre-fix
behavior), (3) EXP-A-05 skeleton-invariant + speaking-rate re-baseline.

Remaining platform-gated: none. Operator-gated: the LAB series (§3)
required Google login at notebook.google.com — **LOGIN NOW PRESENT**
(2026-09-28 ~19:55 UTC, operator confirmed in the replay browser); the six
pre-staged probes (LAB-01..06 per docs/experiments/lab-series-runbook.md,
priority LAB-01 > LAB-05 > LAB-02 > LAB-06 > LAB-04 > LAB-03) run as
TL-driven browser work in parallel with the P3B worker wave.

## Wave plan (standing directive: until roadmap complete, no early returns)

1. WFLX-P3B (session be5d9368) is generating — the wave watch (90s cycles,
   batch-truth + DOM + git signals) flags delivery; on stall the continue
   protocol re-fires context-correcting continuations.
2. On P3B delivery: harvest (server-side batch read) →
   `scripts/station-review.sh <branch> <pr>` → approve/require-changes →
   merge → EV record → TL-owned Phase 3 remainder (EXP-V records landing,
   EXP-X-02 run, cross-modal IR checks per checklist §2) as worker waves
   or TL-direct commits per ownership; P3A HANDOFFs adjudicated in the v2
   contract wave.
3. LAB series (TL+operator browser work, parallel to the P3B wave):
   LAB-01 golden Deep Dive Audio capture first, then the priority order —
   each run lands a docs/experiments/records/LAB-XX.yaml per the protocol.
4. Phase 4 promotion gated on LAB-series real-reference evidence +
   TL evidence sign-off.
