# WFLX-UI-W1 — Overview Studio: App Shell + Source/Overview UX (wave 1)

You are WFLX-UI-W1, the studio-shell implementer for the WebFlix-Lab
program (reconstruction of Gemini Notebook / NotebookLM Audio+Video
Overview as a research lab). The R&D roadmap is COMPLETE and merged; the
TL has opened the STUDIO stage per
`docs/handoff/tl2-overview-studio-handoff.md`. You deliver wave 1: the
minimal browser-testable shell over the frozen pipeline.

## 0. Identity and ground rules

- Repo: `https://github.com/payswapdotorg/WebFlix-Lab.git`.
- Baseline: `main` @ `4db67c4` (or newer — rebase on latest main).
- You own `apps/studio/**`, `tests/studio/**`, the `studio:dev` script.
  You do NOT modify `src/contracts/`, `src/source/`, `src/director/`,
  `src/audio/`, `src/video/`, `src/compositor/`, or any other test/tool/
  docs path (AGENTS.md drift controls). Missing exports / friction =
  HANDOFF lines in your report — never fork business logic.
- Evidence labels (AGENTS.md): statements about the lab machinery are
  REPRODUCED; keep the "lab reproduction, NOT product parity" label on
  the landing surface. No credentials/tokens/auth state anywhere. No
  network egress from the studio server.

## 1. Setup (verify before working)

~~~bash
git clone https://github.com/payswapdotorg/WebFlix-Lab.git
cd WebFlix-Lab && git checkout main && git pull
bun install
bun run typecheck && bun run lint
bun test tests/contracts tests/source tests/director   # 164 pass expected
~~~

Read, in order: `AGENTS.md`,
`docs/handoff/tl2-overview-studio-handoff.md` (THE governing document),
`docs/work-items/35-WFLX-UI-STUDIO.md` (this wave's work order),
`tests/audio/fixtures.ts` (canonical input loading pattern),
`experiments/run-interactive-audio.ts` (the compile-call anchor),
`src/audio/index.ts` (compileAudioOverview signature),
`src/audio/mixing/` (master WAV access).

## 2. Task packet (work order 35, summarized — the order is canonical)

1. `apps/studio/server.ts` — Bun HTTP server, FIXED port 3101, serves
   `index.html` at `/` + relative `api/...` endpoints. Design for
   testability: export a pure `handleStudioRequest(req: Request)` router
   (plus a small `main()` that listens on 3101) so tests can call the
   router directly without sockets.
2. Endpoints:
   - `GET api/source` — control-fixture bundle (note text, source-artifact
     metadata, semantic-graph summary with counts + ids,
     CONTRACTS_VERSION);
   - `POST api/compile` `{ planId }` → `compileAudioOverview` over the
     canonical plan (lab-fixed seed/now from the fixtures pattern,
     `mastering: 'pure-ts'`) → artifactId + turn timeline + QA summary +
     manifest + provenance (seed/now/sha256/wall-time) + audio URL; the
     master WAV registers in an in-process Map;
   - `GET api/audio/:artifactId` — binary WAV (`audio/wav`).
   Compile determinism must hold: same planId → same artifactId/sha256.
3. `apps/studio/index.html` — ONE file, inline CSS/JS, no external assets,
   surfaces A (landing + honest-boundaries label), B (source), C (plan
   picker → compile → `<audio>` player + turn timeline + QA + provenance
   card). EVERY fetch/audio URL is relative AND carries the query
   `XTransformPort=3101` (hardcoded gateway routing key — the studio port
   is fixed by design; e.g. `fetch('api/source?XTransformPort=3101')`,
   `<audio src="api/audio/ID?XTransformPort=3101">`).
4. `tests/studio/api.test.ts` — router-level integration tests:
   source-payload shape; deep-dive compile → 20 turns / ~300000 ms /
   QA pass / identical artifactId + sha256 across two calls; audio
   endpoint returns `audio/wav` + non-empty body; unknown planId → 400;
   graph/plan fixtures read from the repo root.
5. `package.json`: `"studio:dev": "bun --hot apps/studio/server.ts"`.
6. `apps/studio/README.md` — 10-line quickstart stub (full README is W3).

## 3. Technical anchors (station-verified)

- Canonical inputs load exactly like `tests/audio/fixtures.ts`:
  `readFileSync('fixtures/contracts/plan-audio-<mode>.json')` /
  `reference-messy-note.semantic-graph.json` /
  `reference-messy-note.source-artifact.json`, cwd = repo root (package
  scripts guarantee it). Plans: deep-dive-5min / brief-2min /
  critique-5min / debate-5min.
- Compile call (REPRODUCED in experiments/run-interactive-audio.ts):
  `const baseline = await compileAudioOverview({ plan, graph, sources,
  options: { seed, now, mastering: 'pure-ts', notes } })` →
  `{ artifact, qa, timing }`; timeline rows come from
  `timing.entries` (turnId/speaker/wordCount/startMs/actualSeconds/
  gapAfterMs), total from `timing.totalDurationMs`.
- The master WAV: follow the runners' access path
  (experiments/run-interactive-audio.ts persists fingerprints of the
  master bytes; src/audio/mixing/ exports masterTrack). If the compiled
  result does not directly expose master WAV bytes, add the MISSING-EXPORT
  HANDOFF line and use the smallest read-only surface available.
- Seed/now: reuse the lab constants you find in the fixtures pattern —
  do not invent new randomness.

## 4. Deliverable (push-first)

- Branch `work/wflx-ui-w1` off main; commit as you go; push.
- PR body = final report: build summary, API table, test count
  before → after (474 → 474+N), station evidence (typecheck/lint/test
  outputs), HANDOFF lines, honest-boundaries statement.
- When done, state "WAVE 1 COMPLETE — work/wflx-ui-w1 pushed, PR open"
  in your final message.

Remember: UI sits ON TOP of the frozen pipeline. It imports and calls.
It never copies. Deterministic, labeled, offline. Minimal and honest.
