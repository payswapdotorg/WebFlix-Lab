# LAB Series Runbook — real-product black-box probes (TL #2 + operator)

Status: PRE-STAGED 2026-09-28 01:15 UTC. Blocked on the operator's
interactive Google login (see `docs/reference/gemini-notebook-access.md` —
security boundary: workers never receive credentials; the login happens
in the replay browser by the human operator). The moment login exists,
this runbook executes mechanically; it defines WHAT to probe (matrix.md
LAB-01..06), HOW to capture, and WHERE records land.

## 0. Preconditions (all TL-verifiable before asking the operator anything)

1. Replay browser alive + VPN egress at the US/DE exit
   (`docs/reference/gemini-notebook-access.md` geography note).
2. Operator logged in to Google inside the replay browser (the ONLY
   operator-required step in the entire series).
3. Fixture ready for upload: the canonical messy-note fixture
   (`src/source/fixtures/` messy-note markdown — the same fingerprint
   family the EXP-A series used). One small controlled-mutation copy for
   LAB-05 (b30-paragraph edit, same mutation text as EXP-A-04 so the
   comparison is apples-to-apples).

## 1. Session discipline

- ONE dedicated notebook for LAB-01..05 (recommended contents per the
  access runbook; record the notebook URL in the local env file, never in
  git). A TWIN notebook (same source set, fresh notebook) for LAB-06.
- Black-box rules (protocol.md): record observable behavior only; no
  private-internals probing; no credentials in any record; every artifact
  carries its sha256.
- Each generation: note start/end wall-clock (latency evidence for
  Phase 4), any visible cost/limits UI, and download the artifact
  immediately (product artifacts can expire).

## 2. The six probes

| Step | Probe | Capture |
|---|---|---|
| LAB-01 | Upload canonical fixture → generate Deep Dive Audio Overview | artifact file + sha256; duration; speaker count/roles heard; per-ear turn-structure notes (rough transcript if available); latency; UI-exposed options snapshot |
| LAB-02 | Same notebook → generate Brief, then Critique, then Debate | three artifacts + hashes; structural diff notes vs LAB-01 (turn count, roles, argument markers); latency each |
| LAB-03 | Same notebook → if the UI exposes duration/format controls, generate the most different variant; else record the UI truth (no such control) as the finding | artifact + hash (if generated); the UI-truth screenshot/notes otherwise |
| LAB-04 | Same notebook → generate in the second language (e.g. Spanish) if language selection is exposed | artifact + hash; structure-vs-surface comparison notes vs LAB-01 (same comparison axis as EXP-A-06) |
| LAB-05 | Edit ONE source paragraph (the b30 mutation); regenerate Deep Dive | artifact + hash; DIFF notes vs LAB-01 — how much of the output changed (locality question, the real-product answer to EXP-A-04 and the C-5 ruling) |
| LAB-06 | TWIN notebook with the identical source set → generate Deep Dive | artifact + hash; diff notes vs LAB-01 — which elements are stable across stochastic runs (the real-product determinism answer) |

## 3. Record landing (per protocol fields)

- One `docs/experiments/records/LAB-XX.yaml` per probe, fields per
  `docs/experiments/record-template.yaml` + protocol.md: id, timestamp,
  operator (tl2+operator), surface, reference_notebook (NAME only, never
  URL/token), source_fingerprint, selected_sources, format, language,
  length, other_config, baseline_artifact, mutation, artifact_under_test,
  artifact_hash, observations (evidence-labeled OBSERVED), invariants,
  differences, hypothesis, confidence, falsifier.
- Artifacts stored under `artifacts/reference/lab-XX/` (git-ignored media,
  hash + metadata committed; provenance per AGENTS.md).
- After all six: append the EV record to `docs/evidence/registry.jsonl`
  and update `docs/work-items/promotion-package-skeleton.md` inputs
  (real-reference comparison evidence = the first Phase 4 requirement).

## 4. Comparison targets (why each probe exists)

- LAB-01/02 ↔ EXP-A-01..03: does OUR mode semantics (fixed 10-turn brief
  skeleton, critique re-pairing, debate position/rebuttal) match the real
  product's observable behavior?
- LAB-03 ↔ EXP-A-05: real compression strategy vs our salience-omission +
  rate-rise finding.
- LAB-04 ↔ EXP-A-06: real language invariance vs our structure-invariant /
  surface-specific split.
- LAB-05 ↔ EXP-A-04 + C-5: does the REAL product reshuffle unchanged
  content on a small source edit (plan-global-like) or keep it local
  (turn-local-like)? Direct evidence for the C-5 v2 wave posture.
- LAB-06 ↔ EXP-A determinism + EXP-V-08: what does the real product's own
  stochasticity look like (informs the v2 seeding philosophy, not just our
  implementation).

## 5. Operator time budget

Roughly 5-10 min of operator presence for the login itself; after that
the series is TL-driven in the replay browser (~10-20 min per probe of
generation waits + capture). If operator time is scarce, run the priority
order from matrix.md: LAB-01 → LAB-05 → LAB-02 → LAB-06 → LAB-04 →
LAB-03.
