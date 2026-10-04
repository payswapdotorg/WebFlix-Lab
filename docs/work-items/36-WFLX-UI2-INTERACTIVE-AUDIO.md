Dispatched: 2026-10-04 (TL #2)

# WFLX-UI2 — Operator Studio: Interactive Audio Integration (Worker 2)

You are Worker 2 (W2) on the WebFlix-Lab studio line. W1 (the studio shell)
is MERGED on main — real-pipeline compile, player, transcript timeline,
provenance panel, and your STUB ROUTES are waiting (`apps/studio/api/session.ts`
returns 501 `{error:"not-implemented-by-w1", handoff:"wflx-ui2"}`). You
replace the stubs and deliver surface D: Interactive Audio in the browser.
First commit records this file verbatim as
docs/work-items/36-WFLX-UI2-INTERACTIVE-AUDIO.md with a dated header line
`Dispatched: 2026-10-04 (TL #2)` above the title.

Repository: https://github.com/payswapdotorg/WebFlix-Lab
Baseline: main @ 88cf5e0 (or newer — clone fresh and verify with `git log --oneline -1`).
Branch: `work/wflx-ui2-interactive-audio` (cut from main). Push with the PAT
below. NEVER open PRs, never merge — TL-owned. NEVER commit any
credential/token/key to files or history (PAT is for `git push` only).

GITHUB_PAT (git push only, never commit): [REDACTED — push credential, never committed]

Read before coding: AGENTS.md, docs/handoff/tl2-overview-studio-handoff.md
(§6 surface D + §7 session behavior guarantees — BINDING),
docs/work-items/35-WFLX-UI1-STUDIO-SHELL.md (your predecessor's contract),
apps/studio/ (server, pipeline, api/, web/ — W1's delivered surface),
experiments/run-interactive-audio.ts (the session-driving reference),
src/audio/interactive/session.ts (InteractiveAudioSession — the machinery
you drive, never re-implement), docs/audio/interactive-audio-architecture.md.

## Mission (TL architecture ruling — binding)

Layer REAL Interactive Audio onto the shell: the operator compiles an
overview, JOINS an interactive session, asks a TYPED listener question at a
chosen turn boundary, and sees/hears the source-grounded response inserted
into the session — with the locality + grounding proofs rendered on screen.
The session layer is `InteractiveAudioSession.intervene()` — the studio
CALLS it, never copies it.

### Semantics (as the machinery defines them — do not invent others)

- Each `intervene()` run FORKS from the stored baseline (this is the lab's
  fork-and-compare semantics; the product's cumulative multi-turn chat is
  NOT imitated — label the UI honestly, e.g. "each question re-forks the
  session from the baseline (lab semantics)").
- `intervene({ afterTurnIndex, listenerText, artifactId })` requires
  `afterTurnIndex` in `0..baseline.turns-2` (interior boundaries only —
  surface ONLY valid boundaries in the UI).
- Listener input is TYPED (the documented text-scripted stand-in class;
  voice capture UNRESOLVED — the UI carries that exact label; NO
  microphone anything, ever).

## Deliverables (each VERIFIED with evidence or EXPLICITLY UNRESOLVED)

### A. Pipeline extension — VERIFIED
- Extend the in-memory store so a compiled overview retains the FULL
  `AudioOverviewResult` (or the minimal fields `InteractiveAudioSession`
  needs: plan, timing, synthesis, graph, sources, seed/now/mastering as
  used by the constructor) — see `apps/studio/pipeline.ts` `StoredOverview`.
  Zero domain logic in this layer; it only re-exports and calls.
- A session registry (Map) holding `InteractiveAudioSession` instances +
  their stored baseline ids + session results. In-memory only, restart
  resets — document it.

### B. Session routes (replace the W1 stubs) — VERIFIED
- `POST /api/session {overviewId}` → builds the `InteractiveAudioSession`
  over the STORED overview result and returns `{sessionId, overviewId,
  turnCount, validBoundaries: number[]}` (the interior turn indexes), plus
  the typed response shape.
- `POST /api/session/:id/intervene {afterTurnIndex, listenerText}` →
  `session.intervene(...)` → serialize `InteractiveSessionResult`:
  - response turns (turnId, speaker, text summary, wordCount, startMs,
    durationMs) marked `inserted: true`;
  - the SESSION MASTER (register in the overview/audio store; serve via
    the existing WAV endpoint pattern — session artifacts need their own
    ids, never overwrite the baseline's);
  - locality proof rows (per original turn: byte-identity verdict,
    baseline startMs → session startMs, the post-boundary shift) +
    the invariant summaries (shift == inserted total; original order
    preserved);
  - grounding summary (retrieved claim ids, matchedByContent, the F1
    check verdict);
  - retrieval + response provenance (seed, same-machinery note, artifact
    ids, sha256 of the session master).
  - 4xx typed errors for: unknown session, out-of-range boundary, empty
    listener text; 500 typed error if the machinery throws.
- `GET /api/session/:id` → current session state (baseline id, joins,
  intervention history summary).

### C. Interactive surface (web client) — VERIFIED
- After a compile, a "Join Interactive Session" action appears (it must be
  obviously the lab's fork-semantics session, not a product imitation).
- Joined state: the transcript timeline gains boundary markers (valid
  intervention points); the ASK box is a text input labeled exactly like
  "typed listener question — voice capture UNRESOLVED (text stand-in)".
- On ask: loading state; then the timeline re-renders with the response
  turns INSERTED + highlighted at the boundary; the session master plays
  through the player (baseline master remains available to compare);
  the LOCALITY table renders (byte-identity column all-green, startMs
  shift column, the invariant line "post-boundary shift == inserted
  response total"); the GROUNDING panel renders the retrieved claims.
- Multiple interventions on one session are listed (fork history); the
  honest fork-semantics label stays visible.
- NO dead buttons; anything not implemented is not rendered.

### D. Gates — VERIFIED
- `bun run typecheck` 0 errors; `bun run lint` clean; `bun test` green
  with your new tests counted (battery is 493 → 493+N — report the exact
  total).
- New tests under `apps/studio/test/` (router-level, like W1's): session
  establish (valid boundaries); intervene over the canonical path asserts
  the §7 guarantees END-TO-END: original-turn byte identity across the
  boundary, post-boundary shift == inserted total, order preserved,
  grounding check outcome, determinism (double-intervene identical
  session-master sha256); typed error paths.
- Credential sweep over your diff: 0 hits. Frozen trees READ-ONLY
  (src/**, artifacts/**, docs/experiments/**, tests/** outside
  apps/studio/test/**, experiments/**). Missing exports / friction =
  HANDOFF notes in your report — never fork domain logic.

### E. Docs — VERIFIED
- apps/studio/README.md: extend with the interactive section (how to run
  the journey, the fork semantics, the typed-input honest boundary).
- Root README.md studio section: one line noting Interactive Audio is in.

## Evidence classification (binding, AGENTS.md)

Everything is REPRODUCED-class lab implementation. No OBSERVED claims, no
product-parity claims. The typed-input stand-in and fork semantics are
labeled on the UI surface itself.

## Delivery discipline

- Small commits, push FIRST and keep pushing (durable across sandbox
  recycles). Final message (chat): branch name, HEAD sha, files-touched,
  gate results (typecheck/lint/battery counts), the locality-proof test
  output (the §7 guarantee lines), honest UNRESOLVED list.
- The TL station-reviews (gates + credential sweep + frozen-tree diff +
  an agent-browser journey: compile → join → ask → locality table) BEFORE
  merge.

## Non-goals (hard)

No voice/microphone/ASR. No cumulative-session emulation (fork semantics
only, honestly labeled). No new npm deps. No frozen-tree edits. No
artifacts/ writes. No PRs/merges. No live providers. No product imitation
beyond the documented honest labels.
