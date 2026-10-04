# TL #2 Overview Studio Handoff — Operator Studio UI + Browser-Testable Interactive Audio

Status: ACTIVE (operator handoff, 2026-10-04). This is the post-roadmap
stage: the R&D roadmap is COMPLETE (roadmap-status.md 2026-10-04 entry) and
this document governs the browser-testable surface over the frozen pipeline.

Evidence labels apply (AGENTS.md): statements about the product are OBSERVED
(LAB-01..13); statements about this lab's machinery are REPRODUCED.

## 1. Baseline

- Repository: `payswapdotorg/WebFlix-Lab` — the sole source of truth
  (operator re-anchor 2026-10-03).
- Handoff baseline: `main` @ `5f71de7` (roadmap-complete state); the
  AUDIO-PARITY-08 fill advanced it to `4db67c4`. Studio waves rebase on the
  then-current `main`.
- Station law at every wave: typecheck 0 errors; lint clean; chunked
  battery green (474/474 at handoff time — studio waves ADD tests, never
  subtract).

## 2. The gap

The repository has a complete, deterministic, fully-tested research
pipeline (contracts → director → audio → video → interactive session) and
ZERO browser surface: no `apps/`, no `web/`, no dev server, no player. The
only ways to exercise the machinery today are bun scripts and tests. The
operator cannot point a browser at the lab.

## 3. Objective (minimal, honest, browser-testable)

Build the smallest useful **Overview Studio UI** inside this repository:

- serves the checked-in control fixture as the source;
- compiles a real Audio Overview through the EXISTING pipeline (canonical
  plans, offline deterministic provider, fixed seeds);
- plays it in the browser with metadata + provenance;
- drives a REAL `InteractiveAudioSession`: Join → typed listener question
  → source-grounded response voiced through the same machinery → locality
  proof visible on screen.

Non-goals: no new pipeline capabilities, no voice/microphone capture
(typed input is the documented stand-in class — LAB-13 and EXP-L-18
record this honestly; the UI must display that label), no product-parity
claims, no multi-user/auth, no persistence beyond the process.

## 4. Architecture law — the UI sits ON TOP of the frozen pipeline

- The studio imports and calls the existing modules. It MUST NOT copy,
  re-implement, or fork business logic:
  - source/graph/plans come from the checked-in fixtures
    (`fixtures/reference-messy-note-redacted.md`,
    `fixtures/contracts/reference-messy-note.source-artifact.json`,
    `fixtures/contracts/reference-messy-note.semantic-graph.json`,
    `fixtures/contracts/plan-audio-*.json`);
  - audio compilation is `compileAudioOverview` from `src/audio/index.ts`;
  - the interactive surface is `InteractiveAudioSession` +
    `intervene()` from `src/audio/interactive/session.ts`;
  - director plans, when needed, come from `src/director/compiler.ts`.
- Frozen trees are NOT refactored for the UI: `src/contracts/`, `src/source/`,
  `src/director/`, `src/audio/`, `src/video/`, `src/compositor/` stay
  byte-stable except zero-risk additive exports IF (and only if) a needed
  export is missing — such additions are HANDOFF lines in the worker
  report, ruled on by the TL before merge.
- All studio code lives under `apps/studio/` (server, page, API) and its
  tests under `tests/studio/`. The studio owns no other path.
- Determinism is law: fixed seeds/now (the lab defaults), same compile
  options as the experiment runners. The UI displays seed + provider +
  artifact id + fingerprints — never hides them.

## 5. Deployment shape (the operator console environment)

- One Bun HTTP server, fixed port **3101**, entry `apps/studio/server.ts`
  (`bun run studio:dev` → `bun --hot apps/studio/server.ts` — hot-reload
  for iteration, exactly the mini-service convention).
- The page is a SINGLE `index.html` with inline CSS/JS (no external asset
  hosts, no CDN, no framework downloads) — the operator's gateway routes
  by the `XTransformPort=3101` query, so every fetch/audio URL from the
  page carries that query in RELATIVE form (e.g. `api/source?XTransformPort=3101`).
  No absolute URLs, no websockets needed for v1.
- Session state is in-process (a Map of `InteractiveAudioSession` +
  compiled baselines). Restart resets state — acceptable and documented.
- WAV bytes are served from a binary endpoint (`api/audio/<id>`,
  `audio/wav`) so `<audio>` elements stream them; artifact bytes live in
  the in-process registry only (media stays fingerprinted-not-committed,
  the LAB-series discipline).

## 6. Required UI surfaces (A–D)

- **A — Landing.** Studio title, pipeline identity (CONTRACTS_VERSION,
  provider class "offline deterministic", station test count), the four
  canonical plans, and the honest boundaries line (lab reproduction, NOT
  product parity — AGENTS.md wording).
- **B — Source.** The control fixture rendered (the redacted messy note),
  the W1 source-artifact metadata card, and the semantic-graph summary
  (claims / entities / topics counts with ids). Everything from the
  checked-in fixtures — no upload path in v1 (fixture-only by design).
- **C — Audio Overview.** Plan picker (Deep Dive 5min / Brief 2min /
  Critique 5min / Debate 5min — the canonical fixtures) → Compile button →
  the player (`<audio>` over the binary endpoint), the turn timeline
  (turnId, speaker, startMs, durationMs, wordCount), the QA report
  summary, and the provenance card (seed, now, artifactId, sha256 of the
  master WAV, compile wall-time, manifest path class).
- **D — Interactive.** Join flow on a compiled baseline: pick the
  intervention turn boundary on the timeline, then the ASK box — a TYPED
  listener question (labeled exactly: "typed stand-in — voice capture
  UNRESOLVED; no microphone is faked"). The response renders as inserted
  turns (highlighted) in a session timeline; the session master plays
  through the same player class; the locality proof table renders the
  `InteractiveSessionResult` locality rows (per-turn byte-identity
  verdicts, startMs shift == inserted response total) and the grounding
  summary (retrieved claim ids, matched-by-content). Suggested-question
  chips MAY offer the two EXP-L-03 scripted questions as one-click
  conveniences — labeled as scripted, not "suggested by AI".

## 7. Session behavior guarantees (what the UI must visibly preserve)

These are properties of `InteractiveAudioSession.intervene()` — the UI
must not break them and must SHOW them:

1. **payload reuse** — original turn WAV bytes are reused in the session
   master (the locality table's byte-identity column);
2. **turn order preserved** — the session manifest is the baseline
   sequence with response turns inserted ONLY at the boundary;
3. **translation-only shift** — post-boundary startMs values shift by
   EXACTLY the inserted response total (gap included);
4. **C-5 locality** — no full recompile of untouched turns (per-turn
   byte-identity proof rows);
5. **same-machinery response** — the response segment is compiled through
   `compileAudioOverview` with the intervention plan (the UI's compile
   provenance card for the response says so).

## 8. Worker waves (TL orchestration, one PR each, station-reviewed)

- **W1 — `wflx-ui-w1` app shell + source/overview UX.** `apps/studio/`
  skeleton (server.ts + index.html + API modules), endpoints
  `GET api/source`, `POST api/compile`, `GET api/audio/:id`; surfaces A, B,
  C; `tests/studio/` API integration tests; `studio:dev` script. Exit:
  compile-and-listen works end-to-end in a browser.
- **W2 — `wflx-ui-w2` Interactive Audio integration.** Session registry +
  endpoints (`POST api/session`, `POST api/session/:id/ask`,
  `GET api/session/:id`); surface D (Join/Ask UI, inserted-turn timeline,
  locality + grounding panels); interactive API tests. Exit: the full
  Join → typed Ask → response → locality-proof journey works in a browser.
- **W3 — `wflx-ui-w3` station integration + docs.** Provenance completeness
  audit across surfaces, `apps/studio/README.md` (run + verify + honest
  boundaries), station battery wiring (studio tests in the chunked runs),
  cross-surface consistency pass, AGENTS.md read-list refresh. Exit:
  station review green with studio tests counted.

Each wave: branch `work/wflx-ui-<w>`, PR, TL station review (typecheck /
lint / full chunked battery / credential sweep / frozen-tree diff check),
merge, next wave rebases.

## 9. Acceptance (browser-testable, operator-verifiable)

The operator opens the studio through the operator console (the preview
gateway), and without any CLI: sees the source (B), compiles the Deep Dive
5-min plan and listens to the overview (C), joins a session, asks the
EXP-L-03 question "Can you say more about the open-source media projects
and local model runtimes?", hears/inspects the inserted response, and sees
the locality proof table all-green (D). The TL additionally verifies the
same journey with the automation browser and cross-checks the dev server
log. Fixture-only success is not product parity evidence — the UI carries
that label on the landing surface.

## 10. Drift controls

- No UI-driven plan/graph mutation in v1: the studio is a viewer/driver of
  the frozen artifacts, not an editor.
- No network egress from the studio server (offline provider only).
- No credentials/auth state anywhere in the studio tree.
- The studio never rewrites committed artifacts; it compiles in-memory and
  serves from the in-process registry.
- Tests count: the station battery total moves only upward.
