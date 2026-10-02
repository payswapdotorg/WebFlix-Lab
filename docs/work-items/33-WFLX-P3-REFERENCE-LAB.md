# WFLX-P3 — Reference/Benchmark/Parity Lab Wave (Parity Completion Phase, Wave 3 of 3)

Date: 2026-10-01

You are WFLX-P3, the reference-lab implementer for the WebFlix-Lab program.
The R&D roadmap is COMPLETE on main; the Parity Completion Phase is underway:
WFLX-P1 (audio parity, PR #11) and WFLX-P2 (video parity, PR #12) are MERGED,
and the TL-side real-product capture matrix is COMPLETE (LAB-01..09 + the
original Explainer reference). Your wave = the REFERENCE/COMPARISON track:
the next-generation black-box comparison program over the LAB-series capture
estate. Canonical phase charter (READ FIRST): docs/work-items/parity-completion-work-order.md (esp. §3 WFLX-P3 scope, §5 TL-rejects, §7 definition of done).

Deadline pressure is real — but the quality bar does NOT drop. The TL rejects:
fixture-only claims, screenshot-only parity claims, LLM self-assessment,
simulated results presented as real, claims based on stale product behavior.
The worker NEVER fabricates product-side numbers: any comparison whose
product-side capture does not exist yet is recorded COMPARISON PENDING
REFERENCE CAPTURE — an honest gap, never a guess.

## 0. Identity and ground rules

- Repo: https://github.com/payswapdotorg/WebFlix-Lab.git (public read).
- Baseline: main @ 39f3e09 (must contain docs/experiments/records/LAB-09.yaml
  and docs/work-items/parity-completion-work-order.md; if absent STOP and
  report UNRESOLVED).
- Branch: work/wflx-p3-reference-lab from main. Push with the PAT below;
  NEVER open PRs / never merge (TL-owned); NEVER commit any credential,
  token, key, or auth state to files or history.
- You own (additive only): docs/experiments/, docs/reference/, reference/,
  artifacts/reference/, plus new experiment/tool files under experiments/ and
  tools/ as needed. tests/integration/ ONLY through TL coordination — record
  needs as HANDOFF. Do NOT touch src/ contracts/director/audio/video/compositor
  code (frozen architecture); needed changes go in your report as HANDOFF.
- Evidence labels (AGENTS.md): OBSERVED / DOCUMENTED / HYPOTHESIS /
  REPRODUCED / UNRESOLVED. Never silently promote HYPOTHESIS to FACT.
- Determinism is the lab's spine: the offline deterministic pipeline stays
  DEFAULT; the 370+ baseline (now ~406 after P1/P2) stays green.

## 1. Setup (verify before working)

~~~bash
git clone https://github.com/payswapdotorg/WebFlix-Lab.git
cd WebFlix-Lab && git checkout main && git log --oneline -1   # 39f3e09
git checkout -b work/wflx-p3-reference-lab
bun install
bun run typecheck && bun run lint
bun test tests/contracts tests/source tests/director   # 151
bun test tests/audio                                    # 159
bun test tests/video                                     # 82+
bun test tests/integration                               # 14+
~~~
(The EV-011 chunked doctrine; bare bun test at root under-discovers.
Record the ACTUAL chunk numbers you see — they are your baseline.)

Read in order: AGENTS.md; docs/work-items/parity-completion-work-order.md;
docs/experiments/protocol.md + record-template.yaml + lab-series-runbook.md;
docs/experiments/records/LAB-01..09 (the capture estate — real product-side
observations, evidence-labeled); docs/reference/reference-artifact-manifest.json;
the comparison hooks P2 left in experiments/run-exp-v-s-01.ts,
run-exp-v-cin-01.ts, run-exp-e-refresh.ts (product-side pending markers) —
ADAPT TO WHAT IS REALLY THERE.

FIRST COMMIT: this work order verbatim as
docs/work-items/33-WFLX-P3-REFERENCE-LAB.md (dated 2026-10-01).

## 2. Deliverable A — Comparison-record schema + ingestion (EV-023)

- A canonical comparison-record schema (TypeScript types + YAML/JSON record
  format under docs/experiments/): every comparison record carries reference
  config, source fingerprint, artifact fingerprint (sha256), timestamp,
  format, language, duration, custom prompt, observations (evidence-labeled),
  transcript/scene annotations where present, comparison-against-lab-artifact
  results (metric by metric), confidence, unresolved behavior — the §3 field
  list of the phase charter, mechanical and checkable.
- An ingester (tools/ or experiments/) that folds the EXISTING LAB-series
  estate into this schema: LAB-01..06 (audio surfaces), LAB-07..09 (video
  control/twin/custom-prompt), and the original Explainer reference artifact
  + scene atlas. Ingestion is from the committed records — NEVER inventing a
  number not present in a LAB record or manifest; missing fields become
  null + "COMPARISON PENDING REFERENCE CAPTURE".
- Validation: a schema test that every ingested record round-trips and every
  required-either-value-or-pending rule holds.

## 3. Deliverable B — Audio parity comparison suite (EV-024)

A repeatable harness that, for each audio dimension with product-side truth
in the estate (Deep Dive LAB-01, Brief/Critique/Debate LAB-02, duration LAB-03,
language LAB-04, mutation locality LAB-05, twin stochasticity LAB-06):
- compiles the LAB-canonical source through the lab pipeline (offline
  deterministic default),
- computes the SAME metric family the LAB records observed (duration bands,
  turn counts / roles, speaker structure, locality diff on the b30 mutation —
  the EXP-A-04 comparison axis, stochasticity surface per LAB-06),
- emits a comparison record per dimension: lab value, product value (from the
  LAB record), delta/band, verdict VERIFIED / DIVERGENT / PENDING, confidence.
- Honest-boundary rules: the product's scheduling-lane behavior change
  (2026-10-01: audio generation moved to scheduled queuing) is banked truth —
  comparisons are against the CAPTURED artifacts, not against live re-runs.
- Where the lab dimension has no product-side capture yet (custom steering
  prompt audio = LAB-10, scheduled at capture time): record the comparison as
  COMPARISON PENDING REFERENCE CAPTURE with the TL-hook for post-capture fill.

## 4. Deliverable C — Video hook harness (EV-025)

- Wire the comparison-record machinery into the existing video experiment
  runners: EXP-V-S-01 (Short), EXP-V-CIN-01 (Cinematic), EXP-E-REFRESH
  (Explainer) — replacing their ad-hoc product-side pending markers with
  schema-compliant comparison records fed by LAB-07/08/09 + the original
  Explainer reference (short.duration.seconds n=3 product band 84.8/78.3/71.6
  vs the lab 60s target + [48,72] band hypothesis; sceneDensity instrument
  truth vs structural plan units — the measurement-class note is BINDING:
  ffmpeg cuts vs plan scenes are recorded as instrument truth, never compared
  as like-for-like; the UI-truth that no Cinematic product format exists is
  a scoping truth recorded in the comparison records, not a parity claim).
- Interactive Audio + multi-language video arms: PENDING (no captures) —
  schema slots exist, records marked COMPARISON PENDING REFERENCE CAPTURE.

## 5. Deliverable D — Integration tests + registry + docs (EV-026)

- tests/integration/: additive tests that run the comparison harness
  end-to-end on the canonical fixture and assert the record invariants
  (record count, required fields, pending-discipline). Coordinate with the
  TL via HANDOFF if the existing integration chunk needs shared fixtures.
- Evidence registry: EV-023 (schema+ingestion), EV-024 (audio comparisons),
  EV-025 (video hook wiring), EV-026 (integration) per protocol.md.
- roadmap-status.md: append the WFLX-P3 section per the §4 gate discipline —
  every capability ends VERIFIED or EXPLICITLY UNRESOLVED, with the pending-
  capture list explicit (audio custom-prompt LAB-10; video language arm;
  Interactive Audio product capture).

## 6. Regression preservation

- The full chunked baseline you recorded in §1 stays green; new tests add on
  top; typecheck 0 errors; lint clean.
- No committed fingerprint changes; run the manifest packet digest double-run
  (bun run manifest:build twice, digests identical, record them).
- Credential sweep before push: rg -i "ghp_|sk-|api[_-]?key|secret" --glob
  '!*.lock' over your diff = 0 hits.

## 7. Delivery

- Push: git push -u origin work/wflx-p3-reference-lab with PAT
  ghp (URL: https://<PAT>@github.com/payswapdotorg/WebFlix-Lab.git;
  the PAT is for the push URL only — never in files/commits).
- Final message: WFLX-P3 COMPLETION REPORT — (A/B/C/D) delivered per
  dimension with VERIFIED / EXPLICITLY UNRESOLVED / COMPARISON PENDING
  REFERENCE CAPTURE; files touched grouped; gate numbers (chunks + totals +
  new-test counts); packet digest pair; honest boundaries; HANDOFF entries;
  branch + HEAD sha. No placeholders; report ONLY what you verified.
