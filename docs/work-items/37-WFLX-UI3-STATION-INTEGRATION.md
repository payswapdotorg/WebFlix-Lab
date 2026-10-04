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
