Dispatched: 2026-10-04 (TL #2)

# WFLX-UI3 — Operator Studio: Station Integration + Journey Docs (Worker 3)

You are Worker 3 (W3) on the WebFlix-Lab studio line — the closing wave.
W1 (shell: real-pipeline compile, player, provenance) and W2 (Interactive
Audio: real InteractiveAudioSession routes, surface D, locality + grounding
proofs) are BOTH MERGED on main. The studio is browser-testable end-to-end.
You close the stage: documentation, provenance completeness, and the
parity-close decision amendment. First commit records this file verbatim as
docs/work-items/37-WFLX-UI3-STATION-INTEGRATION.md with a dated header line
`Dispatched: 2026-10-04 (TL #2)` above the title.

Repository: https://github.com/payswapdotorg/WebFlix-Lab
Baseline: main @ 900e86d (or newer — clone fresh and verify with `git log --oneline -1`).
Branch: `work/wflx-ui3-station-integration` (cut from main). Push with the PAT
below. NEVER open PRs, never merge — TL-owned. NEVER commit any
credential/token/key to files or history (PAT is for `git push` only).

GITHUB_PAT (git push only, never commit): [REDACTED:github_token]

Read before coding: AGENTS.md, docs/handoff/tl2-overview-studio-handoff.md,
docs/work-items/35-WFLX-UI1-STUDIO-SHELL.md + 36-WFLX-UI2-INTERACTIVE-AUDIO.md
(the delivered contracts), apps/studio/ (the full delivered surface — read
the actual code), docs/promotion/parity-close-decision.md,
docs/work-items/roadmap-status.md (the studio-stage entries).

## Mission (TL ruling — binding)

The studio stage's CODE is done. Your wave is INTEGRATION + DOCS: make the
repository fully self-describing for a future engineer who clones it cold —
run instructions, journey documentation, provenance audit, and the formal
parity-close amendment. ZERO new product capability. You may ONLY touch
docs/**, apps/studio/README.md, and tests ONLY if an audit finding requires
a regression test (report it as such).

## Deliverables (each VERIFIED with evidence or EXPLICITLY UNRESOLVED)

### A. apps/studio/README.md — full form — VERIFIED
- What the studio is (the lab's browser surface over the frozen pipeline;
  REPRODUCED class; NOT the Gemini product).
- How to run: `bun run studio` (port law 4313, fixed); `bun test
  apps/studio/test/`; the typecheck/lint gates.
- The operator journey, step by step, as verified by the TL in-browser:
  source -> compile (mode/duration) -> player + transcript + provenance ->
  Join Interactive Session -> pick a boundary marker -> typed ask (voice
  capture UNRESOLVED — text stand-in) -> inserted turns + locality table +
  grounding panel + session master (fork semantics).
- The honest boundaries (fork-and-compare vs product cumulative chat;
  typed stand-in; offline provider pinned; in-memory stores; restart
  behavior; media fingerprinted-not-committed).
- The gateway note: through the operator console every URL carries
  XTransformPort=4313 (the routing key); direct localhost access works
  identically.

### B. Root README.md — studio section refresh — VERIFIED
- Update the "Operator Studio (apps/studio)" section to reflect W2: the
  interactive session surface + the one-line run command. Touch nothing
  else in the file.

### C. Provenance completeness audit — VERIFIED
- Audit the three surfaces' provenance fields (source fingerprint, plan
  id, seed, artifact ids, media sha256, evidence class labels) against the
  repo's GeneratedArtifact / artifact.json conventions (src/contracts,
  existing artifacts/** sidecars). Produce the audit as a section in your
  work-order record (37-...md): field-by-field table, PASS/GAP per surface.
- If GAPS exist in the API/UI rendering (fields the machinery already
  computes but the studio does not display), fix the DISPLAY layer only
  (apps/studio/api/serialize + web rendering) — never the machinery. A gap
  that would require frozen-tree changes goes to the HANDOFF lines.

### D. docs/promotion/parity-close-decision.md amendment — VERIFIED
- Append a dated studio-stage section: the studio adds a browser-testable
  surface over the frozen pipeline (WFLX-UI1/UI2 merged 2026-10-04;
  493 -> 501 battery); the studio changes NO parity conclusion — it is
  REPRODUCED-class lab implementation, adds no product-parity evidence,
  and the parity ledger (audio 21V/14D/0P, video as closed) stands
  unchanged. Reference the roadmap-status.md studio entries for the
  in-browser verification record. Follow the document's existing tone and
  signing conventions (TL-signed sections; you draft, the TL signs after
  station review — mark your section "drafted by wflx-ui3, pending TL
  sign-off").

### E. AGENTS.md read-list refresh — VERIFIED
- The studio stage is now part of the repo's canon: add
  `apps/studio/README.md` to the "Read before coding" list (one line).
  Touch nothing else in AGENTS.md.

### F. Gates — VERIFIED
- `bun run typecheck` 0 errors; `bun run lint` clean; `bun test` green —
  battery stays 501/501 (or 501+N if an audit finding required a
  regression test; report the exact count and the reason).
- Credential sweep over your diff: 0 hits. Frozen trees READ-ONLY
  (src/**, artifacts/**, experiments/**, tests/** outside apps/studio/test/**).
  Docs you may touch: apps/studio/README.md, README.md (the studio section
  only), docs/promotion/parity-close-decision.md (the appended section
  only), AGENTS.md (the one read-list line), docs/work-items/37-...md
  (your verbatim work order + the audit section).

## Evidence classification (binding, AGENTS.md)

Everything remains REPRODUCED-class. No OBSERVED claims. The parity-close
amendment explicitly introduces NO new parity evidence.

## Delivery discipline

- Small commits, push FIRST and keep pushing. Final message (chat): branch
  name, HEAD sha, files-touched, gate results, the audit table summary
  (PASS/GAP counts), honest UNRESOLVED list.
- The TL station-reviews (gates + credential sweep + frozen-tree diff +
  a doc read-through + the browser journey re-verification) BEFORE merge.

## Non-goals (hard)

No new UI capability. No new API routes. No pipeline changes. No new npm
deps. No frozen-tree edits. No artifacts/ writes. No PRs/merges. No
parity claims.

---

# WFLX-UI3 Delivery Record — Provenance Completeness Audit (Worker 3)

Appended by W3 per Deliverable C. Evidence class: REPRODUCED (lab
implementation; AGENTS.md). Audit basis: `src/contracts/generated-artifact.ts`
(the `GeneratedArtifact` convention) + the committed `artifacts/**`
sidecars (e.g. `artifacts/audio/canonical-deep-dive-5min/artifact.json`,
`artifacts/audio/interactive-01/session-01/artifact.json`) + the studio's
delivered surfaces read in full (`apps/studio/pipeline.ts`, `sessions.ts`,
`api/*.ts`, `web/app.ts`, `web/index.html`).

## Field-by-field audit (PASS / GAP / N/A per surface)

Surfaces: **S1** = source surface (`GET /api/sources` + landing card);
**S2** = overview surface (`POST /api/overview` + player/transcript/
metadata/provenance panels); **S3** = interactive session surface
(`POST /api/session`, `POST /api/session/:id/intervene`,
`GET /api/session/:id` + session/master/locality/grounding/provenance/
history panels).

| # | Convention field (audited meaning) | S1 Source | S2 Overview | S3 Session |
|---|---|---|---|---|
| 1 | Source fingerprint (`SourceArtifact.fingerprint`: contentSha256 / rawSha256 / textLength) | **PASS** — API carries all three; UI renders the content sha short + full values in the tooltip | **PASS** — the compile runs over the enumerated source whose fingerprint is displayed at selection; the response carries `sourceId` + the artifact sidecar lineage | **PASS** (after fill G3) — lineage `sourceIds` serialized + rendered; the fingerprint itself lives on S1 where it belongs |
| 2 | Plan id (`planId` + `planHash`) | **N/A** — no plan exists at enumeration (modes + canonical durations listed instead) | **PASS** — planId + planHash in the metadata panel (full values in tooltips) + `artifact.planId` in the provenance panel | **PASS** — responsePlanId serialized + rendered; the baseline planId renders in the S2 metadata panel |
| 3 | Seed (`generator.seed`; studio constants) | **N/A** — no seed-bearing record pre-compile | **PASS** — `Generator · seed …` + the reproducible flag rendered | **PASS** — provenance.seed + provenance.now rendered |
| 4 | Artifact ids (artifact id; `sourceIds`; session/response/baseline ids) | **PASS** — SourceArtifact id in the API + the radio value; title/label/fingerprint rendered | **GAP → FIXED (G1)** — artifactId rendered; `artifact.sourceIds` was computed + serialized but NOT rendered → row added | **GAP → FIXED (G3)** — session/response/baseline artifact ids rendered; lineage `sourceIds` were not serialized → DTO + render added |
| 5 | Media sha256 (`media.sha256`; session master sha; per-turn WAV identity) | **N/A** — no media at source stage | **PASS** — media sha256 (short + full tooltip), size, format rendered; the sidecar-hash == served-bytes equality is test-asserted | **PASS** — sessionMasterSha256 in the master card + ix provenance; the locality table renders per-turn WAV byte-identity verdicts; served-bytes equality test-asserted |
| 6 | Evidence class labels (`REPRODUCED`) | **PASS** — surface note in the API response; header "Not the Gemini Notebook product" | **PASS** — `evidenceClass` in the DTO; "REPRODUCED · lab evidence" tag on the player card; footer | **PASS** — `evidenceClass` on establish/state/intervene DTOs; static labels in the ix section + footer |
| 7 | Providers (per-stage provider usage; speech provider) | **PASS** — adapter + extractor ids rendered in the source stats | **PASS** — speech provider in the player card + provenance; every stage·provider row rendered | **GAP → FIXED (G2)** — the response speech provider was serialized (`response.provider`) but NOT rendered → row added |
| 8 | Timestamps (`createdAt` / `now`) | **N/A** — the fixed studio ingest constant; no per-source record exists on the fixture | **PASS** — "Created at" rendered | **PASS** — "Now" rendered |
| 9 | Mastering backend | **N/A** | **PASS** — "Mastering · pure-ts (deterministic)" | **PASS** — "Mastering" rendered in ix provenance |
| 10 | Reproducible flag (`generator.reproducible`) | **N/A** | **PASS** — "Reproducible · yes (byte-identical recompile)" | **GAP → FIXED (G5)** — the session artifact's flag was not serialized → DTO + render added |
| 11 | QA summary (`qa.status` + issues) | **N/A** | **PASS** — honest status + issue count rendered | **GAP → FIXED (G4)** — the response segment's QA (carried on the session artifact sidecar) was not serialized → DTO + render added |
| 12 | Notes (honest boundary notes) | **PASS** — research-implementation surface note | **PASS** — `artifact.notes` rendered | **PASS** — the same-machinery note rendered; the honest-boundary labels are static on the surface |
| 13 | Lineage (`derivedFromArtifactId` / fork lineage) | **N/A** | **PASS** — fresh generation per compile; no lineage exists to show | **PASS** — baseline artifact id + fork history (seq, boundary, question, inserted ids, sha, verdicts) rendered |

**Totals: 39 audited cells — 27 PASS / 5 GAP→FIXED / 7 N/A.** The N/A
cells are fields that do not exist at that stage of the chain (no plan,
seed, media, QA, mastering, or reproducible-flag record exists at source
enumeration; no lineage on a fresh compile). All five gaps were
machinery-computed-but-undisplayed fields, fixed in the DISPLAY LAYER ONLY
(`apps/studio/api/types.ts` DTO + `apps/studio/sessions.ts` serialization +
`apps/studio/web/app.ts` rendering) per the work order's fix rule — zero
machinery changes, zero frozen-tree edits, zero new API routes.

## Gap fixes (display layer only)

- **G1** overview provenance: `Source ids` row (render-only — the DTO
  already carried the full artifact).
- **G2** ix provenance: `Response speech provider` row (render-only —
  `response.provider` was already serialized).
- **G3** ix provenance: `Source ids` row (DTO + serialize + render —
  `result.session.artifact.sourceIds`).
- **G4** ix provenance: `Response QA` row, status + issue count (DTO +
  serialize + render — the sidecar's `qa` summary).
- **G5** ix provenance: `Reproducible` row (DTO + serialize + render —
  `generator.reproducible`).

Regression test: `apps/studio/test/session.test.ts` gains one test pinning
the fills (sourceIds == the baseline sidecar's, response QA status shape,
response provider id, session artifact id == served master id, the
reproducible flag) — battery 501 → **502** (the work order's 501+N rule,
N=1, reason: the audit finding required a regression pin).

## HANDOFF lines (frozen-tree findings)

**None.** No audit finding required a frozen-tree change. Observed, not
actionable (no gap): the W1-era roadmap station note says "20-turn
transcript" for the Deep-Dive compile; the current main produces a
24-turn/307.6 s baseline (byte-deterministic per the double-boot test —
WFLX-UI3 station re-verification, agent-browser). The roadmap is TL-owned;
flagged here for the TL's station review, not edited.

## Station re-verification (agent-browser, this wave)

Boot `bun run studio` (:4313) → source card (fingerprint) → compile
Deep-Dive 300 s (24 turns, 307.6 s) → provenance panel incl. the G1
`Source ids` row → Join (`ix-session-1`, 24 turns, 23 boundaries 0..22) →
boundary 4 → typed EXP-L-03 question → **24/24 original turns
byte-identical, pre-boundary +0 ms, post-boundary uniformly +21,173 ms
(invariant line: +21,173 ms == +21,173 ms), F1 grounding PASSED (claim-b13
+ claim-b14 by content), session master 328.8 s = 24+2 turns** → ix
provenance renders all five fills (response provider, source ids,
response QA, reproducible, same machinery) → zero browser console
errors/warnings. Matches the TL's W2 station record exactly.

## Gates (Deliverable F)

- `bun run typecheck` — **0 errors**.
- `bun run lint` — **clean**.
- `bun test` — **502/502 pass, 0 fail** (501 baseline + 1 WFLX-UI3
  provenance regression test; 17,721 expect() calls, 56 files).
- Credential sweep over the full diff (669 lines): credential patterns
  (classic + fine-grained GitHub PAT prefixes, AWS keys, PEM blocks,
  Slack tokens, API-key prefixes, JWTs) — **0 hits**; the session's push credential string — **0 hits**; loose
  terms (password/secret/api-key) — **0 hits**. The PAT line in the
  verbatim work order above is the redacted placeholder as delivered —
  the auditable form (per the 35/36 convention and the work order's
  credential law).
- Frozen-tree diff check: `git diff --name-only main..HEAD` touches ONLY
  `docs/work-items/37-…`, `apps/studio/README.md`, `README.md` (studio
  section only), `docs/promotion/parity-close-decision.md` (appended
  section only), `AGENTS.md` (one read-list line), and the
  display-layer-fix files (`apps/studio/api/types.ts`,
  `apps/studio/sessions.ts`, `apps/studio/web/app.ts`,
  `apps/studio/test/session.test.ts`). **`src/**`, `artifacts/**`,
  `experiments/**`, `tests/**` (outside `apps/studio/test/**`): untouched.**

## UNRESOLVED (honest list)

- Voice capture remains **UNRESOLVED** (typed stand-in — unchanged,
  labeled on the surface; no microphone/ASR anywhere).
- The W1-era "20-turn" roadmap note vs the current 24-turn compile —
  flagged for the TL above (roadmap is TL-owned).
- Nothing else in this wave's scope is unresolved; all deliverables
  A–F are VERIFIED with evidence as recorded above.
