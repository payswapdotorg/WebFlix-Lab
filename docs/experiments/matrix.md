# Initial Experiment Matrix

TL #2 should schedule these after access is confirmed.

| ID | Surface | Baseline | Single mutation | Primary question | Owner |
|---|---|---|---|---|---|
| EXP-A-01 | Audio | Deep Dive | Brief | Does format change editorial structure? | W2 |
| EXP-A-02 | Audio | Deep Dive | Critique | Is critical framing structurally distinct? | W2 |
| EXP-A-03 | Audio | Deep Dive | Debate | Does mode create a real argument graph? | W2 |
| EXP-A-04 | Audio | fixed mode | one paragraph changed | How local is source mutation impact? | W1+W2 |
| EXP-A-05 | Audio | fixed mode | target duration changed | How does compression or expansion work? | W2 |
| EXP-A-06 | Audio | fixed mode | language changed | What is preserved across languages? | W2 |
| EXP-V-01 | Video | Explainer | Short | What changes when output duration or mode changes? | W3 |
| EXP-V-02 | Video | Explainer | visual style changed | Does style mutate globally or per-scene? | W3 |
| EXP-V-03 | Video | Explainer | custom prompt changed | Which layers respond to prompting? | W1+W3 |
| EXP-V-04 | Video | Explainer | one claim changed | How local is visual mutation impact? | W1+W3 |
| EXP-V-05 | Video | Explainer | source ordering changed | Does source order affect narrative order? | W1 |
| EXP-V-06 | Video | Explainer | one source removed | Which scenes disappear or recombine? | W1+W3 |
| EXP-V-07 | Video | Explainer | target duration changed | How are scene density and narration adjusted? | W3 |
| EXP-V-08 | Video | Explainer | unchanged input regenerated | Which elements remain stable across stochastic runs? | W3 |
| EXP-X-01 | Both | one-shot | staged compiler | Does typed staging improve quality and reproducibility? | TL2 |
| EXP-X-02 | Both | generated v1 | local refinement | Does smallest-unit regeneration preserve quality? | TL2 |

## LAB series — real-product black-box probes (TL/operator browser work)

Run against the REAL Gemini Notebook product through the replay browser
(`docs/experiments/lab-series-runbook.md`); each lands a
`docs/experiments/records/LAB-XX.yaml` record per the protocol. These
produce the real-reference comparison evidence the Phase 4 promotion gate
requires. Blocked until the operator completes the interactive Google
login (see `docs/reference/gemini-notebook-access.md`).

| ID | Baseline | Probe | Primary question (lab comparison target) | Owner |
|---|---|---|---|---|
| LAB-01 | dedicated notebook, canonical messy-note fixture | golden Deep Dive Audio capture | What are the real product's baseline mode semantics? (EXP-A-01..03) | TL2+operator |
| LAB-02 | same notebook | Brief + Critique + Debate variants | Do real mode variants restructure or re-skin? (EXP-A-01..03) | TL2+operator |
| LAB-03 | same notebook | duration/format change (if UI-exposed) | How does the real product compress/expand? (EXP-A-05) | TL2+operator |
| LAB-04 | same notebook | second-language generation | What is preserved across real languages? (EXP-A-06) | TL2+operator |
| LAB-05 | same notebook | one source paragraph edited, regenerate | How local is real-product mutation impact? (EXP-A-04 / C-5) | TL2+operator |
| LAB-06 | same input | regenerate (or twin notebook) | Which elements are stable across real stochastic runs? (EXP-A determinism / EXP-V-08) | TL2+operator |

Priority order if operator time is scarce: LAB-01 > LAB-05 > LAB-02 >
LAB-06 > LAB-04 > LAB-03 (golden baseline and mutation locality carry the
most decision weight: Phase 4 comparison evidence and the C-5 diff-semantics
ruling respectively).

## Required outputs

Each experiment produces:
- evidence record
- reference artifact hash
- lab reproduction artifact when available
- comparison notes
- hypothesis status
- next experiment
