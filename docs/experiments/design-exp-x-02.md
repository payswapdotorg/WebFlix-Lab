# EXP-X-02 design note — local refinement loop (plan → compile → measure → regenerate the smallest failed unit)

Status: DESIGN (TL #2, 2026-09-27 22:55 UTC). Execution is W3-gated per the
Phase 3 checklist: the loop lands as EXP-X-02 **with the v2 wave decision**
(C-5 per-turn content-keyed seeding, `docs/handoff/v2-contract-wave-draft.md`).
This note fixes the protocol now so the post-W3 wave decision + run is a
mechanical follow-through, not a design scramble.

## 1. Question under test (matrix.md)

> Does smallest-unit regeneration preserve quality?

Concretely: when a compiled artifact fails a per-turn quality gate, can we
regenerate ONLY the failing turn's realized surface and re-pass the gates,
while every non-failing turn stays **byte-identical**?

## 2. Why this is blocked today (EXP-A-04 / EV-006)

- Mutation evidence: a one-paragraph source change → graph layer perfectly
  local (1 claim changed), plan layer perfectly local (0/25 structures
  changed), text layer **globally reshuffled** (21/25 realized turns
  changed). Mechanism: the realizer keys seeded surface choices by
  `(seed | planHash | turnId | slot)`; any plan-content change alters
  `planHash` and reshuffles every seeded choice (EV-005 determinism trap,
  reproduced on demand).
- Consequence for refinement: any edit that touches plan content (even a
  single turn brief) invalidates the surfaces of ALL turns — so "regenerate
  the smallest failed unit" (AGENTS.md architecture rule) is currently
  impossible at the text layer. A refinement loop built today would
  recompile everything and demonstrate nothing about locality.
- Enabler: **C-5** — turn-LOCAL key derivation
  `key(turn) = seed | hash(turn-brief + anchors) | slot`, so unchanged
  turns keep their surfaces under any plan edit elsewhere. Whole-artifact
  determinism is unaffected for the same plan (C-5 verification clause:
  EXP-A summary must reproduce byte-identical media hashes after the key
  change).

## 3. Loop design (five steps, all deterministic)

1. **Baseline compile** — compile a canonical plan (the H-2 per-mode
   fixtures; start with `deep-dive` 300 s en) with fixed
   `(seed, now, provider set)`; persist artifact + `runAudioQa` report.
2. **Measure** — run `src/audio/qa/metrics.ts` per-turn diagnostics:
   `realized.overBudget` flags, inter-turn gap timings, wps rate per turn.
   Select the failing turn with the **worst gate margin** as the target
   unit (deterministic: max over-budget ratio, tie-break by turnId).
3. **Local regenerate** — under C-5 keying, edit ONLY the target turn's
   brief (e.g. word-count cap to pull it under budget) and recompile. The
   harness asserts unchanged turns are byte-identical (this is the
   experiment's core assertion — under v1 keying it fails by construction,
   which is exactly the contrast arm).
4. **Re-measure** — target turn passes its gate; no non-target turn's
   diagnostic changed; total artifact duration/budget delta equals the
   target turn's delta ± 0 ms elsewhere.
5. **Record** — registry record `EXP-X-02.yaml` per the template: control
   arm (v1 plan-global keying — expect global reshuffle) vs treatment arm
   (C-5 keying — expect byte-preservation of non-target turns). Falsifiers
   below.

## 4. Arms, invariants, falsifiers

- **Arms**: A-control = v1 planHash keying + same single-turn brief edit;
  B-treatment = C-5 keying + same edit. Identical seeds/now/planId/sources
  everywhere else.
- **Invariants**: source fingerprint; plan structure outside the target
   turn (0 turns changed structurally); seed/now/provider set; total turn
   count; beat assignment outside the target.
- **Falsifiers** (any one falsifies the C-5 locality claim):
  1. B-treatment changes any non-target turn's realized text (locality
     broken — the key still leaks plan-global state).
  2. B-treatment's target turn passes its gate but degrades a GLOBAL
     diagnostic (total budget, overall wps) beyond the target's own delta.
  3. Whole-artifact determinism breaks: same plan, same seed, two compiles
     differ (C-5 verification clause — must never happen; also guarded by
     the existing fingerprint tests + EXP-A byte-identical reproduction).
  4. A-control does NOT reshuffle non-target turns (would contradict
     EXP-A-04 and mean the mechanism analysis is wrong — also a finding).

## 5. Metrics recorded

- Turns-changed count (realized text): A ≈ 21+/25 (per EXP-A-04 class),
  B = 1/25 expected.
- Per-turn over-budget count before/after; target turn's budget margin.
- Non-target audio-segment byte equality (hash per turn where the
  provider emits per-turn segments; else whole-mix hash + per-turn text).
- Wall-clock cost of local regeneration vs full recompile (expected: the
  compile saving is modest at 25 turns; the QUALITY saving is the point —
  no re-review of untouched turns needed at the station).

## 6. Harness + video-surface extension

- Runner: extend the `experiments/run-exp-a.ts` pattern (deterministic
  arms, light per-run retention, registry write). No new infrastructure.
- W3 decision input (feeds C-5's "does the video realizer share plan-global
  keying?"): after W3 merges, run the same mutation probe on the video
  surface (one claim change → count changed scene realizations). If the
  video realizer shares the keying, EXP-X-02 gains a B-video arm and C-5
  fixes both surfaces in one wave; if not, video locality is already true
  and only the audio realizer changes.
- Operator-gated LAB series are unaffected: this loop is internal
  determinism work, not a reference-access comparison.

## 7. Quality bar for "preserve quality"

The station gate for EXP-X-02 success: B-treatment artifact passes the
full `runAudioQa` report clean (0 over-budget turns), non-target turns
byte-identical, registry record + evidence labels complete. A failed run
is still a recorded result (falsifier hit = architecture finding, as
EXP-A-04 was).
