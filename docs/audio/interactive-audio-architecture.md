# Interactive Audio Overview — Architecture (EV-018)

Document status: **REPRODUCED 2026-09-30 by WFLX-P1** (branch
`work/wflx-p1-audio-parity`). Lab reconstruction of the observable
Google-documented Interactive Audio Overview behavior: the listener
verbally joins the hosts, receives a SOURCE-GROUNDED response, then the
ORIGINAL overview resumes. Provider-independent; the prototype runs the
offline deterministic provider.

Implementation: `src/audio/interactive/session.ts`; prototype:
`experiments/run-interactive-audio.ts`; artifacts:
`artifacts/audio/interactive-01/` (EXP-L-03 / EV-018).

## 1. Product behavior under reconstruction (DOCUMENTED, Google)

- The listener joins the conversation verbally mid-overview.
- The hosts respond with content grounded in the notebook's sources.
- The original overview then resumes with its content intact.

Evidence labels: the behavior is DOCUMENTED from Google's public
description of Interactive Audio Overviews; the lab REPRODUCED the
observable shape (join → grounded response → resume) — this is a
reconstruction of observable output behavior, never Google's internals
(the frozen architecture rule).

## 2. Session architecture (frozen-architecture compliant)

```text
compiled overview (AudioOverviewResult)
        |
        v
InteractiveAudioSession.intervene({ afterTurnIndex, listenerText })
        |
        |  1. deterministic claim retrieval over the SAME SemanticGraph
        |     (token-overlap scoring over claim statements + topic/entity
        |      labels; salience tie-break; honest top-salience fallback for
        |      content-empty questions, recorded)
        |
        |  2. intervention-response OverviewPlan (one beat: ack interjection
        |     [zero-claim, allowed purpose] + grounded response turn citing
        |     the retrieved claims) — passes the SAME frozen plan guard and
        |     W1 deep validation (builder honesty rule)
        |
        |  3. compile through compileAudioOverview — the SAME machinery:
        |     W1 grounding validation at the audio boundary, W2 dialogue
        |     graph grounding rules, seeded text realization, per-turn
        |     synthesis (any SpeechProvider), timing, mixing, QA
        |
        |  4. splice: session manifest = original entries with the response
        |     entries inserted after the boundary turn; every ORIGINAL entry
        |     keeps its duration, gap and audio bytes (C-5 locality); the
        |     pause after the response mirrors the original boundary pause
        |
        |  5. resume: original turn sequence continues in order; session
        |     master = mix + master over the combined manifest
        v
InteractiveSessionResult { responsePlan, responseCompile, grounding,
                           session {manifest, master, artifact, wav},
                           proofs {locality, order} }
```

The Director owns editorial decisions; the session layer owns only the
intervention lifecycle (retrieval, response-plan construction, splice,
resume). No provider-specific logic anywhere in the session layer.

## 3. Grounding check (F1) — the W1/W2 machinery

The response must be source-grounded. Three surfaces, all from the
existing machinery:

1. **W1 deep validation** (`validateOverviewPlan`): the intervention plan
   is validated against the source graph + sources — coverage accounting
   (retrieved claims covered; every other graph claim explicitly omitted
   with a recorded reason), claim/beat/topic references, duration
   accounting, evidence-span resolution.
2. **W2 dialogue-graph rules** (`validateDialogueGraph` over the compiled
   graph): factual turns need >= 1 resolvable claim id (the response turn
   is `explanation` with the retrieved claims); zero-claim turns are
   restricted to conversational purposes (the ack is `interjection`).
3. **Claim resolution**: every response-turn claim id resolves in the
   source graph; the realized response text voices the verbatim claim
   anchors (the deterministic realizer's anchor discipline).

`checkResponseGrounding(responsePlan, responseGraph, graph, sources)`
returns the three surfaces as a structured result — the prototype's F1.

## 4. C-5 locality (F2) and resume integrity (F3)

The injection must not reshuffle untouched turns:

- **Per-turn locality proof**: for EVERY original turn the session records
  WAV-sha256 equality, actual-duration equality, and gap equality against
  the baseline; `startMs` shifts by exactly the inserted response total
  (turns + gaps) for post-boundary turns and 0 for pre-boundary turns.
- **Construction guarantee**: the session manifest copies baseline entries
  (values unchanged) and inserts the response entries only at the boundary
  position; the session mix consumes the SAME baseline synthesis payloads
  (byte-identical WAVs), never a re-synthesis.
- **Order integrity (F3)**: the session sequence equals the baseline
  sequence with the response turns inserted only at the boundary position —
  machine-checked by sequence comparison.

This mirrors the C-5 discipline proven by EXP-X-02 at the text/timing
layers: smallest-unit change, everything else byte-identical.

## 5. Determinism (F4)

Same (baseline inputs, seed, now, scripted intervention) → byte-identical
session master + manifest (offline provider; proven by the prototype's
double-run). Live providers remain honestly stochastic per call — the
locality proof still holds (the baseline payloads are reused, never
re-synthesized) but the RESPONSE segment's audio varies run-to-run
(EV-016/LAB-06 discipline).

## 6. Honest boundaries (recorded, never silently promoted)

- **Voice capture UNRESOLVED**: listener interventions are text-scripted
  stand-ins recorded with each session (`intervention.json` /
  `summary.json`). No speech-to-intent layer is claimed. A real voice-input
  path would need an ASR front-end (the lab already exercises the SDK ASR
  route in EXP-L-02 for transcripts) plus barge-in/streaming playback
  surfaces — none of that is claimed here.
- **Director entry point (HANDOFF)**: the Director exposes no
  question-driven single-turn entry point (it compiles whole editorial
  plans), so the response plan is intervention-layer constructed and then
  validated + compiled through the same machinery. A
  `compileInterventionPlan` Director entry is a TL-adjudication candidate.
- **Response-QA carriage**: the session artifact sidecar carries the
  response segment's QA report (the only NEW quality surface); the
  baseline's own QA lives on the baseline artifact.
- **Session media**: fingerprinted-not-committed (the 5-min golden-media
  precedent); sha256 recorded in `intervention.json`.
- This is lab reproduction evidence — NOT product-parity evidence
  (AGENTS.md).

## 7. Verified falsifiers (prototype run, 2026-09-30)

| Falsifier | Result |
|---|---|
| F1 response turn source-grounded (W1 + W2 + claim resolution) | PASS — both sessions |
| F2 original turns byte-identical across the boundary (WAV sha256 + duration + gap per turn; exact post-boundary shift 21171 ms / 12314 ms) | PASS |
| F3 resume order preserved (sequence equality, insertion only at boundary) | PASS |
| F4 determinism — scripted session double-run byte-identical | PASS |

Retrieval sanity (recorded): session-01's question retrieved
`claim-oss-runtimes` + `claim-tool-catalog` (content-matched);
session-02's retrieved `claim-purpose` (content-matched).
