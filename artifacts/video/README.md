# Video Artifacts (W3)

Generated lab outputs from the video overview pipeline (`bun run
video:benchmark` regenerates the sidecars deterministically; media bytes are
environment-dependent — see below).

## Layout

| Path | Contents | Committed media |
| --- | --- | --- |
| `benchmark-explainer-26s/` | Short all-types benchmark (26 s, 13 scenes — every contract visual type exercised once): `overview.mp4`, `artifact.json` (GeneratedArtifact sidecar), `qa-report.json`, `timeline.json`, `determinism.json` | Yes — MP4 (~2 MB offline placeholder narration + deterministic-ink illustrations) |
| `canonical-explainer-7min/` | Canonical W1 fixture run (420 s, 15 scenes, Director-emitted plan): sidecars only | No — the ~37 MB MP4 is **fingerprinted** (`artifact.json` `media.sha256`) but not committed, following the golden-reference precedent (the 65 MB reference video is fingerprinted, not committed) |
| `benchmark-run.json` | Honest, run-specific latency measurements + backend used (wall-clock is NOT reproducible; labeled as such) | Yes |

## Rules

- New id per generation; never overwrite a golden reference
  (`artifacts/README.md`). Reproducible regeneration deliberately reuses the
  same deterministic id for the same (plan, seed, provider, backend) key.
- The determinism layer is the **scene SVG set** (+ timeline, narration WAV,
  QA reports): `determinism.json` pins the combined sha256 hash pair from
  two in-process renders (byte-identical, enforced by `tests/video`).
- The MP4 encode depends on the h264 encoder build (Remotion + system
  toolchain); byte-stability across environments is NOT claimed. The
  sidecar's `media.sha256` fingerprints the media generated on this host.
- All narration is the **offline deterministic placeholder** (marker tones)
  and all illustration is the **deterministic ink adapter** — zero provider
  cost, no network, no credentials. These artifacts are **not product
  parity evidence** (AGENTS.md; `artifact.json` `notes` says so).
- Composition backend recorded in provenance (`providers` stage
  `composition`): `remotion` (primary; Playwright chrome-headless-shell,
  discovered — never downloaded) or `wflx-fallback-compositor` (system
  ffmpeg + librsvg) when no browser exists.
