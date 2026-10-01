# WFLX-P2 — Video Parity Wave (Parity Completion Phase, Wave 2 of 3)

Document status: recorded 2026-10-01 by WFLX-P2 (first worker commit; the
dispatched work order is reproduced below VERBATIM with ONE exception:
the §7 push PAT value is redacted as `<REDACTED — push-URL-only credential>`
per the WFLX-P1 credential-hygiene precedent (commit bb0ca1f) and the AGENTS.md
ground rule "Never commit authentication state" — the work order's own §0 rule
"NEVER commit any credential, token, key, or auth state to files or history"
overrides verbatim reproduction for that single value; no other byte was
changed).

You are WFLX-P2, the video-parity implementer for the WebFlix-Lab program.
The R&D roadmap (Phases 0-4) is COMPLETE on `main` (PR #10, CONTRACTS_VERSION
2.0.0, TL-signed PROMOTE); the Parity Completion Phase is open (canonical
charter: `docs/work-items/parity-completion-work-order.md` — READ FIRST).
Wave 1 (WFLX-P1, audio parity) is expected merged or in final review; your
baseline is latest `main` after P1's merge. Your wave = the VIDEO track:
Explainer refresh + Short + Cinematic, with REAL generative provider
execution where the sandbox allows it. Canonical phase charter §2 (frozen
architecture) and §5 (TL-rejects) are binding.

Deadline pressure is real — but the quality bar does NOT drop. The TL
rejects: cinematic claims based only on SVG/Remotion improvements,
"adapter exists" treated as "provider works", simulated production-provider
results presented as real. NEVER fake generative output as real.

## 0. Identity and ground rules

- Repo: `https://github.com/payswapdotorg/WebFlix-Lab.git` (public read).
- Baseline: latest `main` (must contain parity-completion-work-order.md AND
  the WFLX-P1 delivery — 31-WFLX-P1-AUDIO-PARITY.md + EV-016/017/018; if
  P1 is NOT merged, work from latest main anyway and treat P1 surfaces as
  read-only context — do not depend on unmerged APIs).
- Branch: `work/wflx-p2-video-parity` from main. Push with the PAT below;
  NEVER open PRs / never merge (TL-owned); NEVER commit any credential,
  token, key, or auth state to files or history.
- You own (additive only): `src/video/`, `src/providers/visual/` (create if
  absent), `src/providers/video/` (create if absent), `src/compositor/`,
  `tests/video/`, `experiments/`, `artifacts/video/`, plus `package.json`
  script entries. Do NOT touch `src/contracts/` (CONTRACTS_VERSION stays
  2.0.0; the VideoScene contract gains NO new required fields — Cinematic
  composition lives behind existing surfaces or additive optional fields
  with defaults), `src/source/`, `src/director/`, `src/audio/`. Needed
  changes there go in your report as HANDOFF.
- Evidence labels (AGENTS.md): OBSERVED / DOCUMENTED / HYPOTHESIS /
  REPRODUCED / UNRESOLVED. Never silently promote HYPOTHESIS to FACT.
- Determinism spine: the OFFLINE deterministic pipeline stays the DEFAULT;
  its committed fingerprints stay valid. Live/generative surfaces are
  env-gated, honestly bounded, provenance-recorded.

## 1. Setup (verify before working)

~~~bash
git clone https://github.com/payswapdotorg/WebFlix-Lab.git
cd WebFlix-Lab && git checkout main && git log --oneline -3
git checkout -b work/wflx-p2-video-parity
bun install
bun run typecheck && bun run lint
bun test tests/contracts tests/source tests/director
bun test tests/audio      # includes P1's additions if merged
bun test tests/video
bun test tests/integration
~~~
(record exact per-chunk numbers — the EV-011 chunked doctrine; bare
`bun test` at root discovers only a subset. ALWAYS run the four chunks.)

Read in order: `AGENTS.md`; `docs/work-items/parity-completion-work-order.md`
(§2 frozen architecture — esp. the Cinematic target shape; §5 TL-rejects);
`docs/promotion/promotion-decision.md` (honest-boundary style);
`docs/experiments/protocol.md` + `record-template.yaml`; the actual
`src/video/` + `src/compositor/` trees (StyleBible, storyboard compiler,
SVG renderer, illustration/motion provider ports, compositor + offline
fallback, QA) — ADAPT TO WHAT IS REALLY THERE.

FIRST COMMIT: this work order verbatim as
`docs/work-items/32-WFLX-P2-VIDEO-PARITY.md` (dated 2026-10-01).

## 2. Deliverable A — Explainer refresh (EV-019)

- Re-run the canonical Explainer benchmark on the current v2 baseline
  (the last full run predates the v2 wave): record current behavior at the
  wave HEAD — structure/coverage/QA numbers, double-run byte-identity
  (determinism), packet digest.
- Custom-style behavior arm: exercise the StyleBible custom-prompt layer
  (EXP-V-07 pattern) on the v2 baseline — record the behavior delta.
- Narration/visual synchronization check: scene-local narration timing vs
  the v2 content-keyed seeding (C-5 video surface) — confirm locality on a
  single-scene mutation (the video-surface analog of EXP-X-02: mutate one
  scene's claim → ONLY that scene's visual surface changes; structure 0
  reshuffle). If a video-surface locality experiment does not exist yet,
  build it as EXP-V-L-01 — this is the C-5 regression proof for video.
- Artifacts under `artifacts/video/exp-e-refresh/` (+ exp-v-l-01 if built);
  EV-019 registry record.

## 3. Deliverable B — Short format (~60s; EV-020)

- Dedicated ~60-second mode: a Short compile path that preserves skeleton/
  structure while compressing per-scene depth — mirroring the real product's
  documented Short behavior (~60s) and our audio-side EXP-A-05/LAB-03
  product truth (depth compression, coverage preserved).
- Behavior requirements: opening/hook scene prominence; scene density
  scaling (fewer claims visualized at 60s); coverage-accounting invariant
  (every claim accounted: visualized OR explicitly flagged as coverage gap —
  EXP-D-01 discipline, never a silent drop); QA passes or passes-with-issues
  with honest flags.
- EXP-V-S-01: canonical fixture at 60s target — record structure, coverage
  accounting, duration band, determinism (double-run byte-identical).
- Falsifiers: F1 structure preserved (scene count/skeleton class within the
  recorded band); F2 coverage accounting closed; F3 duration within explicit
  band of target; F4 determinism.
- Tests: short-format compression invariants in `tests/video/`.
- Artifacts under `artifacts/video/exp-v-s-01/`; EV-020 registry record.

## 4. Deliverable C — Cinematic asset pipeline (EV-021, EV-022)

The real product's Cinematic = generative video/image models + an iterative
creative-director workflow. Lab reconstruction per the frozen architecture
§2 — OverviewPlan → Creative Director/Scene Strategy → Visual Asset Plan
(deterministic diagrams | illustrations | source-derived media | generative
animation | video-generation jobs) → Asset Validation → Timeline/Composition
→ QA → Local regeneration. Deterministic structure + stochastic media +
content fingerprints + provider provenance + local regeneration.

### C1 — Cinematic compile layer (EV-021)

- `CinematicDirector` (additive in `src/video/`): scene strategy over the
  existing OverviewPlan — continuity-aware scene planning (scene-to-scene
  visual/subject continuity constraints), camera/motion planning (a
  deterministic shot-plan vector per scene: shot class, camera move, pace),
  style continuity (StyleBible-derived cinematic params), asset reuse where
  appropriate (the same subject reuses its asset identity across scenes).
- `VisualAssetPlan` layer: per-scene asset jobs typed by the five classes
  above; deterministic diagrams/labels stay on the EXISTING deterministic
  renderer (frozen architecture: exact labels/numbers/relationships are
  deterministic-authoritative); generative jobs are provider adapters.
- Asset validation: per-asset QA gates (dimensions, format, provider
  metadata, content fingerprint) before composition.
- Composition: extend the compositor timeline to interleave deterministic
  and generative assets with the shot plan; QA evaluates structure,
  continuity markers, and honesty flags.
- Deterministic structural metadata surrounding stochastic assets: the
  shot plan, scene structure, asset identities, and validation results are
  deterministic and fingerprinted; the generative MEDIA bytes are
  content-fingerprinted with provider provenance (the compositor
  raw-MP4 exclusion-by-rule discipline extends to generative assets).
- Local regeneration: regenerating ONE scene's generative asset does not
  touch other scenes' plans or deterministic surfaces (C-5 discipline at
  the asset layer — prove with a single-asset regeneration diff).
- EXP-V-CIN-01: canonical fixture through the cinematic layer with the
  OFFLINE generative stand-in (deterministic placeholder renderer behind
  the same job interface) — full trajectory + double-run byte-identity.
  EV-021 registry record. Falsifiers: F1 determinism (double-run
  byte-identical plan+metadata); F2 local regeneration (single-asset
  regen touches only that asset); F3 structure/continuity constraints
  hold (validator PASS); F4 QA passes or flags honestly.

### C2 — REAL generative provider execution (EV-022)

- Implement a live provider adapter exercising REAL image/video generation
  through `z-ai-web-dev-sdk` (server-side; devDependency): image generation
  for illustration/storyboard assets, and video generation for cinematic
  motion shots if the SDK video path is available in your sandbox.
  Env-gated (`WFLX_VISUAL_PROVIDER=live-zai` / `WFLX_VIDEO_PROVIDER=live-zai`;
  defaults stay offline). NO secrets in git; provenance records the actual
  provider + model ids.
- EXP-V-CIN-LIVE-01: run a REDUCED cinematic arm (2-3 scenes) through the
  LIVE provider — record real generated assets (committed under
  `artifacts/video/exp-v-cin-live-01/` with artifact.json + provenance +
  content fingerprints), wall latency per asset, provider metadata,
  validation results.
- Falsifiers (structural — generative output is honestly stochastic):
  F1 every generated asset passes its validation gate; F2 deterministic
  metadata unchanged between offline and live runs of the same plan (the
  plan is provider-independent); F3 provenance records real provider ids;
  F4 offline baseline outputs byte-UNCHANGED when live flags are off.
- IF the SDK is genuinely unavailable/erroring: implement adapter +
  harness completely, run the experiment in harness-recorded mode, mark
  live execution EXPLICITLY UNRESOLVED with the exact blocker — honest
  partial, NEVER simulated-as-real.
- EV-022 registry record.

## 5. Real-product comparison hooks (for the P3/closure wave)

- Where a behavior dimension maps to the real product (Short ~60s; cinematic
  shot density; style continuity), record the comparison HOOK (metric name +
  lab measurement) in your experiment records — the actual real-product
  captures are Worker 3/TL scope, NOT yours. Mark each as COMPARISON PENDING
  REFERENCE CAPTURE. Do not fabricate product-side numbers.

## 6. Regression preservation

- The 370+ baseline (plus P1's additions) stays green; your new tests add on
  top — record chunk numbers before/after.
- No CONTRACTS_VERSION bump; no committed fingerprint changes to existing
  artifacts (verify with the manifest packet digest double-run — no-transition
  proof; NEW artifacts are additive entries).
- C-5 regression: EXP-X-02 re-run reproduces (audio surface) + your new
  video-surface locality experiment (Deliverable A) passes.

## 7. Docs + delivery

- roadmap-status.md: append the WFLX-P2 section (delivered / UNRESOLVED per
  deliverable — work-order §4 gate discipline).
- Evidence registry: EV-019 / EV-020 / EV-021 / EV-022 per protocol.
- Gates before push (four chunks + typecheck + lint): record exact numbers.
  Credential sweep over your diff = 0 hits (`rg -i "ghp_|sk-|api[_-]?key|secret"
  --glob '!*.lock'`).
- Push: `git push -u origin work/wflx-p2-video-parity` with PAT
  `<REDACTED — push-URL-only credential; injected into the push URL at
  dispatch time, never in files/commits>`
  (URL: `https://<PAT>@github.com/payswapdotorg/WebFlix-Lab.git`; PAT for
  the push URL only — never in files/commits).
- Final message: `WFLX-P2 COMPLETION REPORT` — (A/B/C1/C2) delivered per
  dimension with VERIFIED / EXPLICITLY UNRESOLVED; files touched grouped;
  gate numbers (chunks + totals + new-test counts); EXP-X-02 re-run +
  video locality numbers; packet digest pair; honest boundaries; HANDOFF
  entries; comparison-pending hooks list; branch + HEAD sha. No
  placeholders; report ONLY what you verified.
