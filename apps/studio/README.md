# Operator Studio (apps/studio)

The lab's first user-facing surface (WFLX-UI1): a minimal, honest operator
console for compiling an **Audio Overview through the REAL WebFlix-Lab
pipeline** and playing it in the browser.

Pick a checked-in source → compile (source adapter → understanding →
Director → plan → audio compile) → play the master WAV → inspect metadata,
transcript (timing-manifest-driven current-turn highlight), and the full
provenance sidecar.

Everything this surface produces is **REPRODUCED-class lab evidence**
(AGENTS.md) — compiled by the offline deterministic speech provider
(placeholder audio). It is **not** the Gemini Notebook product, and it never
claims product parity.

## Run it

```bash
bun run studio        # == bun run apps/studio/server.ts
```

**Port law: 4313, fixed.** The server always serves `http://localhost:4313`
(no `PORT` env override). The station gateway only exposes `:3000` (the
replay console): the TL verifies this UI with agent-browser directly at
`:4313`, and the operator reaches it through the station's replay browser.

No build step, no bundler, no new npm dependency. The client is plain
HTML + CSS + vanilla TypeScript; `/app.js` is `web/app.ts` served
type-stripped at request time (Bun's transpiler). The root
`bun run typecheck` run typechecks every studio file, including the client
(the client declares its narrow DOM surface locally because the root tsc
program deliberately carries no `DOM` lib — adding one would change
`Response`/`BodyInit` resolution for frozen test files).

## Surface

| Route | What it does |
|---|---|
| `GET /` | the studio client (dark lab theme) |
| `GET /api/health` | `{ok, version, provider}` — active provider id + env-gated live providers' STATE only |
| `GET /api/sources` | checked-in fixtures usable as real pipeline sources, with repo-computed sha256 fingerprints |
| `POST /api/overview` | `{sourceId, mode?, durationSeconds?}` → compiles through the real pipeline; returns plan metadata, timing manifest, transcript, artifact sidecar, and `audioUrl` |
| `GET /audio/:id/master.wav` | the compiled master WAV (in-memory store) |
| `POST /api/session` | **501 stub** — W2 boundary hook |
| `POST /api/session/:id/intervene` | **501 stub** — W2 boundary hook |

Modes are exactly what the Director already supports (audio `deep-dive`
default, `brief`, `critique`, `debate`, canonical durations); durations are
curated within `[60, 600]` s. No invented modes. Language/audience are
pinned to the canonical `en` / `technical`.

## Determinism spine

The studio pins fixed constants (`STUDIO_DIRECTOR_SEED`,
`STUDIO_AUDIO_SEED`, `STUDIO_NOW = 2026-10-04T00:00:00Z`), the **offline
deterministic speech provider**, and the **pure-TS mastering backend**. Two
independent server boots fed identical compile requests produce
**byte-identical master WAVs** — asserted in
`apps/studio/test/determinism.test.ts` (the test boots two port-0 instances
of the same server module; the fixed 4313 port law applies to the dev
command).

Compiled media lives in memory only. The studio NEVER writes `artifacts/`,
never touches `docs/experiments/records/**`, `registry.json`, or any
committed fingerprint.

## Layout

```
apps/studio/
  server.ts        Bun.serve entry (port 4313) + createStudioServer() factory
  pipeline.ts      THE wiring point to the real pipeline (imports src/... only)
  api/             thin request handlers + the studio HTTP contract (types.ts)
  web/             zero-build static client (index.html, app.ts, styles.css)
  test/            bun test battery (boot, compile, manifest/URL, stubs, determinism)
```

`pipeline.ts` is orchestration only: it calls `MarkdownNoteAdapter` →
`DeterministicExtractor` → `compileOverviewPlan` → `compileAudioOverview`
and projects the result into the studio DTO. Zero domain duplication, zero
frozen-tree edits.

## Tests

```bash
bun test apps/studio
```

Covers: health/provider-state honesty, source enumeration (fingerprint
parity with the checked-in `reference-messy-note.source-artifact.json`),
the compile-route integration against the real pipeline (Director-derived
plan id proves no fixture shortcut), manifest/URL contracts, WAV
sidecar-hash equality, typed 4xx error bodies, W2 session stubs, static
client serving, and the cross-boot byte-identity proof.

## What W2 / W3 will add (not in this shell)

- **W2 (WFLX-UI2):** Interactive Audio on this shell — replaces the 501
  `POST /api/session` / `POST /api/session/:id/intervene` stubs with real
  `InteractiveAudioSession` wiring and renders the session UI. The typed
  listener input is planned there as **text input first** (scripted
  stand-ins, exactly like `experiments/run-interactive-audio.ts`).
- **W3 (WFLX-UI3):** agent-browser verification of the full operator
  journey over the merged shell.

## Honest boundaries (never implied otherwise)

- Microphone / voice capture is **UNRESOLVED**. This surface offers no
  microphone, no ASR, and no voice input of any kind.
- Speech is the offline deterministic placeholder provider; the audio is
  NOT product-parity evidence.
- Live providers (Gemini multi-speaker TTS, ZAI live TTS) stay env-gated
  OFF; the studio pins offline and only REPORTS their state — they are
  never switchable from the UI.
- The operator studio observes nothing about the Gemini product; it is a
  REPRODUCED-class research implementation.
