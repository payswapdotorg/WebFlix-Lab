# Phase 3 — TL Integration Checklist (pre-staged)

Status: DRAFT, pre-staged by TL #2 while W2 Stage 2 / W3 Phase 2B are in
flight. This document defines the integration-station procedure that runs
when each worker PR lands. Nothing here is final until the corresponding
deliverable exists.

## 1. PR review gate (per worker PR, before merge)

Run at the TL integration station (`/home/z/WebFlix-Lab`, fresh clone of
the PR branch):

1. Scope compliance (AGENTS.md drift controls):
   - W2 PRs touch only `src/audio/`, `src/providers/audio/`, `tests/audio/`
     (+ `docs/` evidence). W3 PRs touch only `src/video/`,
     `src/providers/visual/`, `src/providers/video/`, `src/compositor/`,
     `tests/video/`, `reference/` annotations (+ `docs/`).
   - Zero changes under `src/contracts/` unless accompanied by a HANDOFF
     entry in the worker report (then TL adjudicates separately).
2. Gates: `bun run typecheck` (0 errors), `bun run lint` (clean),
   `bun test` (all pass; baseline count must not regress — 128 at
   main c7abf4f freeze time).
3. Determinism proof: worker must include a same-seed byte-identical run
   (hash pair) in the PR description or report; re-run locally if cheap.
4. Evidence discipline: report claims carry OBSERVED / DOCUMENTED /
   HYPOTHESIS / REPRODUCED / UNRESOLVED labels; no silent HYPOTHESIS→FACT
   promotion.
5. Merge policy: normal merge via PR (never force-push, never rewrite
   merged history). After merge: append an EV-xxx record to
   `docs/evidence/registry.jsonl` with integration-check output.

## 2. Integration tasks (after both W2 Stage 2 and W3 land)

From `docs/work-items/tl2-work-order.md` Phase 3:

- [ ] Cross-modal IR compliance: one fixture source compiled through BOTH
      the audio pipeline and the video pipeline; both consume the SAME
      frozen `OverviewPlan` instance (shared IR contract is the point of
      the architecture).
- [ ] Unify artifact manifests: `GeneratedArtifact` + provenance sidecars
      from both surfaces in one registry shape.
- [x] Reproducibility metadata: seeds, versions (`CONTRACTS_VERSION`,
      StyleBible version), provider identity, tool versions in every
      artifact manifest. AUDITED for the audio surface 2026-09-27:
      `GeneratedArtifact` carries contractVersion, fixed createdAt,
      compiler generator (name/version/seed/reproducible), per-stage
      provider identities + versions + cost (script/speech/composition/
      evaluation), and media sha256/size/duration; the plan sidecar carries
      the Director generator seed — chain verified on the EXP-A artifacts.
      Remaining: StyleBible version is video-side (PENDING W3).
- [ ] Same-source dual-modality comparison: render audio-only vs
      video output for one fixture; tabulate deterministic QA metrics.
      (BLOCKED on W3 — video surface.)
- [x] Experiment result registry: extend `docs/evidence/registry.jsonl` /
      experiment records so EXP-A/EXP-V runs land as structured records.
      DONE for the audio surface (EV-006): `docs/experiments/records/EXP-A-01..06.yaml`
      + `experiments/run-exp-a.ts` + `artifacts/audio/exp-a/summary.json`; EXP-V
      records land with W3.
- [x] Ablation runs (audio surface): EXP-A-01..06 EXECUTED 2026-09-27 (EV-006)
      — mode structure (brief/critique/debate vs deep-dive + de-confounder),
      one-paragraph mutation locality (structure local, seeded surfaces global
      via planHash keying — v2 wave candidate), duration compression
      (skeleton invariant, salience omission + rate rise, P3A evidence),
      language invariance (structure fully invariant, surface fully
      language-specific). EXP-V ablations land with W3.
- [ ] Local refinement tests: plan → compile → measure loop. Audio-side
      design informed by EXP-A-04: smallest-unit regeneration is defeated at
      the text layer by the plan-global planHash seed key (v2 contract wave
      candidate: per-turn content-keyed seeding) — the loop lands as EXP-X-02
      with the v2 wave decision, after W3.
- [x] Provider matrix doc: stub vs optional real adapters, capability
      and determinism columns — DONE (docs/reference/provider-matrix.md,
      EV-006); video lanes marked PENDING W3.

## 3. Black-box experiment series (requires reference access)

Blocked on operator Google login for notebook.google.com (geography
requires the VPN egress already configured in the replay browser). Series
per `docs/experiments/matrix.md` (LAB-01..06 + EXP-A/V). Every run records
the experiment-protocol fields (id, timestamp, source fingerprint,
configuration, mode, prompt, selection, artifact id, observed behavior,
changed variable, invariants, hypothesis).

## 4. Promotion gate (Phase 4) inputs

Collected throughout: real-reference comparison evidence, implementation
artifacts, benchmark results, costs, latency, failure modes, security and
authorization posture, unresolved gaps, WebFlix integration design.
No production promotion without TL #2 evidence sign-off.
