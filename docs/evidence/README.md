# Evidence Registry

Append-only registry of experiment and reproduction evidence, owned by TL #2.

## Convention

- One JSON line per record in `docs/evidence/registry.jsonl` — never edit or
  delete existing lines; corrections are new lines that supersede by `id`.
- Record shape mirrors `docs/experiments/record-template.yaml`, flattened to
  JSON, with required fields: `id`, `timestamp_utc`, `operator`, `surface`,
  `evidence_kind` (`black-box-run` | `lab-reproduction` | `reference-import`
  | `integration-check`), `artifact_hash` (when an artifact exists), and
  `evidence_paths` (files that prove the record).
- Black-box runs are performed by TL #2 through the authorized reference
  browser session (docs/reference/gemini-notebook-access.md). Workers do not
  hold reference credentials.
- Every claim in a record keeps its OBSERVED / DOCUMENTED / HYPOTHESIS /
  REPRODUCED / UNRESOLVED label.
- Generated artifacts follow `artifacts/README.md` naming: new id per
  generation, provenance sidecar, never overwrite a golden reference.

## Seed records

- `EV-000` — golden reference identity (DOCUMENTED, manifest-pinned).
- `EV-001` — TL #2 bootstrap: reference access path established (VPN +
  operator Google login in the replay browser); original video import
  pending operator action (UNRESOLVED until hash verification passes).
