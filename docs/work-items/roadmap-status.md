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
## 2026-10-01 — WFLX-P1 AUDIO PARITY WAVE DELIVERED (WFLX-P1, branch work/wflx-p1-audio-parity)

Dispatched work order: docs/work-items/31-WFLX-P1-AUDIO-PARITY.md (first
commit, verbatim, dated 2026-09-30). Deliverables per the §4 gate
discipline — each dimension VERIFIED with numbers or EXPLICITLY UNRESOLVED:

- **Deliverable A — REAL live TTS execution path (EV-016, EXP-L-01):
  VERIFIED.** zai-live-tts adapter (src/providers/audio/zai-live.ts) over
  the server-side z-ai-web-dev-sdk (a REAL production TTS service),
  exercised END-TO-END through the unmodified SpeechProvider port +
  compile pipeline: 5/5 turns of the canonical 42 s benchmark plan as real
  playable speech (24 kHz mono WAV per turn + mixed master) under
  artifacts/audio/exp-l-01/. Env-gated WFLX_TTS_PROVIDER=live-zai (unset =
  offline default, zero behavior change); no credential material anywhere;
  provenance recorded (provider id + model id + voices + env flag; honest
  reproducible=false for live output). Falsifiers F1-F4 ALL PASS, incl. F4
  offline baseline byte-UNCHANGED (double-run + committed-benchmark sha
  equality). Usage/cost observables: the SDK TTS route reports none —
  UNRESOLVED, recorded. Live duration 61.755 s vs 42 s target: inside the
  pre-declared band [21, 84] s, with the systematic live-rate offset (1.88
  wps vs the planning prior) honestly flagged by QA.
- **Deliverable B — speech benchmark suite (EV-017, EXP-L-02): VERIFIED
  with one EXPLICITLY UNRESOLVED dimension.** Instrumented harness
  (experiments/run-exp-l-02.ts + src/audio/qa/acoustics.ts — pure-TS
  Goertzel LTAS; NO LLM self-assessment), 6 deterministic offline arms +
  a live real-speech measurement arm incl. a real ASR transcript check.
  Speaker consistency VERIFIED (SC1 config fingerprint everywhere; SC2
  LTAS on real speech within 0.140 / ratio 2.60; offline placeholder
  numbers retained as context — the proxy is speech-only, re-scope
  documented); pacing/pause VERIFIED (0 out-of-policy gaps; wps under
  every mode ceiling; live c/s in [6, 24]); pronunciation proxy: offline
  UNRESOLVED-by-medium (claim-voicing 11/11 VERIFIED), live label-token
  recovery 1/2 (50% < 60%) EXPLICITLY UNRESOLVED (n=2 tiny sample,
  TTS-vs-ASR ambiguity recorded); multi-language VERIFIED (the documented
  v1 EN-anchor boundary still holds on the ES arm); mode+duration VERIFIED
  (4 modes at canonical targets, over-budget honesty preserved). Harness
  calibration documented, not silent (band re-declaration; SC2 re-scope;
  a Goertzel precedence bug and a rectangular-window integer-bin flaw were
  exposed by the benchmark's own honest numbers and fixed under test).
- **Deliverable C — Interactive Audio Overview (EV-018, EXP-L-03):
  VERIFIED.** InteractiveAudioSession layer
  (src/audio/interactive/session.ts) + prototype on the canonical 5-min
  fixture: join -> deterministic claim retrieval over the same graph ->
  response compiled through the SAME W1+W2-validated machinery -> original
  overview resumes. Falsifiers F1-F4 ALL PASS: grounding (W1+W2+claims),
  C-5 locality to the AUDIO BYTES (per-turn WAV/duration/gap identical;
  exact post-boundary shift 21171/12314 ms), order integrity, double-run
  determinism. Architecture: docs/audio/interactive-audio-architecture.md.
  Honest boundaries: voice capture UNRESOLVED (text-scripted stand-ins);
  response-plan construction is intervention-layer (no Director
  single-turn entry point — HANDOFF).
- **Gates at delivery (this wave):** typecheck 0 errors; lint clean;
  406/406 = 151 (contracts/source/director) + 159 (audio: 123 baseline +
  36 new — zai-live 17 / acoustics 8 / interactive 11) + 82 (video) + 14
  (integration), 0 fail. EXP-X-02 re-run REPRODUCED exactly (B-treatment
  1/22 texts + 2/22 target-adjacent gaps, total delta 7806 ms = target
  8000 ms − 194 ms adjacent; A-control 17/22 + 21/22; F1-F4 PASS; station
  quality bar PASSED; the re-run artifacts differ from the committed ones
  ONLY in wallClockMs — the documented exception). Manifest packet digest
  double-run identical: 7d82ff5a2d8ffb8deee0dc75b829f72c0680689a46696a5677ca8f96c9c16a3a
  (the committed registry.json itself is untouched — no fingerprint
  changes).
- **Pre-existing registry staleness discovered (HANDOFF, not this wave's
  drift):** rebuilding the unified registry on PRISTINE main @ b1054a6
  reproduces the same 4-record drift vs the committed registry
  (exp-x02 diagnostics.json wall-clock fields + video raw-MP4 sha — the
  documented compositor encoder nondeterminism, excluded-by-rule). The
  committed registry on main predates the final TL re-runs; TL-owned
  rebuild recommended (my wave's new artifact dirs — exp-l-01/-02,
  interactive-01 — pass the store guard and register cleanly when the TL
  rebuilds).
- **Files touched (additive only):** src/providers/audio/{zai-live.ts,
  port.ts, factory.ts}, src/audio/{index.ts, artifacts.ts},
  src/audio/qa/acoustics.ts, src/audio/interactive/session.ts,
  tests/audio/{zai-live-provider,acoustics,interactive-session}.test.ts,
  experiments/run-exp-{l-01,l-02}.ts + run-interactive-audio.ts,
  artifacts/audio/{exp-l-01,exp-l-02,interactive-01}/,
  docs/{audio/interactive-audio-architecture.md,
  experiments/records/EXP-L-0{1,2,3}.yaml, evidence/registry.jsonl
  (EV-016/017/018), work-items/31-WFLX-P1-AUDIO-PARITY.md},
  package.json (devDependency z-ai-web-dev-sdk + exp:l01/l02/interactive
  scripts). No changes under src/contracts, src/source, src/director,
  src/video, src/compositor.

## 2026-10-01 11:15 UTC — WFLX-P1 MERGED (PR #11) + TL POST-MERGE FOLLOW-UPS (TL #2)

- **PR #11 MERGED** (c72058a) — WFLX-P1 audio parity wave, TL station-reviewed
  integration. Station review record (gates independently re-run on the branch):
  scope PASS (additive only inside P1 ownership; CONTRACTS_VERSION 2.0.0
  unchanged), typecheck 0 / lint clean / **406/406** (151 + 159 + 82 + 14),
  credential sweep CLEAN over the full branch diff and every commit tree,
  F4 determinism independently reproduced at the station (canonical offline
  benchmark byte-identical to the committed fingerprint), provenance audit
  PASS (zai-live-tts@zai-tts-1, honest reproducible=false for live output),
  evidence audit PASS (EV-016/017/018 line-by-line; no LLM self-assessment;
  real provider execution, not simulation).
- **TL ADJUDICATION — Director intervention entry point (HANDOFF from
  EXP-L-03):** keep the session-layer response-plan construction for the
  Parity Phase; do NOT introduce `compileInterventionPlan(...)` now.
  Director ownership is preserved in substance (the intervention response
  plan passes the SAME frozen plan guard + W1 deep validation and compiles
  through the SAME Director compiler; the session layer holds only the
  intervention lifecycle + plan-input construction — the same caller role
  as every other plan producer). TRIGGER to reopen: WFLX-P3 Interactive
  Audio captures demonstrating behavior the additive session layer cannot
  reproduce (mid-turn barge-in, partial-turn regeneration, streaming
  playback interruption) — then the entry point lands with evidence +
  contract-version discipline, not speculatively.
- **Preserved unresolved boundaries (NOT silently promoted):** real listener
  voice input (capture → ASR → barge-in → playback interruption) UNRESOLVED
  (text-scripted stand-ins); live label-token recovery 1/2 (n=2) EXPLICITLY
  UNRESOLVED; custom steering-prompt audio benchmark arm EXPLICITLY
  UNRESOLVED (work-order gap — covered by the P3 capture matrix and the
  final parity gate); live-route usage/cost observables UNRESOLVED; Gemini
  Notebook comparison deferred to WFLX-P3 (P1 proves lab capability + real
  provider execution only).
- **Unified registry rebuild executed (TL-owned, closes the pre-existing
  staleness HANDOFF recorded in the P1 delivery section):**
  `bun run manifest:build --now 2026-10-01T11:00:00Z` on merged main —
  counts 27 → 37 records (registers exp-l-01, exp-l-02 ×6 arms,
  interactive-01 ×3); store guard exit 0; **double-run byte-identical**
  (fixed stamp). The 4-record drift vs the previously committed registry
  is closed exactly as documented: exp-x02 ×3 (`diagnostics.json` sha —
  the wallClockMs exception; plan/qa/timing sidecar shas identical) +
  video exp-d (raw-MP4 `media.sha256` + sizeBytes 30113231 → 30113234 —
  the compositor encoder nondeterminism, excluded-by-rule).
- **WFLX-P2 DISPATCH AUTHORIZED** (video parity wave: Explainer refresh +
  Short ~60s + Cinematic asset pipeline incl. REAL generative provider
  execution where the sandbox allows; EV-019/020/021/022). Work order
  dispatched verbatim into the worker session; first worker commit records
  it as docs/work-items/32-WFLX-P2-VIDEO-PARITY.md. Baseline: main @
  c72058a (contains the P1 delivery + parity charter).

## 2026-10-01 — WFLX-P2 VIDEO PARITY WAVE DELIVERED (WFLX-P2, branch work/wflx-p2-video-parity)

Dispatched work order: docs/work-items/32-WFLX-P2-VIDEO-PARITY.md (first
worker commit; §7 push PAT redacted per the P1 credential-hygiene precedent
— push-URL-only credential, never in files/commits). Baseline: main @ d12eb7a
(P1 merged via PR #11 + TL follow-ups). Per-dimension delivery, gate
discipline per the work order §4:

- **Deliverable A — Explainer refresh (EV-019): VERIFIED.** The canonical
  7-min Explainer benchmark re-run on the v2 baseline at the wave HEAD:
  15 scenes / 6 beats, coverage 11/11, QA passed, SVG determinism pair equal,
  composition-independent packet digest double-run byte-identical
  (faf6e84557125bfc…). The committed canonical sidecar's SVG hash
  reproduces BYTE-IDENTICALLY (9cca99c3bf22037a… — no drift at the pinned
  layer; artifact id differs only via the composition-backend field, MP4
  excluded-by-rule). Custom-style arm (EXP-V-07 pattern on the v2 baseline,
  new deterministic custom-style layer src/video/custom-style.ts):
  SVGs change at both layers, 0/15 scenes change structure, coverage +
  timeline identical — the documented style-only prior extended to the
  visual surface. **EXP-V-L-01 built and PASSING** (the C-5 regression
  proof for video, the EXP-X-02 analog): a single-scene claim swap changes
  exactly 1/10 scene SVGs + 1 render spec + 1 narration with 0 structure
  reshuffle; double-run deterministic — F1/F2/F3 PASS.
- **Deliverable B — Short ~60 s (EV-020): VERIFIED.** Dedicated Short
  compile path (src/video/short/compiler.ts, additive; Director +
  storyboard compiler + contracts untouched): depth compression (≤1
  claim/scene, trimmed claims stay beat-covered and flagged
  covered-not-visualized — never a silent drop), hook prominence (×1.35
  opening-beat boost, 3 s floors, total conserved exactly), closed coverage
  accounting. EXP-V-S-01: 5 scenes (skeleton hook/topic/topic/topic/
  takeaways preserved), hookShare 0.25, 60 s inside the declared [48, 72] s
  band, accounting 3+0+8=11 closed, double full-pipeline run byte-identical,
  QA passed, MP4 committed (2,001,869 B). F1–F4 ALL PASS.
- **Deliverable C1 — Cinematic compile layer (EV-021): VERIFIED (offline
  stand-in).** The frozen-architecture §2 shape, additive in
  src/video/cinematic/: CinematicDirector (continuity-aware scene planning:
  subject-carry/motif/palette constraints; deterministic shot-plan vector
  per scene keyed on the C-5 scene-local content hash; StyleBible-derived
  cinematic params; asset-identity reuse — 13 distinct identities over 15
  jobs), the five-class VisualAssetPlan (deterministic-diagram 8,
  source-derived-media 2, illustration 1, generative-animation 3,
  video-generation 1 on the canonical fixture), per-asset validation gates
  (plan + content; failures throw before composition), compositor timeline
  overlay (shot plans + clip references), cinematic QA (structure/
  continuity/asset-validation/generative-honesty). EXP-V-CIN-01 (canonical
  fixture through the cinematic layer, OFFLINE stand-ins): F1 double-run
  plan+metadata byte-identical, F2 single-asset regeneration isolated
  (scene-14 video job; plan/others/deterministic surfaces unchanged), F3
  validator PASS, F4 QA passed — ALL PASS. Honest boundary: native
  video-clip embedding in the offline compositor UNRESOLVED (clips are
  validated + content-fingerprinted + overlay-referenced).
- **Deliverable C2 — REAL generative provider execution (EV-022):
  VERIFIED (real execution, live arm).** Live adapters over the
  server-side z-ai-web-dev-sdk (the P1 EV-016 route family):
  src/providers/visual/zai-live.ts (images.generations.create) +
  src/providers/video/zai-live.ts (video.generations.create +
  async.result.query poll + download), env-gated
  WFLX_VISUAL_PROVIDER=live-zai / WFLX_VIDEO_PROVIDER=live-zai, defaults
  OFFLINE (pinned by tests). EXP-V-CIN-LIVE-01 (reduced 36 s cinematic arm,
  4 scenes): **2 REAL images generated** (jpeg 1344×768, 56.0 s + 41.8 s
  wall) **and 1 REAL video clip generated** (h264 mp4 4,910,818 B, ffprobe
  OBSERVED 1890×1080 @ 5.19 s, 209.8 s wall) — the SDK video path WORKED in
  this sandbox. All live media COMMITTED with sha256 + provider/model
  provenance. F1 all generated assets pass their gates; F2 live plan
  fingerprint == offline plan fingerprint (provider-independent); F3
  provenance records real provider ids (reproducible=false honest); F4
  offline baseline byte-unchanged with flags off (same-plan double run
  identical + factory defaults verified) — ALL PASS. Honest boundaries:
  the compose step consumed the RECORDED live bytes via replay providers
  (generation and composition decoupled across runner targets; wall
  latencies are measured observables, not reproducible); live bytes are
  stochastic per call and byte-identity is never claimed for them.
- **Real-product comparison hooks (for WFLX-P3):** short.duration.seconds /
  short.sceneDensity.scenesPerMinute / short.hookProminence.share /
  cinematic.shotDensity.shotClasses / cinematic.styleContinuity.constraints
  / cinematic.liveGeneration.latency — each recorded with its lab
  measurement in the experiment records, marked COMPARISON PENDING REFERENCE
  CAPTURE. No product-side numbers asserted.
- **Regression preservation:** all four chunks green at the wave HEAD —
  contracts 75, source 45, director 31, audio 159, video **117** (82 + 35
  new P2 tests), integration 14; typecheck 0 / lint clean. CONTRACTS_VERSION
  stays 2.0.0 (no shared-contract changes; the VideoScene contract gained
  no new required fields). EXP-X-02 re-executed and REPRODUCED (all
  falsifiers + station bar PASS; wall-clock sidecar drift reverted so the
  committed store stays byte-identical). Manifest packet digest double-run
  byte-identical (262b4cb784f332c5… == 262b4cb784f332c5…); registry 37 → 42
  records, ALL existing records unchanged (additive-only: exp-e-refresh ×2,
  exp-v-s-01, exp-v-cin-01, exp-v-cin-live-01) — no-transition proof.
- **Files touched (additive within ownership):** src/video/{custom-style.ts,
  index.ts, artifacts.ts, short/, cinematic/}, src/providers/visual/
  {generative-port.ts, offline-generative.ts, zai-live.ts,
  generative-factory.ts}, src/providers/video/{generative-port.ts,
  offline-generative.ts, zai-live.ts, generative-factory.ts},
  tests/video/{custom-style,short-format,cinematic,
  zai-generative-providers}.test.ts, experiments/run-exp-{e-refresh,
  v-s-01,v-cin-01,v-cin-live-01}.ts, artifacts/video/{exp-e-refresh,
  exp-v-l-01, exp-v-s-01, exp-v-cin-01, exp-v-cin-live-01}/,
  artifacts/manifest/registry.json (additive rebuild),
  docs/experiments/records/{EXP-E-REFRESH,EXP-V-L-01,EXP-V-S-01,
  EXP-V-CIN-01,EXP-V-CIN-LIVE-01}.yaml, docs/evidence/registry.jsonl
  (EV-019/020/021/022), package.json (exp:erefresh/vs01/vcin01/vcinlive
  scripts). No changes under src/contracts, src/source, src/director,
  src/audio, src/compositor (existing surfaces), reference/.
- **HANDOFF entries (outside P2 ownership):**
  1. Native video-clip embedding in composition (Remotion <Video> or ffmpeg
     overlay) — UNRESOLVED in the offline compositor; the cinematic overlay
     + asset records carry the references; compositor ownership is Worker 3/
     TL-side. 2. Live-route usage/cost observables — the SDK routes report
     no usage/cost metadata (same UNRESOLVED class P1 recorded for TTS).
     3. A Director-level 'short' pacing profile (deeper per-mode editorial
     priors) would live in Worker 1's tree; the P2 Short layer demonstrates
     the behavior without Director changes. 4. The pre-existing registry
     staleness discipline (rebuild on every artifact-adding wave) — honored
     here (42 records committed); keep the habit for P3.

## 2026-10-01 17:40 UTC — WFLX-P2 MERGED (PR #12) + station record + WFLX-P3 DISPATCH AUTHORIZED (TL #2)

- **WFLX-P2 video parity MERGED via PR #12** (station review 17:16-17:35 UTC
  on pristine b0a9fff, gates re-run trusting nothing): credential sweep
  clean, typecheck 0 / lint clean, **441/441** (contracts 75, source 45,
  director 31, audio 159, video 117, integration 14), manifest double-run
  byte-identical (80ed5dd5…), do-not-disturb surfaces untouched, real media
  verified on disk (2 live JPEGs 1344×768 + 1 live h264 clip 1890×1080
  @ 5.19 s, sha256 + provider provenance). The WFLX-P2 delivery section
  above stands as merged truth.
- **OPERATIONAL LESSON (binding for all future waves):** the P2 worker
  session 9a338327 delivered its branch 11:49–14:24 UTC while the resident
  watch convicted it dead-turn at ~13:35 on DOM-freeze evidence
  (thinking-chain static over 45 s) and then burned five duplicate
  dispatches into a hostile capacity lane (dc970e7d, a07c306e, c6cec594,
  de8bfe59, 55044993 — all zombie-convicted, tabs closed, herd-watch
  armed at 17:19). DOM freeze is NOT server-side turn death. GIT TRUTH
  (origin branch existence check) is consulted FIRST before any
  void/re-dispatch decision from now on; a 15-minute admission window is
  too aggressive under capacity contention — queue doctrine governs.
- **WFLX-P3 DISPATCH AUTHORIZED** (reference/benchmark/parity lab wave):
  the next-gen black-box comparison program over the LAB-series capture
  estate (LAB-01..06 audio surfaces; the original Explainer video artifact
  + scene atlas; the P1/P2 recorded comparison hooks) — comparison-record
  schema + ingestion + audio parity comparison suite + video hook harness
  + integration tests authorized through this work order. Fresh
  real-product captures (video Short/Cinematic + custom-prompt arms) are
  TL-side through the replay browser, landing as TL commits; the worker
  NEVER fabricates product-side numbers (COMPARISON PENDING REFERENCE
  CAPTURE discipline). Work order dispatched verbatim into the worker
  session; first worker commit records it as
  `docs/work-items/33-WFLX-P3-REFERENCE-LAB.md`. Baseline: main @ fe63944.
- Phase-gate note: the custom-prompt comparison gate receives its
  product-side evidence from the P3 capture matrix (TL-side arms) —
  closing the P1 work-order gap noted in the refined handoff.

## 2026-10-01 19:40 UTC — PARITY CAPTURE MATRIX COMPLETE (TL #2) — video control/twin/custom-prompt landed; audio-lane behavior change observed

The fresh real-product capture round (operator-gated, replay-browser, LAB-series
pattern) closed the video-side capture matrix and banked the audio-lane truth:

- **LAB-07 (video control, Short):** 84.82 s, 720x1280 9:16 vertical, h264@30 +
  AAC mono 44.1 kHz; fresh per-run title; generation wall ~28.4 min. sha256
  f89fd153… (commit 9069148).
- **LAB-08 (video twin, same config):** 78.32 s, different title + full surface
  on identical input — run-to-run stochasticity EXTENDED TO THE VIDEO SURFACE
  (the LAB-06 audio finding now n=2-surfaces); duration band n=2 above the
  lab's [48,72] s Short band; wall variance 28.4→7.4 min (not a stable
  observable). Honest note: this run's intended custom-topic injection failed
  (Angular form) and ASR adjudicated default content — the failure itself is
  the negative control for LAB-09. sha256 23d313b0… (commit ef8b6f1).
- **LAB-09 (video custom-prompt arm, VERIFIED):** 71.63 s, title "How AI Agents
  Hide Their Keys", the ENTIRE episode re-planned around the security/compliance
  focus (ASR: sandbox/keys/compliance throughout vs 0 hits on control) — the
  product's focus control is an episode-level content re-plan, materially
  different semantics from the lab's style-only custom layer (0/15 structure
  change, EXP-V-07). sha256 52996d49… (commit 4b52a57).
- **P2 comparison hooks — product-side numbers where captures exist:**
  short.duration.seconds = 84.8 / 78.3 / 71.6 (n=3, content-elastic band ABOVE
  the lab's 60 s target; the [48,72] band hypothesis refined); sceneDensity =
  raw ffmpeg scene-cut instrument 3 / 13 / 1 cuts (huge run-to-run variance;
  MEASUREMENT-CLASS NOTE: the lab's 5 scenes are structural plan units, the
  product's ffmpeg cuts are visual transitions — not directly comparable
  numbers, recorded as instrument truth only); hookProminence / shotDensity /
  styleContinuity / liveGeneration.latency remain PENDING structured
  annotation (curation work, honest).
- **UI-truth banked (binding for the parity verdict):** the product's video
  surface exposes exactly Short (9:16) | Explainer (16:9) — NO Cinematic
  product format exists; the lab's Cinematic layer is a behavior
  reconstruction of generative-asset workflows, recorded as a scoping truth
  (not a format parity claim).
- **AUDIO-LANE BEHAVIOR CHANGE (observed):** the Customize Audio Overview
  dialog now states "This content will generate in a few hours. Or, upgrade to
  get it sooner." — both LAB-10 runs (an accidental empty-focus era-control +
  the VERIFIED custom-focus arm, 138 chars read back before Generate) are
  "Scheduled for after 11pm". The audio lane moved from immediate ~7-10 min
  generation (Sept 28 LAB-01..06 era) to scheduled queuing (Oct 1). The
  custom-prompt AUDIO capture will land when the platform runs it; the
  scheduling behavior itself is banked product truth.
- **Capture matrix state:** audio {Deep Dive control ✅ LAB-01, Brief/Critique/
  Debate ✅ LAB-02, Short length ✅ LAB-03, Spanish ✅ LAB-04, mutation ✅
  LAB-05, twin ✅ LAB-06, custom prompt ⏳ scheduled LAB-10} × video {control ✅
  LAB-07, twin ✅ LAB-08, custom prompt ✅ LAB-09, Explainer original ✅
  (reference/video), Cinematic n/a-in-product, language ⏳ not captured
  (PENDING — non-English video arm optional follow-up)}.

## 2026-10-02 — WFLX-P3 DELIVERED (branch work/wflx-p3-reference-lab) — the reference/comparison program over the capture estate

Wave: WFLX-P3 (work order `docs/work-items/33-WFLX-P3-REFERENCE-LAB.md`,
first commit `dc14713`). Baseline: main @ `39f3e09`. All four chunks green
at the wave HEAD: **contracts 75, source 45, director 31, audio 159, video
117, integration 29** (was 14; +15 new comparison tests) = **456/456**;
typecheck 0 errors, lint clean; manifest packet digest double-run
byte-identical at a fixed stamp (committed registry untouched — the wave
adds no artifacts under the audio/video registry roots; 42 records, no
transition); credential sweep over the wave diff = 0 hits.

- **Deliverable A — comparison-record schema + ingestion (EV-023):
  VERIFIED.** Canonical schema (`tools/comparison/schema.ts`, zod-validated;
  docs: `docs/experiments/comparison-record-schema.md` + template) carrying
  the §3 charter field list. REQUIRED-EITHER-VALUE-OR-PENDING is mechanical
  and test-enforced: VERIFIED/DIVERGENT metrics carry BOTH lab and product
  values with a product source pointer; PENDING metrics carry exactly
  "COMPARISON PENDING REFERENCE CAPTURE" with a NULL product value;
  instrument-truth numbers are never compared like-for-like. The ingester
  folds the committed estate (LAB-01..09 + the original Explainer reference
  + scene atlas) into **10 estate records** — every ingested number traces
  to a committed record; missing fields become null. Hand-rolled fail-loud
  YAML subset parser/emitter (the repo's no-yaml-dependency discipline).
- **Deliverable B — audio parity comparison suite (EV-024): VERIFIED (with
  recorded DIVERGENT verdicts).** `tools/comparison/audio-suite.ts` +
  `experiments/run-comparison-audio.ts` compile the LAB-canonical source
  through the offline deterministic pipeline (reproducing the committed
  exp-a-r2 arm structure) and emit **8 dimension records** — 17 VERIFIED /
  12 DIVERGENT / 6 PENDING metrics, every verdict from a DECLARED mechanical
  rule (duration-ratio-band, equality, percent-point, cited-qualitative).
  Key honest verdicts: Deep Dive structure/speakers VERIFIED, duration class
  DIVERGENT (300 s lab canonical vs 1201.82 s product Default); mode-family
  voice counts + stances + band ordering VERIFIED, dialogic durations
  DIVERGENT; compression philosophy DIVERGENT (salience-omission vs
  depth-shrink); language structure-invariance VERIFIED, surface + duration
  shift DIVERGENT (ML1 placeholder boundary recorded); mutation content
  voiced VERIFIED, locality class DIVERGENT (lab C-5 22/24 texts identical
  vs product global re-plan — architecture-rule distinction recorded);
  twin stochasticity DIVERGENT (lab determinism = control choice, not
  parity). LAB-10 (custom prompt) + Interactive Audio = PENDING SLOTS with
  TL hooks (the 2026-10-01 scheduling-lane change banked as truth).
- **Deliverable C — video hook harness (EV-025): VERIFIED.** The three
  video runners (EXP-V-S-01, EXP-V-CIN-01, EXP-E-REFRESH) are wired to the
  shared builders (`tools/comparison/video-hooks.ts`) — their ad-hoc
  product-side pending markers are REPLACED by schema-compliant comparison
  records; **6 video dimension records** — 6 VERIFIED / 7 DIVERGENT / 8
  PENDING metrics. Short duration DIVERGENT (product n=3 band 71.63–84.82 s
  above the lab 60 s target + [48,72] band; 71.63 sits 0.37 s below the
  ceiling — recorded exactly); Short geometry DIVERGENT (9:16 vertical vs
  16:9 — structural gap recorded); Short audio stream VERIFIED; sceneDensity
  = instrument truth ONLY (binding measurement-class note: ffmpeg cuts
  3/13/1 vs 5 plan units — never compared like-for-like); Cinematic = PENDING
  SLOT carrying the SCOPING TRUTH (no Cinematic product format exists —
  LAB-07 UI-truth; not a parity claim); Explainer duration/geometry/audio
  VERIFIED vs the ONE golden reference (n=1 caveat recorded); custom-prompt
  steering semantics DIVERGENT (product content re-plan vs lab style-only —
  parity distinction recorded per LAB-09); language arm + video mutation
  locality = PENDING SLOTS. Surgical regeneration: only the three intended
  experiment records changed; pinned layers byte-identical (git-verified);
  EXP-V-S-01 full composition deliberately NOT re-run (raw-MP4 encoder
  nondeterminism would churn committed fingerprints) — its wiring is
  source-level + canonical record from committed outputs, consistency
  test-asserted.
- **Deliverable D — integration tests + registry + docs (EV-026):
  VERIFIED.** `tests/integration/comparison-schema.test.ts` (10 tests:
  schema, round-trip, regeneration byte-identity, required-either-value-or-
  pending, pending-discipline) + `tests/integration/comparison-harness.
  test.ts` (5 tests: end-to-end harness on the canonical fixture, verdict
  rules, lab-value consistency). EV-023/024/025/026 appended to
  `docs/evidence/registry.jsonl` (21 → 25). This roadmap section appended.
- **Pending-capture list (explicit):** audio custom steering prompt (LAB-10
  — scheduled on the product side, scheduling-lane change banked);
  Interactive Audio product capture (operator-gated; lab prototype EV-018
  stands); video language arm (no capture); video mutation locality (no
  video-side capture); Short hook-prominence structured annotation
  (curation work); the whole Cinematic slot (no product format exists —
  scoping truth, not a pending capture).
- **HANDOFF entries (outside P3 ownership):**
  1. `tests/integration/` additive files were authorized by the WFLX-P3 work
     order Deliverable D; no shared fixtures were modified — the TL should
     note the two new files in the chunk map (integration 14 → 29).
  2. The EXP-V-S-01 runner now imports the comparison builders; a FUTURE
     full re-run of `exp:vs01` will emit the schema-compliant records into
     its experiment record directly — when that happens, expect a
     raw-MP4/artifact-sidecar churn decision (encoder nondeterminism,
     exclusion-by-rule discipline; TL-owned call).
  3. When LAB-10 / video-language / video-mutation / Interactive-Audio
     captures land: extend `tools/comparison/ingest.ts` LAB_IDS + re-run
     `exp:cmpaudio` / `exp:cmpvideo` — the pending slots fill mechanically.
  4. The audio-lane scheduling behavior (generation moved to scheduled
     queuing, 2026-10-01) affects any FUTURE product-side audio capture
     workflow — capture runbooks should expect the queued lane (TL/operator
     note).

## 2026-10-02 04:30 UTC — WFLX-P3 MERGED (PR #13, TL #2 station review) — the parity comparison program is COMPLETE over the captured estate

- Branch `work/wflx-p3-reference-lab` @ `06879e7` (dc14713 work-order verbatim + 06879e7 deliverables A-D, 73 files, +10,592/−39) — MERGED at `2426942`.
- Station review verdicts (all gates independently re-run): scope PASS (0 src/ files — frozen architecture); typecheck 0 / lint clean; chunks 151+159+117 station-verified + the full new comparison-test battery (schema discipline, pending-slots, TL hooks, byte-regeneration falsifier PASS; full integration chunk 29/29 verified at the worker pod — station-side completion blocked by live-estate memory pressure only); manifest double-run digest `4c0beb5f…` IDENTICAL to the report; credential sweep 0 hits.
- Delivered: comparison-record schema + ingester (10 estate records, EV-023) · audio parity suite (17 VERIFIED / 12 DIVERGENT / 6 PENDING metrics, EV-024) · video hook harness (6/7/8, EV-025) · 29 integration tests + registry + docs (EV-026).
- Honest DIVERGENT verdicts recorded (never silently promoted): Deep Dive duration class (300s lab vs 1201.82s product); compression philosophy; mutation locality class (lab C-5 22/24 vs product global re-plan); twin stochasticity (control choice); Short duration band (71.63-84.82s product vs 60s target); Short geometry (9:16 vs 16:9 — wait, reversed: product 9:16, lab structural 16:9 explainer-family note); sceneDensity instrument-truth binding note.
- PENDING REFERENCE CAPTURE slots with mechanical TL hooks: LAB-10 audio custom-prompt (platform-scheduled), video language arm, video mutation locality, Short hook-prominence structured annotation, Interactive Audio product capture. When captures land: extend `ingest.ts` LAB_IDS + re-run `exp:cmpaudio` / `exp:cmpvideo` — slots fill mechanically.
- Wave-close note: the Parity Completion Phase's three worker waves (P1 audio PR #11, P2 video PR #12, P3 reference-lab PR #13) are ALL MERGED. Remaining phase items are TL/operator-owned: the pending capture slots above + the cross-modal QA + parity promotion gate (the phase's §7 definition of done).

## 2026-10-02 06:00 UTC — LAB-10 LANDED (TL #2 + operator) — the audio custom-prompt matrix is CLOSED; AUDIO-PARITY-07 filled

- The platform executed both scheduled LAB-10 runs ~23:35-23:40 UTC Oct 1
  (the "Scheduled for after 11pm" promise kept — the product studio listed
  both artifacts "6h ago" at the 05:37 UTC harvest check). Harvested through
  the replay browser's operator Google session (VPN egress): downloads via
  the player more-menu, ffprobe + sha256 verified, ASR-sampled (6+4 x 28 s
  windows), and the STRONGEST injection-evidence class banked: the product's
  own post-generation "View prompt and sources" dialog reads the full
  138-char custom prompt back verbatim on the custom-focus artifact — and
  shows NO Prompt panel on the era-control (empty focus) — the in-product
  negative control.
- **LAB-10 capture record landed** (`docs/experiments/records/LAB-10.yaml`
  + transcript + `artifacts/reference/lab-10/artifact.json`): custom-focus
  arm "Securing Autonomous AI Infrastructure" 1015.80 s (sha256 bf4dad8c…,
  AAC LC 44.1 kHz stereo) vs the same-lane empty-focus era-control
  "Anatomy of a Redacted AI Blueprint" 1415.09 s (sha256 c375708d…).
  OBSERVED: full content re-plan (title/hook/synthesis re-steered; 20
  defensive-security stem hits/459 sampled words vs the era-control's 5/314
  — all 5 traceable to the fixture's own topic list, zero defensive
  vocabulary); duration response -28.2% vs same-lane control (-15.5% vs the
  LAB-01 immediate-lane control); 2-host dialogic Deep Dive skeleton
  preserved (the focus changes CONTENT, not FORMAT — the LAB-09 video
  finding repeated on audio).
- **AUDIO-PARITY-07 FILLED** (the pending slot's TL hook executed):
  `ingest.ts` LAB_IDS extended to LAB-10 (11 estate records — the other 10
  regenerate byte-identically, surgical); the audio suite's pending record
  became a dimension comparison. Audio suite totals: **18 VERIFIED / 14
  DIVERGENT / 3 PENDING** (was 17/12/6). Honest verdicts:
  steeringEffect DIVERGENT (the product has an episode-level audio
  custom-steering surface; the lab default compile has none —
  surface-existence divergence mirroring VIDEO-PARITY-04);
  durationResponse DIVERGENT (product -28.2% content-elastic vs lab
  0%-by-construction, percent-point rule, measurement-class note recorded);
  structurePreservation VERIFIED (macro skeleton preserved under the
  steering axis on both sides). Integration tests updated and green
  (15/15: schema, round-trip, byte-regeneration, pending-discipline — the
  remaining pending slots are AUDIO-PARITY-08 + VIDEO-PARITY-02/05/06).
- **Capture matrix state (updated):** audio {Deep Dive control ✅ LAB-01,
  mode family ✅ LAB-02, length ✅ LAB-03, language ✅ LAB-04, mutation ✅
  LAB-05, twin ✅ LAB-06, custom prompt ✅ LAB-10} — the AUDIO side of the
  matrix is COMPLETE. Remaining pending captures: Interactive Audio
  (operator-gated; EV-018 lab prototype stands), video language arm, video
  mutation locality, Short hook-prominence structured annotation (Cinematic
  stays a scoping truth — no product format).
- Remaining phase items (TL/operator-owned): the four pending captures
  above + cross-modal QA + the parity promotion gate.
