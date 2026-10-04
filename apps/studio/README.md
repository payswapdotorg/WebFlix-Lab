# Operator Studio (apps/studio)

The lab's browser surface over the frozen pipeline. **WFLX-UI1** delivered
the shell: compile an **Audio Overview through the REAL WebFlix-Lab
pipeline** and play it in the browser. **WFLX-UI2** layered **Interactive
Audio** on top (surface D): join a session, ask a typed listener question at
a turn boundary, hear/see the source-grounded response inserted into the
overview — with the locality + grounding proofs rendered on screen.

Pick a checked-in source → compile (source adapter → understanding →
Director → plan → audio compile) → play the master WAV → inspect metadata,
transcript (timing-manifest-driven current-turn highlight), and the full
provenance sidecar → **join an interactive session** over that baseline.

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
| `POST /api/session` | `{overviewId}` → joins an `InteractiveAudioSession` over the stored baseline; returns `{sessionId, overviewId, turnCount, validBoundaries}` (interior turn indexes) |
| `POST /api/session/:id/intervene` | `{afterTurnIndex, listenerText}` → `session.intervene()` (the real machinery); returns the session timeline with inserted response turns, the session master (own artifact id), locality proof rows + the shift invariant, the grounding summary, and retrieval/response provenance |
| `GET /api/session/:id` | current session state: baseline id, joins, fork history |
| `GET /audio/:id/master.wav` | compiled master WAV — baseline overviews AND session masters (in-memory stores) |

Modes are exactly what the Director already supports (audio `deep-dive`
default, `brief`, `critique`, `debate`, canonical durations); durations are
curated within `[60, 600]` s. No invented modes. Language/audience are
pinned to the canonical `en` / `technical`.

## Interactive Audio (WFLX-UI2, surface D)

The operator journey (all in the browser, no CLI):

1. **Compile** an overview (e.g. the canonical deep-dive 5 min).
2. **Join Interactive Session** — the entry card appears after a successful
   compile and states the semantics up front: *each question re-forks the
   session from the baseline (lab semantics)*.
3. **Pick a turn boundary** — the transcript timeline gains `⑂` markers at
   every VALID interior boundary (`0..turns-2`, exactly what the machinery
   accepts; the last turn is never a boundary). Click a marker to arm it.
4. **Ask** — the ask box is a text input labeled exactly *“typed listener
   question — voice capture UNRESOLVED (text stand-in)”* (voice capture is
   UNRESOLVED; no microphone is offered or faked — LAB-13 / EXP-L-18). The
   two EXP-L-03 scripted questions are offered as one-click chips, labeled
   *scripted — not AI-suggested*.
5. **Hear + inspect the fork** — the timeline re-renders with the response
   turns (ack + grounded answer) INSERTED and highlighted at the boundary;
   the player loads the SESSION MASTER (its own artifact id — the baseline
   master stays one click away for comparison); the **locality table**
   renders per original turn: byte-identity verdict (all green = original
   WAV bytes reused), baseline → session startMs, and the shift column; the
   **invariant line** shows *post-boundary shift == inserted response
   total*; the **grounding panel** lists the retrieved claims (ids +
   statements), whether they matched by content, and the F1 verdict.
6. **Repeat** — every intervention is listed in the fork history (each an
   independent fork from the baseline; nothing is cumulative). Click a
   history entry to re-load its timeline + proofs.

Session behavior guarantees (handoff §7) are what the panels render —
original-turn byte identity across the boundary, order preserved,
translation-only shift, C-5 locality, same-machinery response — and the
router-level test battery (`apps/studio/test/session.test.ts`) asserts them
END-TO-END, including determinism (double-intervene → identical
session-master sha256).

**Semantics (binding):** each `intervene()` run forks from the STORED
baseline — the lab's fork-and-compare semantics. The product's cumulative
multi-turn chat is NOT imitated, and the UI labels that honestly. Re-joining
the same baseline reuses the session (join counter increments, fork history
preserved).

**Session registry law:** sessions, compiled overviews, and session masters
live in per-process in-memory Maps. A server restart resets everything —
accepted and labeled on the surface (`in-memory — restart resets`).

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
  sessions.ts      THE interactive session boundary: registry + InteractiveAudioSession driving
  api/             thin request handlers + the studio HTTP contract (types.ts)
  web/             zero-build static client (index.html, app.ts, styles.css)
  test/            bun test battery (boot, compile, manifest/URL, sessions, determinism)
```

`pipeline.ts` is orchestration only: it calls `MarkdownNoteAdapter` →
`DeterministicExtractor` → `compileOverviewPlan` → `compileAudioOverview`
and projects the result into the studio DTO. `sessions.ts` constructs
`InteractiveAudioSession` over the stored baseline and serializes
`InteractiveSessionResult` — it never re-implements retrieval, plan
construction, compilation, splicing, or proof evaluation. Zero domain
duplication, zero frozen-tree edits.

## Tests

```bash
bun test apps/studio
```

Covers: health/provider-state honesty, source enumeration (fingerprint
parity with the checked-in `reference-messy-note.source-artifact.json`),
the compile-route integration against the real pipeline (Director-derived
plan id proves no fixture shortcut), manifest/URL contracts, WAV
sidecar-hash equality, typed 4xx error bodies, the interactive session
routes (establish/valid boundaries, intervene asserting the §7 guarantees
end-to-end, session-master serving, double-intervene determinism, fork
history, typed error paths), static client serving, and the cross-boot
byte-identity proof.

## What W3 will add (not in this wave)

- **W3 (WFLX-UI3):** station integration + journey verification —
  provenance completeness audit across surfaces, this README's full form
  (run + verify + honest boundaries), station battery wiring, the
  end-to-end agent-browser journey verification, and the parity-close
  decision doc amendment.

## Honest boundaries (never implied otherwise)

- Microphone / voice capture is **UNRESOLVED**. The interactive ask box is
  the documented TYPED text-scripted stand-in (labeled verbatim on the
  surface); this studio offers no microphone, no ASR, and no voice input of
  any kind.
- Interactive sessions use the lab's **fork semantics** (each question
  re-forks from the stored baseline). The product's cumulative multi-turn
  chat is NOT imitated — labeled on the surface.
- The session registry + all compiled media are **in-memory only**; a
  server restart resets them.
- Speech is the offline deterministic placeholder provider; the audio is
  NOT product-parity evidence.
- Live providers (Gemini multi-speaker TTS, ZAI live TTS) stay env-gated
  OFF; the studio pins offline and only REPORTS their state — they are
  never switchable from the UI.
- The operator studio observes nothing about the Gemini product; it is a
  REPRODUCED-class research implementation.
