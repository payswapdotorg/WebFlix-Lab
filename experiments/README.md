# Experiments — TL #2 Phase 3 runners

Deterministic experiment runners for the WebFlix-Lab work order Phase 3
(`docs/work-items/tl2-work-order.md`: "run ablation experiments", "run local
refinement tests", "add experiment result registry"). Owned by TL #2; the
runners consume worker-owned trees (`src/**`) strictly read-only.

## Conventions

- **Determinism first**: every run pins seeds and `now`; a determinism
  spot-check re-compiles the baseline and asserts byte-identical media before
  the runner exits non-zero-clean. Runner outputs are reproducible except the
  `generatedAtUtc` stamp in `summary.json`.
- **One-variable rule** (`docs/experiments/protocol.md`): each arm mutates
  exactly one input; where a mode canonically bundles structure+duration
  (brief = 120 s), a de-confounder arm separates the two.
- **Provenance** (`artifacts/README.md`): every arm writes
  `artifacts/audio/<series>/<runId>/{plan.json, artifact.json,
  qa-report.json, timing-manifest.json}` — a new artifact id per generation;
  media is fingerprinted (sha256 in `artifact.json`) but NOT committed (the
  golden-media precedent).
- **Records**: structured results land in
  `docs/experiments/records/EXP-*.yaml` (protocol template) + an EV-xxx line
  in `docs/evidence/registry.jsonl`. `artifacts/audio/<series>/summary.json`
  is the machine-readable twin of the records.
- **Memory discipline**: full compile results (WAV + synthesis buffers) are
  dropped after persistence; only light plan/realized data is retained for
  the diff phase (station headroom).

## Runners

| Script | Series | Command |
|---|---|---|
| `run-exp-a.ts` | EXP-A-01..06 (audio surface: mode structure, mutation locality, duration compression, language invariance) | `bun run exp:a` |

## EXP-A arm map (2026-09-27 run)

| runId | experiment | variable |
|---|---|---|
| `deepdive-5min-baseline` | baseline | — (Director deep-dive, 300 s, en) |
| `brief-2min-canonical` | EXP-A-01 | mode → brief (canonical 120 s plan) |
| `brief-5min-deconfound` | EXP-A-01 de-confounder | mode → brief at fixed 300 s |
| `critique-5min-canonical` | EXP-A-02 | mode → critique |
| `debate-5min-canonical` | EXP-A-03 | mode → debate |
| `a04-control-deepdive-5min` / `a04-mut-b30-deepdive-5min` | EXP-A-04 | one paragraph (b30) changed; both arms through adapter → extractor → Director → audio |
| `deepdive-3min-duration` | EXP-A-05 | duration 300 → 180 s |
| `deepdive-5min-es` | EXP-A-06 | language en → es |

EXP-V runners land with W3's video surface; EXP-X (TL2-owned cross-surface)
runners land after both surfaces exist.
