# Unified Artifact Manifest Registry (WFLX-P3B wave 1)

One registry JSON over BOTH surfaces' artifact stores — Phase 3 checklist §2
items 2 + 3 (work order: "unify artifact manifests" + "add reproducibility
metadata").

## Usage

```bash
bun run manifest:build                     # wall-clock stamp (run-specific)
bun run manifest:build --now 2026-09-29T00:00:00Z   # byte-reproducible stamp
```

Flags: `--out <file>` (default `artifacts/manifest/registry.json`),
`--now <iso-utc>`, `--audio-dir`, `--video-dir`, `--fixtures-dir`, `--quiet`.
Exit code is non-zero when the store fails validation (artifact guard, kind/
surface mismatch, on-disk media sha256 mismatch) — the registry is the
provenance spine and never silently absorbs an inconsistent store.

## What it reads

- **audio surface** — every `artifact.json` (W1 `GeneratedArtifact` sidecar)
  under `artifacts/audio/**` (canonical, benchmark, EXP-A arms) plus its
  provenance sidecars (`plan.json` / `timing-manifest.json` / `qa-report.json`
  — enumerated, not hard-coded);
- **video surface** — every `artifact.json` under `artifacts/video/**` plus
  its sidecars (`qa-report.json` / `timeline.json` / `determinism.json`),
  per the `src/video/artifacts.ts` output shape.

Reference captures under `artifacts/reference/` are intentionally OUT of
scope: they are real-product comparison evidence (EV-009), not lab outputs.

## What every record carries

- the schema-validated `GeneratedArtifact` (inlined) + sha256 of the
  `artifact.json` sidecar itself (registry/store drift check);
- provenance sidecars enumerated with sha256 + byte size;
- media integrity: on-disk sha256 vs `artifact.media.sha256` (verified /
  fingerprint-only — the golden-reference convention);
- plan resolution: `sidecar` (audio EXP-A `plan.json`) → `fixture`
  (`fixtures/contracts/plan-*.json` by plan id) → `unresolved` (honestly
  labeled, e.g. the hand-built W2 benchmark stand-in plan);
- seed chain: artifact generator seed + resolved plan/Director seed;
- provider identities per stage;
- `styleBibleVersion`: video records prefer the value EMITTED by the
  video surface's own `artifact.json` (`styleBibleVersion`, C-9 since
  CONTRACTS_VERSION 2.0.0), falling back to `STYLE_BIBLE_VERSION` from
  `src/video/style-bible.ts` only for pre-v2 records; audio records carry
  `null` (StyleBible is a video-surface concept).

## Reproducibility metadata (checklist §2 item 3)

Registry `metadata` carries: `contractsVersion` (`CONTRACTS_VERSION`),
`styleBibleVersion` + its source note, `toolVersions`
(`wflx-manifest-registry@<v>`, bun, zod, typescript), roots, hashed
`surfaceLogs` (run-specific wall-clock logs like `benchmark-run.json` are
hashed, never inlined — latency is not reproducible metadata) and honest
notes (offline placeholder media — NOT product parity evidence).

## Determinism

Identical store bytes + identical `--now` produce a byte-identical registry
(canonical key-sorted serialization; records sorted surface → directory;
sidecars sorted by file name). Cross-environment byte-stability is NOT
claimed where the environment is recorded: `toolVersions.bun` embeds the
running Bun version (mirrors the video MP4 stance in
`artifacts/video/README.md`). Without `--now` the registry is stamped with
the wall clock and marked `generatedAtSource: 'wall-clock'` (run-specific).

## Known gap CLOSED (C-9, v2 contract wave)

The video surface's own `artifact.json` manifests now EMIT
`styleBibleVersion` (`src/video/artifacts.ts` references
`STYLE_BIBLE_VERSION` since CONTRACTS_VERSION 2.0.0; post-W3 audit
e8ea606). This tool PREFERS the emitted value (const fallback only for
pre-v2 records still in the store). The p3b wave-1 gap-pin test
(`tests/integration/manifest-registry.test.ts`) FLIPPED to asserting
PRESENCE at the C-9 landing.
