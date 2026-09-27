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

## Visual / video providers (Phase 2B — PENDING W3)

| Provider lane | Planned path | Status |
|---|---|---|
| Deterministic SVG/diagram renderer | `src/compositor/` | PENDING W3 |
| Illustration provider adapter | `src/providers/visual/` | PENDING W3 |
| Optional motion/video provider adapter | `src/providers/video/` | PENDING W3 |

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
