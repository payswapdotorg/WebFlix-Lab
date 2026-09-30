# Promotion Decision — WebFlix-Lab v1 → v2 contract wave

Document status: **ASSEMBLED 2026-09-30 by WFLX-V2-3** (final-wave
implementer, branch `work/wflx-v2-contract-wave`). This document assembles
the evidence classes the Phase 4 promotion gate requires
(docs/work-items/tl2-work-order.md §Phase 4) with per-class summaries and
pointers. **The verdict is TL #2's** — the sign-off block at the end is
PENDING and only TL #2 fills it. Evidence labels follow AGENTS.md:
OBSERVED / DOCUMENTED / HYPOTHESIS / REPRODUCED / UNRESOLVED.

Scope under adjudication: the v2 contract wave as ruled 2026-09-29
(docs/handoff/v2-contract-wave-draft.md, RULING section) —
`CONTRACTS_VERSION` 1.0.0 → 2.0.0 with C-5 (per-unit content-keyed seeding,
both surfaces), C-7 (shared rate model), C-9 (styleBibleVersion emission),
C-10 (monologic brief), C-3 (version-stamped note) — executed as sub-waves
1+2 on the branch, plus EXP-X-02 (the C-5 verification experiment) executed
by the final wave (EV-014).

---

## (a) Golden reference identity

**Summary**: the lab's product-comparison ground truth is pinned by
content, not by narrative. Two layers:

- **Golden video artifact** (EV-000, EV-002; DOCUMENTED + OBSERVED): the
  user-supplied Gemini Notebook video Overview
  (`reference/video/Orchestrating_Agentic_Development__Deconstructing_a_Multi-Agent.mp4`),
  sha256 `36485eb8…`, 415.66 s, h264 1280×720@30, mono AAC — identity
  pinned in `docs/reference/reference-artifact-manifest.json`, with the
  65 MB original fingerprinted-but-not-committed at bootstrap and the
  SERVED VARIANT committed (provenance recorded: the operator-authenticated
  reference session; geo-blocked sandbox egress worked around via the
  operator's browser egress — EV-001/EV-002).
- **Canonical lab control source** (DOCUMENTED): the redacted messy-note
  markdown fixture (`fixtures/reference-messy-note-redacted.md`, sha256
  `17dd7b1c…`) is the single frozen input behind the W1/W2/W3 canonical
  fixtures, the EXP-A/V/D series and the LAB control probes — one source,
  one graph, one fingerprint, every experiment comparable.

**Honest boundary**: the golden artifact is ONE product sample of ONE mode
(video explainer); it is not a per-mode product corpus. The per-mode
product truth comes from the LAB series (class (b)). The original
reference access path (operator Google session in the replay browser) was
never credential-committed (AGENTS.md rule, held — see security posture
under (f)).

**Pointers**: EV-000, EV-001, EV-002 (registry);
`docs/reference/reference-artifact-manifest.json`;
`reference/video/ORIGINAL-ARTIFACT.md`.

## (b) LAB real-reference product-truth series (EV-009)

**Summary**: six operator-gated black-box probes against the REAL Gemini
Notebook (notebook.google.com, dedicated notebook + twin, 2026-09-28),
plus the b30 mutation probe and the twin-regeneration probe — records
LAB-01..06, artifacts under `artifacts/reference/lab-0X/` with sha256 +
ffprobe metadata (OBSERVED):

| Probe | Result |
|---|---|
| LAB-01 golden Deep Dive (Default, en) | 1201.82 s, two hosts, macro skeleton: hook → source-title reference → roadmap → section walk → synthesis; ~7–8 min generation latency |
| LAB-02 mode variants | Brief 93.92 s SINGLE narrator enumerated (First/Second/Finally); Critique 1019.89 s evaluative two-host; Debate 1049.89 s adversarial with rebuttals — RESTRUCTURE-NOT-RESKIN confirmed |
| LAB-03 Length=Short | 318.21 s = 3.78× depth compression; skeleton/hosts/sections preserved; per-topic depth scales |
| LAB-04 español (Default) | 1034.84 s fully native Spanish (no dub); skeleton invariant; title localized |
| LAB-05 b30 one-paragraph mutation | GLOBAL response: different title, +19% duration, fully reshuffled surface; mutated content IS voiced; (mutation procedure constraint OBSERVED: pasted sources are content-immutable → remove + re-add) |
| LAB-06 twin notebook, identical input | different title, +10.2% duration, different hook/emphasis — the product is RUN-TO-RUN STOCHASTIC below the macro pattern; LAB-05's falsifier RESOLVED (mutation delta sits within baseline run-to-run variance) |

**Key product-truth deltas vs our lab** (each OBSERVED on the product,
REPRODUCED structurally in our lab where marked):

1. The real product is surface-stochastic per generation; our pipeline is
   byte-deterministic by construction (REPRODUCED, double-run proofs at
   every wave). Our determinism is a LAB CONTROL, not product fidelity —
   this feeds the v2 seeding philosophy and the honest C-5 posture
   (diff-hygiene, not parity).
2. The real product globally re-plans on ANY change (mutation or re-run);
   our v1 had plan-local mutation with a seeded-surface reshuffle defect
   (EXP-A-04), which C-5 fixed for OUR architecture rule (smallest-unit
   regeneration, AGENTS.md) — verified by EXP-X-02 (EV-014). NOT a parity
   claim.
3. Depth-vs-coverage compression: the real Short compresses per-topic
   depth while preserving coverage; our Director compresses by
   salience-driven claim omission + rate ceiling honesty (EXP-A-05 /
   EV-008, REPRODUCED). A known philosophical difference, documented.
4. C-10's product truth: the real Brief is a 1.5-minute single-narrator
   enumerated structure vs our v1 fixed 10-turn two-speaker dialog — the
   strongest product-truth delta in the v2 register; C-10 landed the
   monologic brief mode (EV-009 LAB-02, sub-wave 2).

**Pointers**: EV-009 (registry); LAB-01..06 records;
`docs/experiments/lab-series-runbook.md`;
`artifacts/reference/lab-01..06/artifact.json`.

## (c) Internal mechanics — the EXP series (our side of the comparison)

**Summary**: the lab's own pipeline behavior is measured by three
experiment families, all deterministic, all recorded per the protocol:

- **EXP-A-01..06 + R2** (EV-006, EV-011; REPRODUCED): audio-surface
  ablations over the canonical source — mode structure semantics
  (deep-dive vs brief/critique/debate; de-confounder arm), source mutation
  locality (EXP-A-04: graph+plan perfectly local, 21/25 texts reshuffled —
  the C-5 defect evidence), duration compression (EXP-A-05), language
  (EXP-A-06: structure invariant, surface switches, anchors stay EN — the
  documented code-switching boundary). R2 re-ran the series under the
  EV-008-fixed Director through the integration runner.
- **EXP-V-01..08** (EV-011; REPRODUCED): video-surface storyboard
  ablations — mode/duration axes, style mutation globally reshuffles
  role-carrying scenes (V-02: 10/15 SVGs, structure 0/15), the b30 claim
  mutation reshuffles 9/12 scene SVGs with structure 0/12 (V-04 — the C-5
  defect class confirmed WITH RUN EVIDENCE on the video surface),
  custom-prompt layer reach, seed sensitivity; V-05/V-06 multi-source arms
  BLOCKED honestly (DeterministicExtractor inconsistent multi-source graph
  — HANDOFF, class (f)).
- **EXP-D-01** (EV-011; REPRODUCED): same-source dual-modality comparison
  — audio deep-dive 300 s (20 turns, 11/11 claims voiced) vs video
  explainer 300 s (14 scenes, 7/11 claims visualized, 4 coverage-gap
  warnings, QA passed-with-issues): the shared editorial spine holds
  across modalities with modality-native coverage economics (see class
  (e)).
- **EXP-X-02** (EV-014; REPRODUCED — the v2 wave's verification
  experiment, executed by this final wave): the local refinement loop.
  B-treatment (C-5 keying, wave HEAD): a single-turn plan edit changes
  exactly 1/22 realized texts, 1/22 per-turn audio segments, 2/22 gaps
  (the target-adjacent pair), turns the failing gate to 0 over-budget,
  total duration delta = the target's own + 0 ms elsewhere; A-control (v1
  planHash keying, worktree at 720f984): the SAME edit reshuffles 17/22
  texts + 21/22 gaps. All four design-note falsifiers checked, none hit;
  station quality bar PASSED; every plan double-compiled byte-identically.

**Pointers**: EV-006, EV-010, EV-011, EV-014 (registry);
`docs/experiments/records/EXP-*.yaml`; `artifacts/audio/exp-a*/`,
`artifacts/video/exp-v*/`, `artifacts/audio/exp-d/`,
`artifacts/audio/exp-x02/`; runner provenance in
`experiments/run-exp-a.ts`, `tools/experiments/runner.ts`,
`experiments/run-exp-x-02.ts`.

## (d) Gates + determinism history

**Summary** (all REPRODUCED at the station, chunked per surface group —
the EV-011 OOM lesson):

- **Test baselines**: 332 (W3 merge) → 338 (P3A, EV-008) → 352 (P3B, both
  waves, EV-010/EV-011) → **370 at the v2 wave delivery** (sub-waves 1+2
  added the C-5/C-7/C-9/C-10 tests: per-unit keying locality, shared rate
  model, styleBibleVersion presence, monologic brief semantics; EXP-X-02
  itself added NO tests — the experiment is harness-verified inside the
  runner with machine-checked falsifiers, and the unchanged surfaces
  remain guarded by the 370).
  At delivery on the branch: typecheck 0 errors; lint clean;
  370/370 = 151 (contracts/source/director) + 123 (audio) + 82 (video) +
  14 (integration), 0 fail.
- **Byte-identity proofs**: the v2 wave's fingerprint transition
  (sub-wave 2, commit 242ebbd) regenerated every committed fingerprint the
  re-keying invalidates IN THE SAME CHANGE with double-run byte-identity
  proofs (audio benchmarks, EXP-A artifacts + R2 re-run, video benchmark
  manifests, realized-text pins, the brief fixtures at the C-10 monologic
  boundary) — the dated-addendum transition discipline, honored. EXP-X-02
  adds its own: all four plan double-runs byte-identical (EV-014), and
  two full runner invocations reproduce the persisted artifacts
  byte-identically (wall-clock fields excepted, recorded as measured).
- **Determinism doctrine, honestly bounded**: within a contract version,
  same plan + same seed → byte-identical outputs (proven at every layer);
  ACROSS the v1→v2 boundary outputs change ONCE (the corrected wave
  mechanics — the C-5 draft note's "fingerprints stay valid" claim was
  honestly corrected in the ruling). Known nondeterminism, recorded not
  hidden: compositor raw MP4 encodes are byte-unstable across identical
  invocations (OBSERVED, EV-011) — composition is pinned by CONTENT
  fingerprint and the raw MP4 hash is excluded from digest sets by rule.
- **Falsifier-first culture**: every experiment record carries its
  falsifier; test flips are honest-gap transitions (the EV-008
  canonical-modes flip, the C-9 presence flip), never silent absorptions.

**Pointers**: EV-008, EV-010, EV-011, EV-014; the wave's commit series on
`work/wflx-v2-contract-wave` (each cites its EV records);
`scripts/station-review.sh`.

## (e) Dual-modality comparison — audio + video vs the LAB reference

**Summary**: what our two surfaces do on the SAME frozen source, against
what the real product was OBSERVED to do — with the lab-reproduction vs
product-observation boundary explicit:

| Dimension | Our lab (REPRODUCED) | Real product (OBSERVED, EV-009) |
|---|---|---|
| Audio: two-host dialogic modes | deep-dive/critique/debate skeletons with mode-native speaker-purpose pairing; parity-banded, question-answer linked (W2 QA) | two hosts, macro skeleton hook→roadmap→sections→synthesis; inter-host acknowledgment tokens at high cadence |
| Audio: Brief mode | C-10 monologic single narrator with enumeration spine (First/…/Finally) | 93.92 s single narrator, enumerated — the C-10 product truth |
| Audio: duration behavior | plan-authoritative targets, mass-fit allocation, honest over-budget flags; compression by salience omission (EXP-A-05) | Short = 3.78× depth compression preserving coverage; duration run-to-run ±10–20% |
| Video: explainer | storyboard + deterministic SVG renderer + compositor; structure 0/12-15 stable under mutation, surfaces reshuffled pre-C-5 (V-02/V-04) | one golden sample (415.66 s, narrated illustration family); no per-mode video corpus probed |
| Cross-modal spine | identical accounted/covered claim sets at identical (seed, duration) on the frozen fixtures; modality-exclusive v1 plans ruled DELIBERATE (HANDOFF 1, EV-010); EXP-D-01: 11/11 voiced (audio) vs 7/11 visualized (video) at 300 s | unprobed (the product does not expose a per-claim coverage view); the golden video's coverage was not claim-annotated |
| Determinism | byte-deterministic within version (double-run proofs) | surface-stochastic per generation (LAB-06 twin) |

**Honest boundary**: the audio-side comparison rests on SIX real product
probes (class (b)); the video-side comparison rests on ONE golden sample —
the LAB series probed audio modes only. Video product truth beyond the
golden artifact is UNRESOLVED. The EXP-D-01 dual-modality economics are
lab-reproduction evidence, NOT product behavior.

**Pointers**: EV-009, EV-010, EV-011 (EXP-D-01), EV-014;
`docs/experiments/records/EXP-D-01.yaml`.

## (f) Known limitations + HANDOFF ledger

**Summary** — the unresolved ledger, each labeled, none silently promoted:

- **C-8 (video narration field / motion params / dual-modality plan
  shape) — DEFERRED to v3 by the ruling**: its adjudication input (p3b's
  cross-modal IR delivery) came back ruling the v1 modality-exclusive
  plan DELIBERATE and compliant at the shared-spine level; a dual-modality
  plan restructure has no blocking evidence. Designated v3 candidate with
  EV-010/EV-011 as standing inputs. (HANDOFF 1, adjudicated.)
- **EXP-D-01 inputs standing**: the dual-modality comparison the roadmap
  needed is delivered through the current shape; the v3 line owns the
  plan-shape question.
- **Exclusions philosophy (the OUT list, each with its recorded reason)**:
  C-1 stance flags (structural path proven sufficient — no scene-typing
  need surfaced), C-2 per-claim evidence enforcement (fallback-fire rate
  UNMEASURED on canonical fixtures — defer unless a future measurement is
  material), C-4 interjection turns (no golden-reference turn-taking
  annotation; LAB-01/02 acknowledgment-token cadence supports but does
  not satisfy the H-3 ruling), C-6 language-bound graphs (documented v1
  boundary: ES surfaces voice EN anchors — code-switching; the real
  product regenerates natively, LAB-04 — editorial priority rises only if
  multi-language becomes a research line).
- **Multi-source graph consistency**: EXP-V-05/V-06 blocked honestly —
  the DeterministicExtractor produced an inconsistent graph on
  multi-source chains; HANDOFF to a source-surface wave (EV-011).
- **Compositor encoder nondeterminism** (OBSERVED): raw MP4 byte hashes
  differ across identical invocations on the same environment; content
  fingerprinting + digest exclusion by rule — recorded, not hidden.
- **Degenerate-target boundary** (UNRESOLVED, pre-fix behavior retained
  by design): below ~120 s on the canonical graph, some beats cannot
  voice their claims within their budget slice; the plan-level duration
  invariant outranks mass fit and W2 honestly flags residuals — never a
  silent drop (EV-008).
- **No incremental compile path** (OBSERVED, EXP-X-02): smallest-unit
  regeneration is verified at the DIFF level (byte-identity of untouched
  units), while the pipeline still re-executes the full compile; the
  realizer-layer micro-benchmark (0.615 ms full-graph vs 0.06 ms
  single-turn) bounds the eventual saving. Compile-cost optimization is
  not on any evidence line — review-cost was the design note's point.
- **Costs + latency posture** (work-order §Phase 4 items): real-product
  generation latency scales with target length (~7–8 min at ~20 min
  targets, OBSERVED LAB-01); AI usage meter with 5-hour refresh (PRO
  tier, OBSERVED) — the real product's per-generation cost was NOT
  probed beyond these observables (UNRESOLVED). Our lab runs offline
  deterministic providers at zero marginal cost; full-pipeline compiles
  measure ~4–5 s per 22-turn artifact (OBSERVED, EXP-X-02 wall-clock).
- **Security + authorization posture**: reference access is
  operator-gated (human Google session in the replay browser, VPN
  egress); no credentials, cookies, tokens or API keys are stored or
  committed (AGENTS.md rule — held across every wave; credential sweeps
  clean at each station review); the lab's own providers are offline by
  default.
- **Failure modes on record**: honest-gap test flips (EV-008), blocked
  multi-source arms (EV-011), encoder nondeterminism (EV-011),
  degenerate-target residuals (EV-008), the 9/27–9/28 platform outage
  root-cause + false-negative post-mortem (roadmap current-position) —
  the failure ledger is part of the package, per the evidence discipline.
- **WebFlix integration design** (the boundary): this lab must not
  directly modify payswapdotorg/WebFlix; the final deliverable is THIS
  promotion + integration handoff. The integration surface for the
  receiving team: the shared contracts (v2.0.0), the unified artifact
  manifest registry (27 records, reproducibility metadata per record),
  the evidence ledger, and this package. No production change is proposed
  by the assembler.

**Pointers**: the ruling's OUT list
(`docs/handoff/v2-contract-wave-draft.md`); EV-008, EV-010, EV-011,
EV-014; `docs/handoff/handoff-adjudications-001.md`.

---

## Verdict inputs, summarized for the TL

1. The v2 wave executed its ruling scope completely (C-3/C-5×2/C-7/C-9/
   C-10 + the fingerprint transition) with every gate green and the
   fingerprint-transition discipline honored (class (d)).
2. EXP-X-02 — the ruling's designated verification experiment — executed
   with ALL FOUR falsifiers passing and the station quality bar PASSED
   (EV-014): smallest-unit regeneration is TRUE at the audio text/timing
   layers under C-5, measured against the v1 control (1/22 vs 17/22
   changed units).
3. The product-truth series (EV-009) is present and honestly adversarial:
   the real product's stochasticity and global re-planning are DOCUMENTED
   as non-goals for our lab control, while its structural truths (mode
   restructure-not-reskin, monologic Brief, depth compression,
   native-language regeneration) are the evidenced deltas our v2 wave
   absorbed (C-10) or documented as boundaries (C-6, compression
   philosophy) (classes (b), (e)).
4. The unresolved ledger is explicit and none of it blocks the wave's own
   claims (class (f)); the v3 candidates (C-8 line) carry their standing
   inputs.

## TL SIGN-OFF

**SIGNED — TL #2, 2026-09-30 09:0x UTC (integration station).**

- Evidence classes (a)–(f) reviewed: **YES — all six reviewed in full** (golden
  reference identity incl. served-variant provenance; LAB-01..06 product-truth
  series with the restructure-not-reskin / monologic-Brief / depth-compression
  / native-language / stochasticity deltas honestly bounded as lab-control vs
  product-observation; the EXP-A/V/D/X series with EXP-X-02's A/B measurement;
  gates 332→338→352→370 history with byte-identity proofs at every boundary;
  the dual-modality comparison with its one-golden-sample video boundary
  explicit; the unresolved ledger with zero silent promotions).
- Gates re-verified at sign-off (typecheck / lint / chunked tests):
  **typecheck 0 errors; lint clean; 370/370 (151 contracts/source/director +
  123 audio + 82 video + 14 integration), 0 fail — TL-run at 813dcd6.**
- Determinism spot-check re-run (exp:x02 re-executed): **REPRODUCED —
  TL re-execution at the station reproduces the record exactly: A-control
  17/22 texts (16 non-target) + 21/22 gaps; B-treatment 1/22 (target only) +
  2/22 target-adjacent gaps; total duration delta 7806 ms = target 8000 ms +
  adjacent gaps −194 ms + 0 elsewhere; F1–F4 all PASS; station quality bar
  PASSED; all four in-runner double-runs byte-identical.**
- Verdict (PROMOTE / PROMOTE WITH CONDITIONS / HOLD): **PROMOTE.**
- Conditions / follow-ups assigned: none blocking. Standing follow-ups (v3
  line, already owned by the ledger): C-8 dual-modality plan shape with
  EXP-D-01 standing inputs; EXP-V-05/V-06 multi-source extractor
  consistency; compositor encoder nondeterminism remains excluded-by-rule
  (content-fingerprinted); C-1/C-2/C-4/C-6 stay OUT with recorded reasons.
- Date + signature: **2026-09-30, TL #2 (resident orchestrator,
  payswapdotorg/WebFlix-Lab integration station).**
