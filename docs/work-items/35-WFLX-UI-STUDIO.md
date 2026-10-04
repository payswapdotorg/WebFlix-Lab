# 35 — WFLX-UI-W1: Overview Studio App Shell + Source/Overview UX

Wave 1 of the Overview Studio handoff
(`docs/handoff/tl2-overview-studio-handoff.md` — read it FIRST; it is the
governing document for the whole studio stage).

## Owner

- Worker `wflx-ui-w1` owns: `apps/studio/**`, `tests/studio/**`, the
  `studio:dev` package script, and this work order's record.
- Forbidden: everything else, per AGENTS.md drift controls (frozen trees
  `src/contracts`, `src/source`, `src/director`, `src/audio`, `src/video`,
  `src/compositor`; all other tests/tools/docs).

## Deliverables

1. `apps/studio/server.ts` — Bun HTTP server, FIXED port 3101, hot-reload
   entry (`bun --hot`). Serves `index.html` at `/` and the JSON/binary API
   under relative `api/...` paths. No egress; no auth; no persistence.
2. API (v1):
   - `GET api/source` — the control fixture bundle: source-artifact
     metadata, the note text, semantic-graph summary (claims/entities/
     topics with counts + ids), CONTRACTS_VERSION.
   - `POST api/compile` — body `{ planId }` (one of the four canonical
     audio plans) → `compileAudioOverview` with the lab-fixed seed/now and
     `mastering: 'pure-ts'` → response: artifactId, turn timeline, QA
     summary, manifest, provenance (seed, now, sha256 of master WAV,
     wall-time), audio URL path. Master WAV registered in-process.
   - `GET api/audio/:artifactId` — binary WAV, `audio/wav`.
3. `apps/studio/index.html` — single file, inline CSS/JS, no external
   assets. Surfaces:
   - A Landing (identity + honest-boundaries label);
   - B Source (fixture + metadata + graph summary);
   - C Audio Overview (plan picker → compile → player + turn timeline +
     QA + provenance card).
   Every fetch/audio URL is RELATIVE and carries `XTransformPort=3101`
   (hardcode that query — it is the gateway routing key; the studio port
   is fixed by design).
4. `tests/studio/api.test.ts` — Bun integration tests: boot the server
   handler on an ephemeral context (or refactor-friendly: export the
   router as a pure function `handleStudioRequest(req)` and test it
   directly without sockets), assert: source payload shape; compile for
   `plan-audio-deep-dive-5min` returns 20 turns / ~300 s / QA pass /
   deterministic artifactId across two calls; audio endpoint serves
   `audio/wav` with non-empty body; unknown planId → 400.
5. `package.json` script `studio:dev`: `bun --hot apps/studio/server.ts`.
6. `apps/studio/README.md` stub → full README is W3's deliverable; W1
   writes a 10-line quickstart only.

## Technical anchors (verified at the station, 2026-10-04)

- Compile call (REPRODUCED, `experiments/run-interactive-audio.ts:86`):
  `compileAudioOverview({ plan, graph, sources, options: { seed, now,
  mastering: 'pure-ts', notes } })` → `{ artifact, qa, timing }` — timing
  carries `entries[]` (turnId/speaker/wordCount/startMs/actualSeconds/
  gapAfterMs) and `totalDurationMs`; artifact carries the compiled plan +
  synthesis payloads.
- Canonical inputs load exactly like `tests/audio/fixtures.ts`:
  `readFileSync('fixtures/contracts/plan-audio-<mode>.json')` etc. from
  the repo root (cwd = repo root when launched via the package script).
  The four plans: deep-dive-5min, brief-2min, critique-5min, debate-5min.
- Seeds/now: reuse the lab constants (`wflx-interactive-audio-seed` /
  the FIXED_NOW pattern in tests/audio/fixtures.ts) — read them, do not
  invent new ones.
- WAV: `masterTrack` output is already WAV bytes in the compile result's
  synthesis/master path — check `src/audio/mixing/` exports; if the
  master WAV is not directly exposed on the compile result, use exactly
  the path the experiment runners use to fingerprint the master
  (`experiments/run-interactive-audio.ts` persistSession →
  `result.session.wav` pattern / baseline equivalents). MISSING EXPORT =
  HANDOFF line, do NOT fork the logic.

## Exit criteria

- `bun run typecheck` 0 errors; `bun run lint` clean; `bun test` green
  with the new studio tests counted (battery moves ONLY upward).
- `bun run studio:dev` serves the page; a browser at the gateway-routed
  URL can: view source (B), compile the Deep Dive plan, play the overview
  (C). Screenshots not required — the TL station-verifies in-browser.
- Credential sweep clean; no egress; frozen trees byte-stable
  (`git diff --stat main..HEAD -- src/` empty).

## Report

Push-first: branch `work/wflx-ui-w1`, commits pushed as you go, final
report in the PR body: what was built, the API surface table, test counts
(before → after), HANDOFF lines (missing exports / contract friction /
discrepancies vs this order), and honest-boundaries statement.
