Dispatched: 2026-10-04 (TL #2)

# WFLX-UI1 — Operator Studio: App Shell + Source/Overview UX (Worker 1)

You are Worker 1 (W1) on the WebFlix-Lab parity/UI line. TL #2 has reviewed
and adjudicated the architecture; this work order is your contract. First
commit records this file verbatim as docs/work-items/35-WFLX-UI1-STUDIO-SHELL.md
with a dated header line `Dispatched: 2026-10-04 (TL #2)` above the title.

Repository: https://github.com/payswapdotorg/WebFlix-Lab
Baseline: main @ 5f71de77e17273d272da8512c9b6b5fea43f7921 (clone fresh; verify with `git log --oneline -1`).
Branch: `work/wflx-ui1-studio-shell` (cut from main). Push with the PAT
below. NEVER open PRs, never merge — TL-owned. NEVER commit any
credential/token/key to files or history (PAT is for `git push` only).

GITHUB_PAT (git push only, never commit): [REDACTED — push credential, never committed]

Read before coding: AGENTS.md, README.md, docs/audio/interactive-audio-architecture.md,
docs/promotion/parity-close-decision.md (§1 capability 2), experiments/run-interactive-audio.ts,
src/audio/index.ts, src/audio/interactive/session.ts, tests/audio/fixtures.ts.

## Mission (TL architecture ruling — binding)

The lab has NO user-facing UI. Build the minimal Overview Studio so the
operator can: pick a checked-in source -> compile an Audio Overview through
the REAL pipeline -> play the artifact in the browser -> see metadata +
provenance. W2 (dispatched after your merge) layers Interactive Audio on
your shell; W3 verifies the full journey with agent-browser. Your shell must
expose the session boundary hooks W2 needs (see §Deliverable D).

### Architecture (least-invasive, TL-ruled)

```
apps/studio/                     <- everything UI lives here (new top-level dir)
  server.ts                      <- Bun.serve HTTP server (port 4313, fixed)
  api/                           <- request handlers (thin boundary, NO domain logic)
  web/                           <- zero-build static client (HTML+CSS+vanilla TS)
    index.html  app.ts  styles.css
  test/                          <- bun test files (extend the root battery)
  README.md                      <- run instructions
```

- The server imports the EXISTING compiler from `../../src/...` — it NEVER
  re-implements parsing/planning/grounding/synthesis/QA. One compile call,
  one session call (stub route for W2), zero domain duplication.
- The client is STATIC — no bundler, no framework, no CDN, no new npm
  dependencies at all (root package.json stays untouched except the one
  studio script). Vanilla TS in a `<script type="module">`, typechecked by
  tsc. Product quality via careful CSS (dark lab theme, clear hierarchy,
  obvious primary actions, loading/error/empty states) — NOT via framework
  polish.
- Frozen trees are READ-ONLY for you: src/contracts, src/source, src/director,
  src/audio, src/video, src/compositor, plus tests/** and experiments/**
  (existing files). If you believe a frozen tree needs a change, STOP and
  record a HANDOFF note instead.

### Port and dev command

`bun run apps/studio/server.ts` serves http://localhost:4313. Add
`"studio": "bun run apps/studio/server.ts"` to package.json scripts. The
station gateway only exposes :3000 (the replay console) — the TL verifies
your UI with agent-browser at :4313 and the operator can view it through the
replay browser; document both in apps/studio/README.md.

## Deliverables (each VERIFIED with evidence or EXPLICITLY UNRESOLVED — the §4 gate law)

### A. Source surface — VERIFIED
- `GET /api/sources` enumerates the checked-in fixtures usable as REAL
  pipeline sources. Minimum: the canonical
  `fixtures/reference-messy-note-redacted.md` (the LAB-series fixture). The
  compile path MUST run the real chain (source adapter -> understanding ->
  Director -> plan -> audio compile) on the selected fixture — no
  tests-fixture shortcut, no pre-baked plan JSON. Expose whatever mode/
  length surface the existing Director/compile path already supports
  (canonical deep-dive default); do NOT invent new modes.
- The landing view lists sources with fingerprint (sha256, as the repo
  computes it) and clearly labels the surface as the WebFlix-Lab research
  implementation (not Gemini Notebook).

### B. Overview surface — VERIFIED
- `POST /api/overview {sourceId, mode?}` compiles through the real pipeline
  (offline deterministic provider — the default; the response reports the
  provider id honestly; env-gated live providers stay OFF and only their
  STATE is indicated, never switched from the UI).
- Response includes: plan metadata (mode, duration, speaker/turn counts,
  planHash), provenance/evidence identifier (artifact id + the repo's
  artifact.json conventions where applicable), timing manifest, and the
  playable audio (WAV bytes served at a URL like /audio/:id/master.wav).
- Client player: play/pause, seek, progress bar, current-turn highlight
  driven by the timing manifest, metadata panel, provenance panel. Compile
  shows a loading state; errors show an actionable error state; before any
  compile the overview panel shows a proper empty state.

### C. App states — VERIFIED
- loading (compile), error (compile/play failures surfaced with detail),
  empty (no overview yet), playing (live progress + current turn),
  provider state (offline default shown honestly). NO dead buttons: every
  visible control does exactly what it says; anything not implemented yet
  is NOT rendered (do not ship pretend controls).

### D. Session boundary hooks for W2 (stub routes, contract-ready) — VERIFIED
- `POST /api/session {overviewId}` -> 501 with a typed error body
  `{error: "not-implemented-by-w1", handoff: "wflx-ui2"}` and the route
  registered; `POST /api/session/:id/intervene` same. W2 replaces the
  handlers — the client renders nothing for these yet (W2 owns that UI).
- `GET /api/health` -> `{ok, version, provider}`.

### E. Gates — VERIFIED
- `bun run typecheck` 0 errors — include apps/studio in the root tsc run
  (extend tsconfig include OR add a project reference; your choice must
  keep the single `tsc --noEmit` entrypoint green).
- `bun run lint` clean (eslint covers apps/ by default; keep the code
  lint-clean under the repo's strict rules incl. no-explicit-any).
- `bun test` — existing 474 tests stay green; add yours under
  apps/studio/test/ (compile-route integration against the real pipeline,
  manifest/URL contracts, source enumeration, health). Battery becomes
  474+N — report the exact new total.
- Credential sweep over your full diff: 0 hits.
- Determinism spine untouched: you add NO artifacts under
  artifacts/**, NO changes to docs/experiments/records/**, registry.json,
  or any committed fingerprint. Two `bun run apps/studio/server.ts` boots +
  identical compile requests produce byte-identical master WAVs (assert in
  a test).

### F. Docs — VERIFIED
- apps/studio/README.md: what it is, how to run (bun run studio), the port
  law (4313), what W2/W3 will add, the honest boundary (typed listener
  input planned for W2; microphone UNRESOLVED — never implied otherwise).
- README.md (repo root): one new short section "Operator Studio (apps/studio)"
  with the run command. Do not rewrite anything else.

## Evidence classification (binding, AGENTS.md)

Everything you build is REPRODUCED-class lab implementation. The UI does
not observe the Gemini product; do not create OBSERVED claims. No parity
experiment changes. docs/promotion/parity-close-decision.md is NOT touched
by you (W3/TL amend it later with the new evidence class).

## Delivery discipline

- Work in small commits with clear messages; final state = branch pushed to
  origin (`git push -u origin work/wflx-ui1-studio-shell`). Push FIRST,
  keep pushing as you go (durable across sandbox recycles).
- In your FINAL message (chat): branch name, HEAD sha, files-touched list,
  gate results (typecheck/lint/battery counts), the byte-identity proof of
  the double-boot double-compile test, honest UNRESOLVED list.
- The TL station-reviews: scope, ownership, gates, credential sweep,
  determinism, and an agent-browser pass over your shell BEFORE merge.

## Non-goals (hard)

No Interactive Audio UI (W2). No journey/verification suite (W3). No new
npm deps. No frozen-tree edits. No artifacts/ writes. No PRs/merges. No
live-provider activation. No microphone/ASR anything.
