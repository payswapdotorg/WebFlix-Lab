# TL #2 Roadmap Status — live position

Updated: 2026-09-29 08:25 UTC by TL #2 — P3B COMPLETE (both waves merged).
Wave 1 (PR #8, 43b21df, EV-010): cross-modal IR compliance (shared-spine,
HANDOFF 1 adjudicated), unified artifact manifest registry (13 records),
reproducibility metadata, local refinement loop. Wave 2 (PR #9, 49306bc,
EV-011): integration experiment runner + 15 records (EXP-A-01..06-R2 under
the fixed Director, EXP-V-01..08 storyboard ablations, EXP-D-01 dual-
modality comparison), provider-matrix cross-surface exercise log, packet
determinism proof (identical digest pair bc95eb72…, 160 files). KEY FINDING
(OBSERVED): compositor raw MP4 renders are encoder-nondeterministic across
identical invocations — content-fingerprinted, excluded from the digest set
by rule. V-05/V-06 multi-source arms BLOCKED honestly (Deterministic-
Extractor inconsistent graph — HANDOFF to the source-surface wave). Gates on
main: 352/352. Checklist §2 = ALL EIGHT ITEMS ticked.

Next: v2 contract wave execution (C-5 per-turn content-keyed seeding on BOTH
surfaces — run-evidence confirmed on video by EXP-V-04; C-7 shared rate
model; C-8 dual-modality plan shape; C-9 styleBibleVersion emission; C-10
monologic brief) + EXP-X-02 (control vs C-5 treatment arms per
docs/experiments/design-exp-x-02.md) — then Phase 4 promotion assembly and
TL evidence sign-off.

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
| 3 — TL integration | CORE COMPLETE (both p3b waves merged) | Prep done (checklist 20cd14d; H-2 fixtures 9128369/EV-005; H-4 docs e6a9b17; EXP-A series EV-006; experiment registry + provider matrix live; v2 contract draft 9ec6521; station-review automation 95b0b9d). **P3A Director turn-budget fix MERGED (PR #7, 0ecd561, EV-008): anchor-mass-aware allocation, zero turn-over-budget on all canonical modes + the 180 s compression arm; canonical fingerprint transition documented (3 plans + s15/s16/s17 mutants re-pinned); station gates 338/338; determinism proven; credential sweep clean.** WFLX-P3B (cross-modal integration + experiment series, checklist §2) DISPATCHED 20:15 UTC (session be5d9368, GLM-5.3, Full-Stack). EXP-V + EXP-X-02 run + cross-modal IR tasks are p3b/TL scope |
| 4 | Promotion gate: evidence package + TL sign-off | COMPLETE — TL SIGNED PROMOTE 2026-09-30 (PR #10, f43b08d) |

## Current position (honest state)

**2026-09-30 ~01:00 UTC — WFLX-V2-3 (final wave) update.** The v2 contract
wave is FULLY EXECUTED on `work/wflx-v2-contract-wave`: sub-wave 1 (C-7,
CONTRACTS_VERSION 2.0.0 + C-3 note, C-5 both surfaces, C-9), sub-wave 2
(C-10 monologic brief + the one-change fingerprint transition that
regenerated every invalidated committed fingerprint with double-run
byte-identity proofs), and now the final wave: **EXP-X-02 executed
(EV-014)** — the ruling's designated verification experiment, per
docs/experiments/design-exp-x-02.md. B-treatment (C-5 keying, wave HEAD):
the single-turn refinement edit changed exactly 1/22 realized texts,
1/22 per-turn audio segments and 2/22 target-adjacent gaps, turned the
failing turn's gate to 0 over-budget (station quality bar PASSED), with
total-duration accounting exact (+7806 ms = target +8000 ms + adjacent
gaps −194 ms + 0 elsewhere); A-control (v1 planHash keying, git worktree
at the pinned 720f984): the SAME edit reshuffled 17/22 texts + 21/22 gaps
(the EXP-A-04 class). All four design-note falsifiers checked — none hit.
Whole-artifact determinism double-run-proven on every plan; two full
runner invocations reproduce the persisted artifacts byte-identically
(wall-clock fields excepted, recorded as measured). Honest adaptations,
documented in the record: post-EV-008 canonical plans compile with zero
over-budget turns, so the loop's failing turn is introduced via the
established single-turn mutant class; the note's e.g. word-count-cap
brief edit maps onto the rate model's duration lever (anchors are
verbatim claims); the TL sequencing decision runs the treatment arm
pre-merge on the branch HEAD (identical tree to post-merge main —
strictly safer, same evidence value). Gates on the branch: typecheck 0
errors, lint clean, 370/370 chunked (151+123+82+14; branch baseline was
370 before EXP-X-02 — no regressions, the experiment adds harness-level
falsifier checks instead of tests). The Phase 4 promotion package is
ASSEMBLED (EV-015): docs/promotion/ with the six evidence classes, every
claim labeled + pointed, TL SIGN-OFF block left PENDING for TL #2. The
manifest registry was rebuilt at the wave boundary (24 audio / 27 total,
including the three EXP-X-02 runs). NOTHING here is a promotion decision:
the TL audits the package, signs the verdict, and owns PR/merge. Branch
pushed for TL review; no PR opened, main untouched, prior commits
unrewritten.

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

Remaining platform-gated: the agents-queue capacity event blocking P3B's
generation start (reaps; auto-recover re-dispatches, counter-tracked).
Operator-gated: NONE — the LAB series (§3) operator gate CLEARED 2026-09-28
(Google login + VPN egress; six probes EXECUTED, EV-009; records in
docs/experiments/records/LAB-*.yaml; artifacts under artifacts/reference/).
Real-product reference evidence for Phase 4 is now PRESENT in the promotion
package skeleton.

## Wave plan (standing directive: until roadmap complete, no early returns)

1. WFLX-P3B is dispatch-cycling through an agents-queue capacity event —
   the wave watch + reap auto-recover (one-shot counter) re-dispatch until
   generation starts; then batch-truth + DOM + git signals flag delivery.
2. On P3B delivery: harvest (server-side batch read) →
   `scripts/station-review.sh <branch> <pr>` → approve/require-changes →
   merge → EV record → TL-owned Phase 3 remainder (EXP-V records landing,
   EXP-X-02 run, cross-modal IR checks per checklist §2) as worker waves
   or TL-direct commits per ownership; P3A HANDOFFs adjudicated in the v2
   contract wave.
3. ~~LAB series~~ COMPLETE (EV-009): golden Deep Dive 20:01; mode variants
   Brief 1:33 / Critique 16:59 / Debate 17:29 (restructure-not-reskin);
   Short 5:18 (3.78x depth compression, structure preserved); español
   17:14 (native regeneration, skeleton invariant); b30 mutation 23:52
   (global re-plan, mutation voiced); twin 22:02 (run-to-run stochasticity —
   macro pattern is the only stable layer). Key product-truth deltas vs our
   lab: real product is surface-stochastic (vs our byte-determinism),
   globally re-plans on ANY change (vs our plan-local mutation), compresses
   depth not coverage (vs our salience-omission) — feeds C-5 and the v2
   seeding philosophy.
4. Phase 4 promotion gated on: p3b delivery (integration core) + dual-modality
   comparison + TL evidence sign-off against the promotion package (LAB
   real-reference evidence now PRESENT).

## 2026-09-30 — ROADMAP COMPLETE (TL #2 closing entry)

- v2 contract wave executed + station-approved through three worker waves
  (WFLX-V2-1/-2/-3, agents-tab GLM-5.3 Full-Stack, dispatched from inside
  the replay per the standing operator directive): sub-wave 1 (bump 2.0.0 +
  C-7 + C-5 both surfaces + C-9 + fingerprint transition, 6 commits),
  sub-wave 2 (C-10 monologic brief + regeneration, 2 commits), final wave
  (EXP-X-02 execution + Phase 4 package, 3 commits) — all on
  work/wflx-v2-contract-wave, each station-reviewed (scope/gates/
  credentials/determinism) before the next dispatch.
- EXP-X-02 (EV-014): all four falsifiers PASS, station quality bar PASSED,
  TL re-execution reproduces the record exactly (A-control 17/22 vs
  B-treatment 1/22 changed units; +7806 ms accounting exact).
- Phase 4 promotion package (EV-015): evidence classes (a)–(f) assembled;
  TL #2 SIGNED — verdict PROMOTE (docs/promotion/promotion-decision.md
  sign-off block, gates re-verified 370/370 + exp:x02 TL re-run).
- Gates at the signed HEAD: typecheck 0 errors; lint clean; 370/370
  (151+123+82+14); packet digest pair byte-identical at both wave
  boundaries (0f437fb4… sub-wave 1; 6b60d5be… sub-wave 2, TL double-run).
- Standing follow-ups (v3 line, owned by the ledger in
  docs/promotion/promotion-decision.md class (f)): C-8 dual-modality plan
  shape, EXP-V-05/V-06 multi-source extractor, encoder exclusion by rule.

## 2026-09-30 21:35 UTC — PARITY COMPLETION PHASE OPENED (TL #2, operator handoff)

- Operator's Final TL #2 Handoff received: R&D roadmap COMPLETE, product parity NOT —
  next phase = Parity Completion Phase (canonical work order:
  docs/work-items/parity-completion-work-order.md). Frozen architecture; three
  replay-sequential waves WFLX-P1 (audio parity: live TTS execution + benchmarks +
  Interactive Audio prototype) / WFLX-P2 (video parity: Explainer refresh + Short +
  Cinematic asset pipeline) / WFLX-P3 (fresh real-product reference/benchmark
  captures, operator-gated) → cross-modal QA → parity promotion gate (TL-owned).
- Doc-consistency fix applied with this commit: the stale Phase 4 table row above
  (leftover PENDING wording from pre-sign-off drafting) is corrected to match the
  signed truth — Phase 4 COMPLETE / TL SIGNED PROMOTE (PR #10, f43b08d).
- Phase-level acceptance gates added (work order §4): every capability VERIFIED or
  EXPLICITLY UNRESOLVED with evidence; live-provider results must be real, never
  simulated-as-real.