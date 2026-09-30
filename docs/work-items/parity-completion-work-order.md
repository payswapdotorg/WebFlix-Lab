# Parity Completion Phase — Canonical Work Order

Document status: **RULING 2026-09-30 21:35 UTC by TL #2** (adapted from the
operator's Final TL #2 Handoff, which supersedes and retires the staged
"WFLX-V3 combined wave" plan). This document is the canonical anchor for
the phase; chat history and older drafts do not reopen it.

## 0. Takeover point (canonical state)

- `main` @ `f43b08d`; PR #10 merged; `CONTRACTS_VERSION` 2.0.0.
- Phase 4 promotion package SIGNED by TL #2 on 2026-09-30 (verdict PROMOTE);
  gates at the signed HEAD: typecheck 0 errors, lint clean, 370/370
  (151+123+82+14, chunked per EV-011); EXP-X-02 re-executed and reproduced.
- **The reconstruction/R&D roadmap is COMPLETE. Gemini Notebook product
  parity is NOT yet complete.** The next phase is a Parity Completion Phase,
  not another generic architecture phase. Completed decisions stay closed.

## 1. Mission

Bring the Overview Studio from a validated reconstruction laboratory to a
rigorously benchmarked implementation covering the currently observable
Gemini Notebook Audio and Video Overview feature set:

- **Audio**: Deep Dive, Brief, Critique, Debate; custom steering prompts;
  language selection; length controls; background generation;
  downloadable/shareable artifacts; **Interactive Audio Overview** (listener
  verbally joins the hosts, receives a source-grounded response, original
  overview resumes); 80+ languages.
- **Video**: Explainer, **Short (~60s)**, **Cinematic**; language controls
  for supported formats; visual-style selection; custom visual style;
  steering prompts; background generation; downloadable/shareable artifacts.
- Cinematic is a materially newer capability (Gemini 3 + Nano Banana Pro +
  Veo 3, Gemini as creative director with iterative refinement) — treat as
  a distinct major capability, NOT approximated by more SVG scenes.

## 2. Frozen architecture — DO NOT DRIFT

Source → Normalize → Understand → Plan → Generate → Compose → Evaluate →
Publish. Core IR: `SourceArtifact { ClaimRecord[] / EntityRecord[] /
TopicRecord[] / RelationshipRecord[] } → OverviewPlan { AudioTurn[] /
VideoScene[] }`. Director = editorial decisions only. Providers = adapters.
Deterministic rendering authoritative for exact labels/numbers/relationships/
diagrams/quotations/machine-verifiable structure. Generative models for
illustration/metaphor/atmosphere/non-critical texture/useful motion/cinematic
visual generation. **Local regeneration remains the governing refinement
principle. Do NOT replace the compiler with one giant prompt, an opaque
agent, or a provider-specific implementation.**

Cinematic target shape (provider-independent):

```text
OverviewPlan → Creative Director / Scene Strategy → Visual Asset Plan
  (deterministic diagrams | illustrations | source-derived media |
   generative animation | video-generation jobs) → Asset Validation →
  Timeline / Composition → QA → Local regeneration
```

The lab reproduces observable OUTPUT BEHAVIOR and quality envelope through
replaceable providers — never Google's private internals.

## 3. Wave structure (replay-sequential; one generation lane)

Per the org chart (three workers → cross-modal QA → parity promotion gate),
executed as sequential replay-dispatched waves:

- **WFLX-P1 (Wave 1) — Audio parity**: real live TTS provider execution
  through the existing adapter interface (env-gated, default offline
  unchanged); provider credential/config wiring with NO secrets in git;
  voice/provider provenance; production-quality speech benchmark suite
  (speaker consistency, pacing/pause, pronunciation, multi-language, mode,
  duration); Interactive Audio architecture + prototype (interruption →
  source-grounded response → resume-original-overview); C-5 locality
  regression preservation. Owns `src/audio/`, `src/providers/audio/`,
  `tests/audio/` (additive).
- **WFLX-P2 (Wave 2) — Video parity**: Explainer benchmark refresh; Short
  dedicated ~60s mode (duration/coverage/hook/scene-density/compression
  behavior); Cinematic asset pipeline (visual asset planning, generated
  animation/video support, continuity-aware scene planning, style/camera
  motion continuity, asset reuse, local asset regeneration, cinematic QA,
  deterministic structural metadata surrounding stochastic assets — content
  fingerprints + provider provenance). Owns `src/video/`,
  `src/providers/visual/`, `src/providers/video/`, `src/compositor/`,
  `tests/video/` (additive).
- **WFLX-P3 (Wave 3) — Reference/benchmark/parity lab**: next-generation
  black-box evidence program with FRESH real-product captures (operator-
  gated through the replay browser — the LAB-series pattern): Audio
  Deep Dive/Brief/Critique/Debate/language/duration/custom prompt/
  Interactive Audio; Video Explainer/Short/Cinematic/language/visual style/
  custom prompt/source mutation/repeated generation. Every comparison
  record carries: reference config, source fingerprint, artifact
  fingerprint, timestamp, format, language, duration, custom prompt,
  observations, screenshots where needed, transcript/scene annotations,
  comparison against lab artifact, confidence, unresolved behavior.
  Owns `docs/experiments/`, `docs/reference/`, `reference/`,
  `artifacts/reference/`; `tests/integration/` only through TL coordination.
- **Cross-modal QA + parity promotion gate (TL-owned close)**: TL #2 owns
  shared-contract changes, provider-contract changes, cross-modal
  architecture, benchmark definitions, evidence integrity, reference-product
  comparison, integration, regression gates, parity verdict, final
  promotion package.

## 4. Acceptance gates (phase-level; per-wave subsets go in wave work orders)

Existing gates remain mandatory (typecheck 0 / lint clean / ≥370 tests /
credential sweep / determinism within deterministic layers / provenance).
Added for the phase, each capability must end VERIFIED or EXPLICITLY
UNRESOLVED with evidence why: real audio provider exercised; Interactive
Audio verified; real video provider exercised; Explainer benchmark
refreshed; Short benchmark completed; Cinematic benchmark completed; audio
quality comparison; video quality comparison; multi-language comparison;
custom-prompt comparison; failure-mode comparison; local regeneration
regression.

## 5. TL #2 rejects (standing quality bar)

Fixture-only claims; screenshot-only parity claims; LLM self-assessment;
"adapter exists" treated as "provider works"; simulated production-provider
results presented as real; cinematic claims based only on SVG/Remotion
improvements; claims based on stale Gemini Notebook behavior. Google's
official documentation = documented-capability source; direct observation =
product-truth evidence (kept separate).

## 6. Do-not-disturb list (validated decisions)

C-5 per-unit content-keyed seeding; C-7 shared rate model; C-9
`styleBibleVersion`; C-10 monologic Brief; CONTRACTS_VERSION 2.0.0;
provenance model; unified manifest; evidence classifications; provider
abstraction; deterministic structural rendering; smallest-unit refinement
architecture; WebFlix production boundary (this repo stays an R&D/promotion
laboratory; `payswapdotorg/WebFlix` untouched; integration consumes only a
validated promotion surface). Standing gaps that stay v3-line ledger entries
(C-8 dual-modality plan shape; EXP-V-05/V-06 multi-source extractor;
compositor raw-MP4 byte nondeterminism; incremental compilation; unresolved
real-provider cost measurements) — none reopen the completed v2 wave.

## 7. Definition of done

The phase is complete when the repo truthfully demonstrates: authorized
source → source intelligence → overview director → overview plan →
(audio: production TTS | video: Explainer/Short/Cinematic) → composition →
QA → local refinement → publication — benchmarked against CURRENT Gemini
Notebook behavior (not historical NotebookLM), with every claimed parity
capability holding an implementation + a reproducible test or benchmark +
evidence of what was actually observed in the real product; anything not
established remains explicitly UNRESOLVED.

*Dispatched from inside the replay per the standing operator directive;
every wave station-reviewed (scope/gates/determinism/credentials) before
the next dispatch; deliveries git-push-first (durable across sandbox
recycles).*
