# WFLX-V3A — Multi-Source Unblock + EXP-V-05/06 Re-Run (v3 line, lane 1)

Date: 2026-10-03

You are WFLX-V3A, the source-surface implementer for the WebFlix-Lab v3
line. The R&D roadmap (Phases 0–4) and the Parity Completion Phase are
COMPLETE and signed on main (parity-close EV-029). The v3 line opens now
with THIS lane: the W1 multi-source HANDOFF — "W1 multi-source block-id fix
(HANDOFF) — then re-run EXP-V-05/EXP-V-06 unchanged" (recorded in
EXP-V-05.yaml / EXP-V-06.yaml next_experiment, the promotion-decision
follow-up ledger, and parity-close §3 divergence entry).

THE TL HANDS YOU THE ROOT CAUSE (reproduced at the station 2026-10-03):
`src/contracts/validation.ts` class BlockIndex keys its map by `blockId`
ALONE ("first definition wins"), but every adapter numbers block ids
per-source from `b1`. With two sources in one graph the ids collide: the
index resolves `b2` to source A's block, so every evidence span of source B
fails `get(sourceId, blockId)` → "references unknown block bN in source
source-note-b" → DeterministicExtractor throws "produced an inconsistent
graph". The class's own comment states the intended law — "source ids make
pairs unique in valid data" — the implementation never keyed by the PAIR.
Reproduction: split fixtures/reference-messy-note-redacted.md at the marker
`## Section 2 — Infrastructure`, ingest both parts (ids source-note-a /
source-note-b) through MarkdownNoteAdapter, extract with
DeterministicExtractor → the throw above.

Quality bar does NOT drop. The TL rejects: fixture-only claims,
simulated results presented as real, silent HYPOTHESIS promotion,
fingerprint drift without same-change regeneration. Evidence labels per
AGENTS.md: OBSERVED / DOCUMENTED / HYPOTHESIS / REPRODUCED / UNRESOLVED.

## 0. Ground rules

- Repo: https://github.com/payswapdotorg/WebFlix-Lab.git (public read).
- Baseline: main @ 79a8a31 or later (must contain this work order at
  docs/work-items/34-WFLX-V3A-MULTI-SOURCE.md plus
  docs/promotion/parity-close-decision.md and
  docs/experiments/records/LAB-12.yaml; if absent STOP, report UNRESOLVED).
  The TL landed this work order on main before dispatch — if the file already
  exists, your FIRST COMMIT is satisfied verbatim; verify byte-equality instead
  of re-committing.
- Branch: work/wflx-v3a-multi-source from main. Push URL (token substituted
  at dispatch, never commit it):
  https://x-access-token:[REDACTED:github_token]@github.com/payswapdotorg/WebFlix-Lab.git
  NEVER open PRs / never merge (TL-owned); NEVER commit any credential,
  token, key, or auth state to files or history.
- You own: src/source/, src/contracts/, tests/source/, tests/contracts/;
  granted for this lane: tools/experiments/, docs/experiments/records/,
  artifacts/experiments/ (the EXP-V-05/06 arm outputs), tests/integration/
  (record-flip asserts only). Do NOT touch src/audio, src/video, src/director,
  src/compositor (frozen); needed changes → HANDOFF in your report.
- Determinism is the spine: offline pipeline default; the 456-test baseline
  stays green; no wall-clock in any committed record (EXP_NOW stamps).
- FIRST COMMIT: this work order verbatim as
  docs/work-items/34-WFLX-V3A-MULTI-SOURCE.md (dated 2026-10-03).

## 1. Setup (verify before working)

~~~bash
git clone https://github.com/payswapdotorg/WebFlix-Lab.git
cd WebFlix-Lab && git checkout main && git log --oneline -1   # 79a8a31 (tl2: v3 line opened...)
git checkout -b work/wflx-v3a-multi-source
bun install
bun run typecheck && bun run lint
bun test tests/contracts tests/source tests/director   # 151
bun test tests/audio                                    # 159
bun test tests/video                                     # 117
bun test tests/integration                               # 29
~~~
(The EV-011 chunked doctrine; bare bun test at root under-discovers.
Record the ACTUAL chunk numbers you see — they are your baseline.)

Read: AGENTS.md; docs/work-items/34-WFLX-V3A-MULTI-SOURCE.md (this order);
tools/experiments/pipeline.ts (runBlockedArm, ~line 330 — the arm that
ASSERTS the blocker; it must flip); tools/experiments/configs.ts
(EXP-V-05/06 arm definitions, expectedBlocker strings);
docs/experiments/records/EXP-V-05.yaml + EXP-V-06.yaml (the BLOCKED
records you will replace); tools/experiments/records.ts (record emission).
ADAPT TO WHAT IS REALLY THERE.

## 2. Deliverable A — the multi-source fix (surgical, contract-law honoring)

- Fix BlockIndex to key by the (sourceId, blockId) PAIR. Keep the public
  get() signature. Update the comment to state the pair-keying law.
- Audit the sibling namespace surfaces in the multi-source path and fix
  what is actually broken, minimally: (a) topic ids —
  `topic-${slugify(sectionTitle)}` is NOT namespaced per source while
  claims ARE (the sourceIds.length > 1 claimPrefix law in
  deterministic-extractor.ts ~line 244) — same-titled sections across two
  sources produce DUPLICATE topic ids; namespace topics per source under
  the same multi-source condition; (b) graph.sourceIds completeness for
  multi-source extraction; (c) entity global ids + merged mentions are
  INTENTIONAL (shared entities) — do not "fix" them; (d) relationship ids
  derive from entity ids (global) — fine as-is. Each change: one commit,
  one reason in the message.
- New unit tests (tests/source/ and/or tests/contracts/): two-source chain
  extracts a CONSISTENT graph (the exact reproduction above now passes);
  cross-source block-id collisions resolve per pair; same-titled sections
  across sources produce distinct topic ids; single-source extraction is
  BYTE-IDENTICAL to baseline (the fix must not perturb the single-source
  fingerprint path — prove it by regenerating and diffing).

## 3. Deliverable B — EXP-V-05/06 re-run UNCHANGED (the record flip)

- tools/experiments/pipeline.ts: the runBlockedArm path that asserts
  `expectedBlocker` becomes the real arm runner for EXP-V-05 (source
  ordering: source-note-b before source-note-a) and EXP-V-06 (one source
  removed: the single-source control vs the two-source baseline). Keep the
  experiment CONFIGS unchanged (the HANDOFF law: re-run UNCHANGED); adapt
  the runner code as the record-flip requires.
- Emit fresh records for EXP-V-05 and EXP-V-06 (docs/experiments/records/):
  actual results with full protocol fields, EXP_NOW stamps, evidence
  labels, honest verdicts (does source order affect narrative order? which
  scenes disappear or recombine?). The OLD BLOCKED record content is
  preserved in git history; the new record supersedes it with a
  superseded-blocker note pointing at the fix commit.
- Determinism: double-run the arms byte-identical (the runner's digest
  discipline); the committed comparison estate still regenerates
  byte-identically (tests/integration asserts — extend for the two new
  records per the established pattern).

## 4. Evidence + gates

- Append ONE registry entry docs/evidence/registry.jsonl (EV-030):
  observations (the root cause, the fix, the unblocked arms' results),
  invariants (single-source byte-identity proven; no wall-clock; configs
  unchanged), evidence_paths.
- Gates at delivery: typecheck 0; lint clean; chunked battery green
  (456 + your new tests — record the numbers); credential sweep of the
  diff (0 hits); double-run digest proof.
- Push-first delivery: commit + PUSH the branch at every milestone
  (setup, fix, tests, records, evidence). Completion report INLINE in the
  chat at the end (the durable transport — sandboxes are reaped).
- Memory law: small single commands; chunked test runs; never bare bun
  test at root. Bracketed dynamic-route paths typed fresh, never copied
  from displayed output (the §15 display-ghost).

## 5. TL station review criteria

Scope (owned trees only, zero frozen-tree edits), gates (chunked numbers
recorded), determinism (single-source byte-identity + double-run digests),
credential sweep, honest verdicts with labels, the record-flip audited
against the HANDOFF law (configs unchanged), evidence registry entry
complete.
