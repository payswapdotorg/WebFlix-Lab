# WFLX-P3B Wave 1 — Core Integration (checklist §2 items 1, 2, 3, 7)

Status: DELIVERED on branch `work/wflx-p3b-integration` (off `main` @ 271d0a8),
2026-09-29. Worker: WFLX-P3B-CORE (integration implementer). Scope per
AGENTS.md drift controls: NEW paths only — `tests/integration/`,
`tools/manifest/`, `package.json` script entry, emitted registry under
`artifacts/manifest/`, this doc, EV-010. Zero changes under `src/contracts/`,
`src/source/`, `src/director/`, `src/audio/`, `src/video/`, `src/compositor/`.

Gates at delivery: `bun run typecheck` 0 errors; `bun run lint` clean;
`bun test` **352/352** (baseline 338 + 14 new: 5 cross-modal, 6 manifest
registry, 3 refinement loop) across 36 files.

All items below are lab-reproduction evidence — NOT product-parity evidence
(AGENTS.md).

## Item 1 — Cross-modal IR compliance test (§2 item 1)

`tests/integration/cross-modal-ir.test.ts` (5 tests). One frozen fixture
source (`reference-messy-note`) compiled through BOTH surfaces from the same
(source, graph, seed):

- shared editorial spine: identical accounted/covered claim sets across
  modalities for identical (seed, targetDurationSeconds) — REPRODUCED;
- grounding by the same claim ids: every turn/scene/beat/coverage claim id
  resolves in the SAME SemanticGraph; on the frozen canonical fixtures the
  turn-cited and scene-cited claim sets are EQUAL (all 11 canonical claims
  voiced AND visualized) — REPRODUCED;
- no per-surface mutation: each pipeline leaves its plan instance
  deep-equal to the pre-run frozen clone, and the audio compiler passes the
  SAME instance through (`result.plan === plan`) — REPRODUCED; the video
  pipeline's scene-SVG determinism proof rides along (hashA === hashB).

### CONTRACT FINDING (OBSERVED) — HANDOFF for TL adjudication

The frozen v1 `OverviewPlan` is modality-exclusive by construction (audio
plans REQUIRE `audioTurns` and MUST NOT carry `videoScenes`; video plans the
inverse — `src/contracts/overview-plan.ts` cross-field checks). A single plan
INSTANCE therefore cannot be consumed by both pipelines: each surface
hard-rejects the other modality with a typed error
(`AudioCompilerError` "…audio-modality plan…" / `VideoCompilerError`
"…video-modality plan…" — asserted in the last test of the file, not faked).
The checklist §2 item-1 wording "SAME frozen `OverviewPlan` instance" is
satisfied at the shared-spine level instead (same source, same seed, same
claim universe, same coverage accounting, per-surface no-mutation).

**HANDOFF 1 (UNRESOLVED, for TL adjudication):** either amend the checklist
wording to the shared-spine interpretation (what the test now pins), or
schedule a v2 dual-modality plan shape (belongs with v2 candidate C-8 —
video narration/motion/routing — in the v2 contract wave draft).

## Item 2 — Unified artifact manifest tool (§2 item 2)

`tools/manifest/registry.ts` (core builder) + `tools/manifest/build-registry.ts`
(CLI) + `package.json` script `manifest:build`. Reads both surfaces' stores
(`artifacts/audio/**`, `artifacts/video/**` — every `artifact.json` plus its
provenance sidecars, enumerated not hard-coded) and emits ONE registry shape
`wflx-unified-artifact-registry` v1.0.0: validated `GeneratedArtifact`
inlined, sidecar hashes, media integrity (on-disk sha256 vs fingerprint),
plan resolution (sidecar → fixture → unresolved, honestly labeled), seed
chain, provider identities, per-record `styleBibleVersion`. Reference
captures under `artifacts/reference/` are intentionally out of scope
(comparison evidence, not lab outputs). Additive tooling only — no contract
edits, no `src/` edits.

Emitted registry: `artifacts/manifest/registry.json`
(`bun run manifest:build --now 2026-09-29T00:00:00Z`) — **13 records
(11 audio / 2 video), 2 media verified on disk, 11 fingerprint-only**;
byte-identical regeneration with the same `--now` confirmed. Coverage,
record shape, seed/plan chain and CLI-vs-core byte equality are enforced by
`tests/integration/manifest-registry.test.ts` (6 tests) against the REAL
committed store.

## Item 3 — Reproducibility metadata (§2 item 3)

Every registry the tool emits carries: seeds (artifact generator seed +
resolved plan/Director seed per record), `CONTRACTS_VERSION` (1.0.0),
StyleBible version, provider identities (per stage, denormalized from
`artifact.providers`), tool versions (`wflx-manifest-registry@0.1.0`, bun,
zod, typescript) — plus hashed `surfaceLogs` (run-specific wall-clock logs
are hashed, never inlined). The KNOWN GAP is honored exactly as the packet
requires: the video surface's own manifests do NOT emit `styleBibleVersion`
(DOCUMENTED post-W3 audit; HANDOFF C-9 stands for the v2 wave) — the tool
READS `STYLE_BIBLE_VERSION` from `src/video/style-bible.ts` (worker-owned
path, read-only) and supplies it in the unified registry, gap labeled in
`metadata.styleBibleVersionSource`; a test pins both halves (registry
carries it; raw video `artifact.json` still lacks it).

## Item 7 — Local refinement loop test (§2 item 7)

`tests/integration/refinement-loop.test.ts` (3 tests), fixed seed
`wflx-p3b-loop-seed`, fixed `now` (no hidden clock), pure-TS mastering:

- **same-seed byte-stability of the metric set (the core assertion):**
  canonical plan compiled twice in-process → byte-identical QA metric sets,
  full QA reports, artifact sidecars, timing manifests and WAV sha256 —
  REPRODUCED (13 deterministic metrics, DESIGN.md §9 order);
- **measure → detect → refine → re-measure:** the over-packed-turn mutant
  escalates to its smallest regenerable unit (`turn-over-budget` error
  naming `turn-6`), the refinement is a plan-space Director re-plan of the
  same (source, graph, seed) — P3A's anchor-mass-aware allocation resolves
  it (0 over-budget, status not failed) — REPRODUCED; the refined iteration
  is itself byte-stable, and the metric set measurably moved;
- **loop hygiene:** a failing iteration between two identical canonical
  iterations does not perturb the measured metric set (no cross-run
  compiler state) — REPRODUCED.

SCOPE NOTE (DOCUMENTED): the refinement demonstrated is a GLOBAL re-plan;
true smallest-unit regeneration (non-target turns byte-identical) is
defeated by the plan-global planHash seed key — C-5, v2 wave candidate; the
treatment arm lands as EXP-X-02 with the v2 wave decision per
`docs/experiments/design-exp-x-02.md`. This test pins the v1 control
behavior.

## Deferred (out of wave-1 packet, per checklist)

- §2 item 4 (same-source dual-modality comparison table): wave 2 with
  EXP-V / EXP-X-02.
- §2 item 7's EXP-X-02 treatment arm: blocked on the v2 contract wave
  decision (C-5 keying).

## Evidence

- EV-010 appended to `docs/evidence/registry.jsonl` (operator wflx-p3b).
- Committed registry: `artifacts/manifest/registry.json`.
- Tool docs: `tools/manifest/README.md`.
