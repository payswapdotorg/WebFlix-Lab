# Artifact Store

This directory is for generated lab outputs and experiment evidence.

Naming:
- reference artifacts are immutable and identified by artifact id plus SHA-256
- generated artifacts use a new id for every generation
- never overwrite a golden reference
- store provenance metadata beside media

Do not place Google browser-auth state or unrelated private notebook content here.

## v2 contract wave fingerprint transition (2026-09-30)

CONTRACTS_VERSION 1.0.0 -> 2.0.0 re-keyed every stochastic surface choice
(C-5 per-unit content-keyed seeding on BOTH surfaces; ruling 2026-09-29,
corrected wave mechanics): same-plan outputs CHANGE ONCE at this boundary
and every committed fingerprint in this store regenerated in the same
change — audio benchmarks + canonical sidecars and overview.wav, the
EXP-A series artifacts, the EXP-A-R2/EXP-V/EXP-D integration arms and
records, the video benchmarks (scene-SVG determinism hashes, timelines,
QA reports, committed benchmark MP4), and the unified registry
(artifacts/manifest/registry.json, contractsVersion 2.0.0).

Old values are preserved as git history (never silently re-pinned;
P3A precedent). In-version determinism is preserved and re-proven at the
boundary: the exp:integration packet digest is byte-identical across two
full invocations, and the audio/video double-run suites pass.
