# Audio Artifacts (W2)

Generated lab outputs from the audio overview pipeline (`bun run
audio:benchmark` regenerates everything deterministically).

## Layout

| Path | Contents | Committed media |
| --- | --- | --- |
| `benchmark-deep-dive-42s/` | Short audio-local deep-dive benchmark (42 s, 5 turns): `overview.wav`, `artifact.json` (GeneratedArtifact sidecar), `timing-manifest.json`, `qa-report.json` | Yes — WAV (~3.7 MB offline placeholder audio) |
| `canonical-deep-dive-5min/` | Canonical W1 fixture run (300 s, 22 turns): sidecars only | No — the ~27 MB WAV is **fingerprinted** (`artifact.json` `media.sha256`) but not committed, following the golden-reference precedent (the 65 MB reference video is fingerprinted, not committed). Byte-identical regeneration is enforced by `tests/audio/determinism.test.ts` and the e2e parity test. |
| `benchmark-run.json` | Honest, run-specific latency/cost measurements (wall-clock is NOT reproducible; labeled as such) | Yes |

## Rules

- New id per generation; never overwrite a golden reference
  (`artifacts/README.md`). Reproducible regeneration deliberately reuses the
  same deterministic id for the same (plan, seed, provider, backend) key.
- All speech here is the **offline deterministic placeholder** — zero provider
  cost (recorded honestly as `costUsd: 0`), no network, no credentials.
- Placeholder audio is **not** Gemini Notebook audio and these artifacts are
  **not product-parity evidence** (AGENTS.md; `artifact.json` `notes` says so).
- Sidecar JSON files use canonical key-sorted serialization
  (`stableStringify`); regeneration is byte-identical, which the e2e
  committed-parity test enforces.
- Mastering is pinned to the pure-TS backend so hashes reproduce across
  environments; the ffmpeg path (loudnorm + MP3) is exercised in tests when
  ffmpeg is on PATH and recorded with its version in provenance.
