# Phase 4 Promotion Package — WebFlix-Lab v1 → v2 contract wave

Status: **PACKAGE ASSEMBLED 2026-09-30 by WFLX-V2-3 (final wave implementer);
TL #2 evidence sign-off PENDING.** This directory is the assembly the TL
audits and signs; nothing here is a promotion decision until the sign-off
block in `promotion-decision.md` is filled by TL #2 (the assembler does not
sign it).

## Package map

| Path | What it is |
|---|---|
| `docs/promotion/README.md` | This file: package map + audit instructions |
| `docs/promotion/promotion-decision.md` | The promotion verdict document: evidence classes (a)–(f) with per-class summaries + pointers, each labeled OBSERVED / DOCUMENTED / REPRODUCED / HYPOTHESIS / UNRESOLVED; ends with the PENDING TL #2 sign-off block |
| `docs/evidence/registry.jsonl` | The durable evidence ledger, EV-000 … EV-015 (one JSON object per line). EV-014 = EXP-X-02 execution; EV-015 = this package's assembly |
| `docs/experiments/records/*.yaml` | Per-experiment records (EXP-A-01..06 + R2, EXP-V-01..08, EXP-D-01, EXP-X-02, LAB-01..06) — the primary evidence behind classes (b) and (c) |
| `docs/handoff/v2-contract-wave-draft.md` | The v2 wave register + RULING 2026-09-29 (what went IN/OUT and why) — the decision provenance behind the wave being promoted |
| `docs/work-items/roadmap-status.md` | Live position: Phase 4 row + dated current-position entry |
| `artifacts/manifest/registry.json` | Unified artifact store inventory (27 records: 24 audio / 3 video), rebuilt at the wave boundary with the EXP-X-02 runs |
| `artifacts/audio/exp-x02/` | EXP-X-02 run artifacts (the C-5 verification evidence: summary, both arms' plans/QA/timing/diagnostics, control-arm report) |

## How to audit this package

1. **Read the ruling first**: `docs/handoff/v2-contract-wave-draft.md` (the
   2026-09-29 RULING section) — the wave's scope, the IN/OUT reasons, and
   the corrected fingerprint-transition mechanics. The package audits that
   ruling's execution, not a re-litigation of it.
2. **Read the verdict document**: `promotion-decision.md`, top to bottom.
   Every claim carries an evidence label and a pointer; spot-check the
   pointers against the registry (`registry.jsonl`) and the records.
3. **Re-verify the gates** (the station chunking, per EV-011's OOM lesson):
   `bun run typecheck` (0 errors), `bun run lint` (clean), then
   `bun test` chunked by surface group:
   `tests/contracts tests/source tests/director` / `tests/audio` /
   `tests/video` / `tests/integration`. Expected: 370/370, 0 fail.
4. **Re-verify the determinism spine** (the strongest single check): re-run
   `bun run exp:x02` — the harness re-executes both arms, re-checks the
   four falsifiers + station bar, and double-compiles every plan (the
   persisted artifacts must come out byte-identical apart from wall-clock
   fields and the summary timestamp). The v1 control worktree is
   auto-created at the pinned commit 720f984.
5. **Spot-check evidence honesty**: pick any HYPOTHESIS or UNRESOLVED label
   in the decision document and confirm it is NOT promoted to fact anywhere
   in the package (AGENTS.md discipline: no silent promotion).
6. **Check the sign-off state**: the "TL SIGN-OFF" block at the end of
   `promotion-decision.md` must still read PENDING. Only TL #2 fills it.

## What this package is NOT

- It is not a production change: the WebFlix boundary (AGENTS.md) holds —
  the deliverable is a promotion + integration handoff, and payswapdotorg/
  WebFlix itself is untouched by this repository.
- It is not product-parity proof: fixture-only success is not product
  parity evidence (AGENTS.md); the LAB series (EV-009) is the product-truth
  side of the comparison and it is honestly adversarial to several of our
  lab's design choices (see class (e)).
- It is not self-certifying: the assembler (WFLX-V2-3) executed the
  experiments and assembled the evidence; the promotion decision is TL
  #2's against this package.
