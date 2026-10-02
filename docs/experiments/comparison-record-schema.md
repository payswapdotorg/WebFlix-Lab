# Comparison-Record Schema — canonical format (WFLX-P3 / EV-023)

Status: **CANONICAL 2026-10-01 by WFLX-P3** (work order
`docs/work-items/33-WFLX-P3-REFERENCE-LAB.md` §2 Deliverable A; phase
charter `docs/work-items/parity-completion-work-order.md` §3 field list).
TypeScript types + runtime validation: `tools/comparison/schema.ts`
(zod). Template: `docs/experiments/comparison-record-template.yaml`.

Every record in the comparison program validates against ONE schema. The
record estate lives under `docs/experiments/comparisons/`:

| Set | Count | Records |
|---|---|---|
| `estate/` | 10 | `ESTATE-LAB-01..09` + `ESTATE-EXPLAINER-001` — the ingested real-product capture estate |
| `audio/` | 8 | `AUDIO-PARITY-01..08` — the audio parity comparison dimensions (EV-024) |
| `video/` | 6 | `VIDEO-PARITY-01..06` — the video hook-harness comparison dimensions (EV-025) |

Machine sidecars + indexes: `artifacts/reference/comparisons/` (JSON).

## Field list (the §3 charter list, mechanical and checkable)

```
recordType: "ComparisonRecord"            # constant
schemaVersion: "1.0.0"
id: string                                # e.g. AUDIO-PARITY-03
kind: estate-capture | dimension-comparison | pending-slot
timestamp_utc: string                     # fixed stamps; no wall-clock in records
operator: string                          # capture operator (tl2+operator) or program operator (wflx-p3)
surface: audio | video | cross-modal
dimension: string                         # e.g. audio.length-control

reference_config:                         # the product-side reference configuration
  notebook | format | language | length | visual_style | custom_prompt: string|null
  other_config: Record<string,string>|null

source_fingerprint: string|null           # sha256 of the ingested source (from the LAB record)
artifact_fingerprint:                     # the product artifact fingerprint
  sha256: string|null                     # primary capture hash
  path: string|null
  media_present: boolean                  # media bytes git-ignored for LAB captures
  additional: {label, sha256, duration_seconds}[]   # multi-artifact captures (LAB-02)
  note: string|null
captured_utc: string|null
duration_seconds: number|null             # product capture duration
custom_prompt: string|null

observations: {label, text, source}[]     # EVIDENCE-LABELED (see labels below); >= 1 required
annotations:                              # transcript/scene annotations where present
  transcript_path | scene_annotation_path | notes: string|null

comparison:                               # comparison-against-lab-artifact results, metric by metric
  lab_artifact_id: string|null
  lab_pipeline: string|null
  metrics: ComparisonMetric[]              # see below

confidence: low | medium | high
unresolved_behavior: string[]             # §3 charter field; honest gaps, never silent
tl_hooks: string[]                        # TL-hook for post-capture fill
evidence_paths: string[]                  # >= 1 required
status: string
```

### ComparisonMetric

```
metric: string                              # e.g. deepdive.duration.seconds
unit: string|null
measurement_class: like-for-like | instrument-truth | qualitative
lab:     {value, source, note}              # value: number|string|boolean|null
product: {value, source, note}              # value: number|string|boolean|null
delta: string|null                          # mechanical delta / band statement incl. the rule id
verdict: VERIFIED | DIVERGENT | PENDING
pending_reason: "COMPARISON PENDING REFERENCE CAPTURE"|null
confidence: low | medium | high
note: string|null
```

Evidence labels (AGENTS.md vocabulary — never silently promoted):
`OBSERVED` / `DOCUMENTED` / `HYPOTHESIS` / `REPRODUCED` / `UNRESOLVED`.

## Required-either-value-or-pending rules (the honesty spine)

1. A metric with verdict `VERIFIED` or `DIVERGENT` carries BOTH a non-null
   lab value AND a non-null product value, NO pending_reason, and the product
   value carries a `source` pointer (traceability to a committed record —
   the worker NEVER fabricates product-side numbers).
2. A metric with verdict `PENDING` carries pending_reason exactly
   `COMPARISON PENDING REFERENCE CAPTURE` and a NULL product value — an
   honest gap, never a guess.
3. `instrument-truth` metrics are never compared like-for-like (the binding
   sceneDensity measurement-class note: ffmpeg cuts vs structural plan
   units); such numbers live in observations, and any instrument-truth
   metric entry is forced PENDING.
4. `pending-slot` records: all metrics PENDING + at least one TL hook.
5. Records containing any PENDING metric carry at least one TL hook.
6. `estate-capture` records: capture-side only — artifact fingerprint
   (sha256 or additional entries) required; comparison metrics stay empty
   (the dimension program does the comparing).

Enforcement: `checkInvariants()` + `assertRecordValid()` in
`tools/comparison/schema.ts`; asserted over the full committed estate by
`tests/integration/comparison-schema.test.ts`.

## Declared mechanical verdict rules (`tools/comparison/rules.ts`)

| Rule | Semantics |
|---|---|
| `duration-ratio-band [0.75, 1.3333]` | product/lab within ±1/3 → VERIFIED (same duration class); outside → DIVERGENT |
| `equality` | exact value equality → VERIFIED |
| `percent-point-tolerance <= 5 pp` | percentage-shift metrics: gap ≤ 5 pp → VERIFIED |
| `cited-qualitative-alignment` | both sides carry their evidence-labeled statements; the verdict is the recorded alignment judgment (statements verbatim from committed records) |
| `pendingMetric` | the only source of PENDING: a missing product-side capture |

Every numeric verdict is reproducible from the two values + the rule id
recorded in `delta`.

## Determinism

`loadEstate()` (the ingester), the audio suite and the video hook builders
are pure functions of the committed store; emitted YAML/JSON is
byte-reproducible (fixed stamps, fixed seeds, insertion-ordered keys).
Round-trip (`parse → re-emit` byte-identical) and regeneration (in-memory
builders == committed docs) are asserted by the integration tests.

## Honest boundaries carried by the records

- Comparisons are against the CAPTURED LAB-series artifacts, never live
  re-runs (the 2026-10-01 audio scheduling-lane behavior change is banked
  truth).
- Lab placeholder narration pins realized duration to planning targets
  (0% shift where noted — a construction artifact, recorded with
  measurement-class notes, never claimed as parity).
- Pending-capture list (explicit): audio custom steering prompt (LAB-10,
  scheduled), Interactive Audio product capture, video language arm, video
  mutation locality, video Short hook-prominence structured annotation, and
  the whole Cinematic slot (no product format exists — scoping truth).
