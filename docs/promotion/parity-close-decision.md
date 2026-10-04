# Parity-Close Decision — WebFlix-Lab Parity Completion Phase

Document status: **AUTHORED 2026-10-02 by TL #2** (the resident TL/orchestrator,
the owner of the parity promotion gate per the phase work order §3). This
document walks the §4 acceptance gates, summarizes the cross-modal QA over
the completed comparison program, records the honest divergence ledger, and
issues the phase verdict. Evidence labels follow AGENTS.md: OBSERVED /
DOCUMENTED / HYPOTHESIS / REPRODUCED / UNRESOLVED.

Scope under adjudication: the Parity Completion Phase
(docs/work-items/parity-completion-work-order.md, opened 2026-09-30 21:35 UTC)
— three replay-dispatched worker waves WFLX-P1 (audio parity, PR #11),
WFLX-P2 (video parity, PR #12), WFLX-P3 (reference/benchmark lab, PR #13),
plus the TL/operator-owned capture program (LAB-01..12, the structured
hook-prominence annotation, and the comparison-record fills landed
2026-10-01..02 at f54ee39 / bd773ed).

---

## 1. §4 acceptance-gate walk (each capability VERIFIED or EXPLICITLY UNRESOLVED with evidence)

| # | Capability | Status | Evidence |
|---|------------|--------|----------|
| 1 | Real audio provider exercised | **VERIFIED** | EV-016 (EXP-L-01, REPRODUCED): REAL live TTS execution through the existing adapter interface, env-gated, offline default unchanged; provider provenance recorded. |
| 2 | Interactive Audio verified | **VERIFIED (lab) / EXPLICITLY UNRESOLVED (product capture)** | EV-018 (EXP-L-03, REPRODUCED): interruption -> source-grounded response -> resume-original-overview; original turns byte-identical across the boundary; startMs shift == inserted total. The product-side capture is the ONE open slot (AUDIO-PARITY-08, COMPARISON PENDING REFERENCE CAPTURE with TL hooks): it requires a human conversing with the live player's Interactive mode — operator-gated by design, ask posted through the replay outbox 2026-10-02. Never promoted beyond its evidence. |
| 3 | Real video provider exercised | **VERIFIED** | EV-022 (EXP-V-CIN-LIVE-01, REPRODUCED): REAL generative provider execution through the provider ports (z-ai-web-dev-sdk); the cinematic asset pipeline through live jobs. |
| 4 | Explainer benchmark refreshed | **VERIFIED** | EV-019 (EXP-E-REFRESH, REPRODUCED): canonical 7-min Explainer benchmark refreshed on the v2 baseline; comparison record VIDEO-PARITY-03 filled. |
| 5 | Short benchmark completed | **VERIFIED** | EV-020 (EXP-V-S-01, REPRODUCED): the dedicated ~60 s Short compile path; duration band [48,72] s; VIDEO-PARITY-01 filled incl. the hook-prominence annotation (2026-10-02). |
| 6 | Cinematic benchmark completed | **VERIFIED (lab) + SCOPING TRUTH (product)** | EV-021 (EXP-V-CIN-01, REPRODUCED): the cinematic asset pipeline (continuity-aware planning, five job classes, asset-identity reuse, F1-F4). Product side: NO Cinematic format exists in the product's video surface (LAB-07 UI-truth) — recorded as a SCOPING TRUTH in VIDEO-PARITY-02, not a parity claim. |
| 7 | Audio quality comparison | **VERIFIED (program complete)** | EV-024 + the 2026-10-02 fill: AUDIO-PARITY-01..08 over the 7/7-arm audio capture matrix; **18 VERIFIED / 14 DIVERGENT / 3 PENDING metrics** (the 3 PENDING = Interactive Audio, the operator-gated slot). |
| 8 | Video quality comparison | **VERIFIED (program complete)** | EV-025 + the 2026-10-02 fills: VIDEO-PARITY-01..06 over the complete video capture matrix; **9 VERIFIED / 11 DIVERGENT / 3 PENDING metrics** (the 3 PENDING = the Cinematic scoping truth only). |
| 9 | Multi-language comparison | **VERIFIED** | AUDIO-PARITY-04 (LAB-04 español Deep Dive: structure invariant, native regeneration, -13.9% duration shift) + VIDEO-PARITY-05 (LAB-11 español Short, filled 2026-10-02: structure preserved, native regeneration, -3.5% shift WITHIN tolerance — the cross-surface language-duration distinction recorded). |
| 10 | Custom-prompt comparison | **VERIFIED** | VIDEO-PARITY-04 (LAB-09 video custom focus: content re-plan vs lab style-only) + AUDIO-PARITY-07 (LAB-10 audio custom focus, filled 2026-10-02: full re-plan with the in-product Prompt-dialog read-back; duration -28.2% content-elastic). |
| 11 | Failure-mode comparison | **VERIFIED (as recorded negative controls + honest boundaries)** | LAB-08's failed injection IS the steering falsifier's negative control (default content, ASR-adjudicated — the failure itself is evidence); the LAB-05 falsifier RESOLVED via LAB-06 (twin stochasticity); every DIVERGENT verdict in the comparison program is a recorded behavioral boundary (global re-plan, stochasticity, duration classes, hook prominence), never normalized; product-side failure observations are banked per-capture (scheduling-lane behavior change, ASR artifacts recorded as transcription-side). |
| 12 | Local regeneration regression | **VERIFIED** | EXP-V-CIN-01 F2 (scene-local regeneration: only the target job re-runs, all else byte-identical); EXP-X-02 (C-5 diff hygiene: 1/22 vs 17/22); the byte-regeneration falsifier over the whole committed comparison estate (27 records, integration-test-asserted, re-verified at every fill). |

Mandatory gates re-verified at the close: typecheck 0 errors; lint clean;
full chunked battery **456/456** (contracts 75 + source 45 + director 31 +
audio 159 + video 117 + integration 29); credential sweep 0 hits; the
determinism spine intact (no wall-clock in any committed record; the
ingester/suites regenerate the committed docs byte-identically — asserted).

## 2. Cross-modal QA summary (the completed comparison program)

**Estate**: 13 ingested records (LAB-01..12 + the Explainer golden
reference), every number traceable to a committed record; 14 dimension
records (8 audio + 6 video); every verdict from a DECLARED mechanical rule
(duration-ratio-band, equality, percent-point-tolerance,
cited-qualitative-alignment — the rule id recorded in each delta).

**Audio surface** (18 V / 14 D / 3 P): Deep Dive structure/speakers
VERIFIED, duration class DIVERGENT (300 s lab canonical vs 1201.82 s
product — never normalized); mode-family voice counts/stances/band-ordering
VERIFIED, dialogic durations DIVERGENT; compression philosophy DIVERGENT
(salience-omission vs depth-shrink); language structure-invariance VERIFIED,
surface + duration shift DIVERGENT (the ML1 placeholder boundary); mutation
content-voiced VERIFIED, locality class DIVERGENT (lab C-5 22/24
turn-local vs product global re-plan); twin stochasticity DIVERGENT (lab
determinism = control choice); custom-prompt steering DIVERGENT
(surface-existence), duration response DIVERGENT (-28.2% content-elastic),
structure preservation VERIFIED.

**Video surface** (9 V / 11 D / 3 P): Short duration band DIVERGENT
(71.63-84.82 s product vs 60 s target), geometry DIVERGENT (9:16 vs 16:9
structural), audio stream VERIFIED, hook prominence DIVERGENT (4.7-5.6%
product vs 25% lab opening beat — granularity-robust), twin stochasticity
DIVERGENT; Explainer duration/geometry/audio VERIFIED vs the one golden
reference (n=1 caveat); custom-prompt steering semantics DIVERGENT
(content re-plan vs style-only), format invariants VERIFIED; language
structure VERIFIED (analog-axis), surface regeneration DIVERGENT, duration
shift VERIFIED within tolerance (-3.5%); mutation locality class DIVERGENT
(global re-plan vs C-5), macro structure VERIFIED, duration response
DIVERGENT (-12.9%); Cinematic = scoping truth (3 PENDING metrics by
construction — no product format exists).

**Cross-surface QA findings** (the honest ledger): (a) the product's
language duration response is SURFACE-DEPENDENT (audio Deep Dive -13.9%,
video Short -3.5% within tolerance — the fixed-format timing dominates);
(b) the global re-plan response to source edits is CONSISTENT across
surfaces (LAB-05 audio +19%, LAB-12 video -12.9%, both with title/content
replacement — the product never minimally patches); (c) custom-focus
steering re-plans content wholesale on BOTH surfaces while preserving
format envelopes; (d) the product front-loads ~4 s hooks where the lab
reserves full opening beats; (e) the mutated claim's surfacing is
selection-dependent on the video Short (n=1 UNRESOLVED) where the audio
Deep Dive voiced it — recorded, never promoted.

## 3. Honest divergence ledger (never silently normalized)

1. Duration classes (audio 300 vs 1201.82 s; video 60 vs 71.6-84.8 s) —
   measurement-class gaps recorded per surface.
2. Compression philosophy (salience-omission vs depth-shrink).
3. Mutation locality (lab C-5 turn/scene-local vs product global re-plan)
   — an architecture-rule distinction.
4. Twin stochasticity (lab byte-determinism = a control choice).
5. Custom-steering surface existence (no lab audio custom-prompt arm; no
   lab non-English video arm).
6. Short geometry (product 9:16 vertical vs lab 16:9 structural family).
7. Hook prominence (25% lab opening beat vs ~5% product hook sentence).
8. The ML1 placeholder-EN boundary under language switch (audio).
9. Interactive Audio product capture — the ONE open slot (operator-gated).

## 4. Verdict

**PARITY COMPLETION PHASE: CLOSED — the parity characterization is
complete and honest.** All twelve §4 capabilities end VERIFIED or
EXPLICITLY UNRESOLVED with evidence; the product-side capture matrix is
complete (audio 7/7 arms x video all arms, Cinematic a scoping truth); the
comparison program over the captured estate is complete with declared
mechanical verdicts and a byte-reproducible determinism spine. The
divergences above are recorded architecture/format/measurement-class
distinctions with their evidence — the program's purpose (characterize
parity honestly, never fake it) is fulfilled.

**Promotion posture** (the WebFlix production boundary holds — this repo
is the R&D/promotion laboratory; payswapdotorg/WebFlix untouched): the lab
advances to **parity-characterized** — the comparison program + capture
estate are the integration handoff. The Interactive Audio product capture
remains the single open follow-up (operator-gated; the AUDIO-PARITY-08 TL
hooks fill it mechanically when it lands); no other open items block
integration consumption of the handoff.

## 5. TL #2 sign-off

- [x] TL #2 (the resident TL/orchestrator) — 2026-10-02 07:30 UTC
      Evidence spot-checks performed: the LAB-10/11/12 captures were
      harvested and verified by this signatory (sha256/ffprobe/ASR); the
      AUDIO-PARITY-07 and VIDEO-PARITY-01/05/06 fills were reviewed at the
      station (declared rules re-derived from the two values; the
      byte-regeneration falsifier re-run green; the full battery 456/456
      re-verified before each push at f54ee39 and bd773ed).

---

## 6. Studio-stage amendment (2026-10-04) — drafted by wflx-ui3, pending TL sign-off

Section status: **DRAFTED 2026-10-04 by Worker 3 (wflx-ui3 — station
integration + journey docs wave; work order recorded verbatim at
docs/work-items/37-WFLX-UI3-STATION-INTEGRATION.md)**. Per this document's
conventions the TL signs after station review; the checkbox at the end of
this section stays open until then. Evidence labels follow AGENTS.md —
everything in this section is REPRODUCED-class.

The post-parity studio stage (docs/handoff/tl2-overview-studio-handoff.md)
added the lab's first browser surface **over the frozen pipeline** — no
pipeline change, no new product-parity evidence, no parity conclusion
moved:

- **WFLX-UI1 (app shell) — MERGED 2026-10-04** (branch
  `work/wflx-ui1-studio-shell`; work order
  docs/work-items/35-WFLX-UI1-STUDIO-SHELL.md): the real chain in-browser
  (source adapter → understanding → Director → plan →
  `compileAudioOverview` — no pre-baked plans), player, transcript
  timeline, provenance panel, the W2 stub routes; battery 474 → 493.
- **WFLX-UI2 (Interactive Audio) — MERGED 2026-10-04** (branch
  `work/wflx-ui2-interactive-audio`; work order
  docs/work-items/36-WFLX-UI2-INTERACTIVE-AUDIO.md): the real
  `InteractiveAudioSession` routes (establish/intervene/state) + surface D
  (boundary markers, typed ask, inserted turns, masters compare, locality +
  grounding + provenance panels, fork history); battery 493 → 501.
- **WFLX-UI3 (station integration + journey docs) — this wave** (branch
  `work/wflx-ui3-station-integration`): the provenance-completeness audit
  across the three surfaces against the GeneratedArtifact / artifact.json
  conventions — **27 PASS / 5 GAP → fixed in the display layer only / 7
  N/A** across 39 audited cells; zero machinery changes, zero frozen-tree
  edits — plus apps/studio/README.md full form, the root-README studio
  section, this amendment, and the AGENTS.md read-list line; battery
  501 → 502 (the one added test pins the audit fills — the work order's
  501+N rule, N=1, reported).

**In-browser verification record** (the TL's agent-browser journey through
the operator console gateway; recorded in docs/work-items/roadmap-status.md
— the 2026-10-04 studio-stage entries): compile Deep-Dive 300 s (20 turns,
307.59 s actual) → Join Interactive Session (`ix-session-1`, 24 turns, 23
valid boundaries) → boundary 4 → the EXP-L-03 typed question → **24/24
original-turn byte-identity, pre-boundary +0 ms, post-boundary uniformly
+21,173 ms, F1 grounding PASS** (claim-b13 + claim-b14, retrieved by
content), **session master 328.76 s = 307.59 + 21.17 exact**.

**Parity posture — UNCHANGED by the studio stage.** The studio is a
REPRODUCED-class lab implementation: the offline deterministic provider
(placeholder audio), fork-and-compare session semantics (each question
re-forks from the stored baseline — the product's cumulative multi-turn
chat is NOT imitated), typed listener input (voice capture UNRESOLVED —
labeled on the surface), in-memory stores, media fingerprinted-not-
committed. It observes nothing about the Gemini product, adds **no
product-parity evidence**, and changes **no conclusion** of §§1–4. The
parity ledger stands as recorded at the close and after the one
post-close fill: **audio 21 VERIFIED / 14 DIVERGENT / 0 PENDING** (the
2026-10-04 LAB-13 product capture closed the AUDIO-PARITY-08
operator-gated slot — docs/experiments/comparisons/audio/
AUDIO-PARITY-08.yaml + the roadmap-status 2026-10-04 02:20 UTC entry;
all three metrics VERIFIED), **video as closed** (9 V / 11 D / 3 P — the
three PENDING being the Cinematic scoping truth by construction: no
product format exists). The honest divergence ledger (§3) and the
promotion posture (§4) are untouched. The studio's honest boundaries are
labeled on the surface itself and documented in apps/studio/README.md.

- [ ] TL #2 — pending station review of the wflx-ui3 branch (gates +
      credential sweep + frozen-tree diff + doc read-through + the browser
      journey re-verification) before merge.
