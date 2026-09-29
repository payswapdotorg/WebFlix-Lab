# Provider Matrix — stubs, real adapters, capability & determinism columns

TL #2 Phase 3 work-order item ("document provider matrix"). Truth source:
the provider ports and adapters as merged on main (W1 contracts + W2 Stage 2),
plus EV-004/EV-005/EV-006 evidence. Video/visual providers are pending W3
(Phase 2B) and listed as such — no video adapter exists on main yet.

## Audio speech providers (`src/providers/audio/`)

| Provider | File | Status | Credentials | nativeMultiSpeaker | maxSpeakers | perSpeakerVoiceParams | pronunciationHints | crossTurnConditioning | Determinism |
|---|---|---|---|---|---|---|---|---|---|
| DeterministicOfflineTtsAdapter | `deterministic-offline.ts` | IMPLEMENTED (default; env-flag `offline`) | none | no (per-turn) | 2 (per-turn stitch via mixing layer) | seed-keyed profiles | honored as hints (ignored in waveform) | n/a (stateless) | **byte-identical** per (seed, turn, speaker profile) — REPRODUCED (EV-004 determinism test, EV-006 spot-check) |
| GeminiMultiSpeakerTts | `gemini-multi-speaker.ts` (+ `gemini-multi-speaker-adapter.ts`, `factory.ts`) | IMPLEMENTED, mappings + credential posture unit-tested; **live dispatch UNRESOLVED** (requires TL-side `GEMINI_API_KEY` wiring; throws typed missing-credentials error, never fakes audio) | `GEMINI_API_KEY` (env, opt-in via `WFLX_AUDIO_SPEECH_PROVIDER=gemini`) | **yes** (whole-dialogue request, inline PCM response) | 2 | yes (voice configs per speaker) | yes (adapter-internal guidance) | yes (single dialogue request) | NOT byte-reproducible (remote model) — run-specific; provenance recorded per artifact |
| OpenLocalTts (open/local single-speaker engines, e.g. Chatterbox-style) | `open-local-tts.ts` | **INTERFACE ONLY** — pure mapping helpers, no runtime adapter yet (candidate open/local evaluation path) | none for self-hosted runtimes (endpoint/model injected) | no (one call per turn; stitching in mixing layer) | per-turn | voice-conditioning + style params shaped | shaped | no (per-turn) | runtime-dependent; adapter must record engine+version provenance when implemented |

### Mastering backends (mixing layer)

| Backend | Selection | Determinism |
|---|---|---|
| `pure-ts` | explicit option | **byte-identical** — pinned by canonical benchmarks, determinism tests and the EXP-A series (EV-004, EV-006) |
| `ffmpeg` (auto when on PATH) | default `auto` | environment-dependent encoders; **not** byte-portable across ffmpeg builds — provenance must record the encoder identity |

## Visual / video providers (Phase 2B — LANDED, PR #6 / EV-007)

| Provider lane | Path | Status |
|---|---|---|
| Deterministic SVG/diagram renderer | `src/video/render/` + `src/compositor/` | **LANDED** — pure functions, stable element order, fixed 2-decimal formatting; byte-identical regeneration pinned by committed benchmark fingerprints + mutation tests (EV-007) |
| Illustration provider adapter | `src/providers/visual/` | **LANDED** — deterministic offline ink adapter default (seeded procedural: paper texture, construction grid, controller knot, hex satellites, dashed rings, isometric slab); env-gated `image-model` adapter (OpenAI-compatible) throws on missing config, never silently degrades |
| Motion/video provider adapter | `src/providers/video/` | **LANDED** — parameterized camera planner (pan ≤ ±4%, zoom +3–8%, static default); remote motion adapter env-gated |
| Compositor | `src/compositor/` | **LANDED** — Remotion 4.0.529 primary (Playwright headless-shell, `React.createElement`, TL tsconfig untouched) + sealed offline fallback (SVG frames + ffmpeg/librsvg capability detection) |

## Cross-surface exercise log (P3B wave-2 integration runner — EV-011)

Every run below executed through the REAL merged pipelines via
`tools/experiments/runner.ts` (`bun run exp:integration`), seeded, fixed now;
two full invocations compared byte-for-byte through the output-set digest
(`artifacts/experiments/digest.json`, identical sha256 pair — REPRODUCED).
Records: `docs/experiments/records/EXP-A-01..06-R2.yaml`, `EXP-V-01..08.yaml`,
`EXP-D-01.yaml`.

| Lane | Exercised by | Capability observed | Determinism | Evidence |
|---|---|---|---|---|
| DeterministicOfflineTtsAdapter (speech) | EXP-A-01..06-R2 (9 audio arms: 4 modes, duration arm, ES arm) + EXP-D-01 audio arm | mode structure, duration compression, language invariance, mutation locality re-run under the EV-008-fixed Director; turn-over-budget = 0 on every canonical arm | **byte-identical** per (seed, turn, speaker) across invocations — in-run self-check re-executes one audio arm and asserts the media fingerprint; digest-stable | REPRODUCED (EXP-A-*-R2 records; digest pair) |
| `pure-ts` mastering | all audio arms above | full pipeline realization → WAV per arm | **byte-identical** across invocations (digest-stable) | REPRODUCED (EXP-A-*-R2, EXP-D-01; digest pair) |
| Deterministic SVG/diagram renderer + illustration (deterministic-ink) + motion (camera planner) | EXP-V-01..08 storyboard-layer arms (15 arms: mode/duration axis, style variant, custom-prompt mutation, claim mutation b30, seed variants surface/director, duration 90/180s) | scene structure histograms, per-scene SVG hashes, coverage, QA at the storyboard layer; style mutation is GLOBAL across scenes (EXP-V-02); claim mutation is plan-global via planHash keying (EXP-V-04 — C-5 defect class confirmed on the video surface) | **byte-identical** per-scene and combined-SVG hashes across invocations (digest-stable) | REPRODUCED (EXP-V records; digest pair) |
| Placeholder narration synthesis | EXP-D-01 dual-video arm | 14 narration segments; narration WAV hash stable | **byte-identical** across invocations | REPRODUCED (EXP-D-01; digest pair) |
| Compositor — Remotion 4.0.529 primary | EXP-D-01 dual-video arm (full pipeline + composition, MP4 rendered, fingerprinted, NOT committed — golden-media precedent) | 14 scenes / 300 s / 9000 frames @30fps 1280×720 h264+aac; QA `passed-with-issues` (4 coverage-gap warnings: 7/11 claims visualized vs 11/11 voiced) | **content-fingerprinted**: raw MP4 bytes are encoder-nondeterministic across invocations on the SAME environment (OBSERVED 2026-09-29: differing sha256 + size on identical inputs) — the composition is pinned by its CONTENT fingerprint (media structure + scene-SVG combined hash + plan + seed) in `determinism.json`; the single-run `artifact.json` media snapshot is excluded from the output-set digest by rule | OBSERVED (EXP-D-01; runner digest exclusion documented in `tools/experiments/runner.ts`) |
| Compositor — offline fallback (SVG frames + ffmpeg/librsvg) | NOT exercised in wave-2 (headless browser present → remotion backend selected on every run) | capability-detection path only | n/a this wave | UNRESOLVED (no run evidence) |
| GeminiMultiSpeakerTts / image-model / remote motion adapters | NOT exercised (offline deterministic defaults; live dispatch requires operator credentials — out of wave-2 scope) | — | — | UNRESOLVED (unchanged posture) |

Cross-surface note (REPRODUCED, EXP-D-01): the same (source, graph, seed)
through both surfaces yields identical accounted/covered claim sets; the v1
`OverviewPlan` is modality-exclusive by construction (see checklist §2 item 1
adjudication) — the shared IR is the SemanticGraph + claim universe + coverage
accounting + Director seeding.

## Rules carried by this matrix (AGENTS.md binding)

- Provider-specific request/response structs stay inside adapter modules —
  they are NOT shared-contract material.
- No credentials in code; env-injected; typed errors when missing; never fake
  audio.
- Every generated artifact carries provider identity + versions
  (`GeneratedArtifact.providers`) so non-deterministic providers remain
  auditable.
- The canonical test/benchmark path is the offline deterministic adapter +
  `pure-ts` mastering — fixture-only success is NOT product-parity evidence.
