# WFLX-P1 — Audio Parity Wave (Parity Completion Phase, Wave 1 of 3)

Document status: **DISPATCHED 2026-09-30 to WFLX-P1** (audio-parity implementer,
branch `work/wflx-p1-audio-parity` off `main` @ b1054a6). This file records the
dispatched work order verbatim, per the first-commit rule of the dispatch —
with ONE redaction: the push PAT in §6 is a push-URL-only credential and is
never committed (AGENTS.md ground rule overrides verbatim reproduction).

## 0. Identity and ground rules

- Repo: `https://github.com/payswapdotorg/WebFlix-Lab.git` (public read).
- Baseline: `main` @ b1054a6 (must contain parity-completion-work-order.md;
  if absent STOP and report UNRESOLVED).
- Branch: `work/wflx-p1-audio-parity` from main. Push with the PAT below;
  NEVER open PRs / never merge (TL-owned); NEVER commit any credential,
  token, key, or auth state to files or history.
- You own (additive only): `src/audio/`, `src/providers/audio/` (create if
  absent), `tests/audio/`, `experiments/`, `artifacts/audio/`, plus
  `package.json` script entries you need. Do NOT touch `src/contracts/`
  (CONTRACTS_VERSION stays 2.0.0 — no bump this wave; additions live behind
  existing surfaces), `src/source/`, `src/director/`, `src/video/`,
  `src/compositor/`. Needed changes there go in your report as HANDOFF.
- Evidence labels (AGENTS.md): OBSERVED / DOCUMENTED / HYPOTHESIS /
  REPRODUCED / UNRESOLVED. Never silently promote HYPOTHESIS to FACT.
- Determinism is the lab's spine: the OFFLINE deterministic pipeline stays
  the DEFAULT and its 370-test baseline + committed fingerprints stay
  green/valid. Live surfaces are env-gated and honestly bounded.

## 1. Setup (verify before working)

~~~bash
git clone https://github.com/payswapdotorg/WebFlix-Lab.git
cd WebFlix-Lab && git checkout main && git log --oneline -1   # b1054a6
git checkout -b work/wflx-p1-audio-parity
bun install
bun run typecheck && bun run lint
bun test tests/contracts tests/source tests/director   # 151
bun test tests/audio                                    # 123
bun test tests/video                                     # 82
bun test tests/integration                               # 14
~~~
(370/370 baseline — the EV-011 chunked doctrine; bare `bun test` at root
discovers only 33. ALWAYS run the four chunks.)

Read in order: `AGENTS.md`; `docs/work-items/parity-completion-work-order.md`
(your phase charter, esp. §2 frozen architecture + §5 TL-rejects);
`docs/promotion/promotion-decision.md` (honest-boundary style, classes
(b)/(f)); `docs/experiments/protocol.md` + `record-template.yaml`; the
actual `src/audio/` tree (adapter interface, offline providers, benchmark
generators) — ADAPT TO WHAT IS REALLY THERE.

FIRST COMMIT: this work order verbatim as
`docs/work-items/31-WFLX-P1-AUDIO-PARITY.md` (dated 2026-09-30).

## 2. Deliverable A — REAL live TTS execution path (EV-016)

- Implement a live provider that exercises the EXISTING multi-speaker
  adapter interface end-to-end with REAL speech synthesis: use the
  `z-ai-web-dev-sdk` TTS (server-side; `bun add z-ai-web-dev-sdk` as
  devDependency if absent) — a real production TTS service. Additive file
  in the audio provider tree (e.g. `src/providers/audio/zai-live.ts`),
  implementing the same interface as the offline providers.
- Env-gated activation: `WFLX_TTS_PROVIDER=live-zai` (default stays the
  offline provider — zero behavior change when unset). Credential/config
  wiring through env only — NO secrets in git, ever.
- Voice/provider provenance: generated artifacts + manifests record the
  actual provider identity, model/voice ids, and env flag state (the
  existing artifact.json provenance pattern — extend it).
- **EXP-L-01** (`experiments/run-exp-l-01.ts`): compile the canonical 42s
  deep-dive audio benchmark plan through the LIVE provider — real per-turn
  WAV segments + mixed master under `artifacts/audio/exp-l-01/` with
  artifact.json + qa-report.json + timing-manifest.json (match the existing
  benchmark artifact schema). Record: per-segment + total wall latency;
  duration-vs-plan-target band; per-turn segment count == plan turns;
  WAV validity (header, sample rate, channels); usage/cost observables the
  SDK reports. EV-016 registry record per protocol.
- FALSIFIERS (structural — live output is honestly stochastic, like the
  real product per LAB-06; NEVER claim byte-identity for live output):
  F1 valid playable WAV per turn; F2 turn count == plan; F3 total duration
  within an explicit recorded band of plan target; F4 offline baseline
  outputs byte-UNCHANGED when the live flag is off (run the offline
  benchmark double-run to prove it).
- IF the SDK is genuinely unavailable/erroring in your sandbox: implement
  the adapter + harness completely, run EXP-L-01 in harness-recorded mode,
  and mark live execution EXPLICITLY UNRESOLVED with the exact blocker and
  error output. That is an honest partial — NEVER substitute offline audio
  and label it live.

## 3. Deliverable B — Production-quality speech benchmark suite (EV-017)

A repeatable benchmark harness (`experiments/` + `tools/` as needed)
measuring lab-audio quality dimensions against recorded targets, each with
a falsifier and honest structural proxies (this is a LAB benchmark —
instrumented measurement, not LLM self-assessment, which the TL rejects):

- **Speaker consistency**: same-voice identity across turns (voice-config
  fingerprint + acoustic proxy e.g. per-turn duration/formant-band profile
  within tolerance — record the method honestly).
- **Pacing / pause**: inter-turn gap distribution vs plan gaps; speech
  rate (chars/sec) band per turn.
- **Pronunciation proxy**: numeric/label WER against the source's exact
  label set via forced-alignment-free transcript check where available;
  else record as UNRESOLVED method and use duration-band + claim-voicing
  checks (11/11 claims voiced — the EXP-D-01 discipline).
- **Multi-language**: run the ES arm (the documented v1 boundary: ES
  surfaces voice EN anchors — verify it still holds or record the delta).
- **Mode + duration**: brief/critique/debate/deep-dive arms at their
  canonical targets; over-budget flag honesty preserved.
- EXP-L-02 record under `artifacts/audio/exp-l-02/`; EV-017 registry
  record. Each dimension: VERIFIED with numbers, or EXPLICITLY UNRESOLVED.

## 4. Deliverable C — Interactive Audio Overview: architecture + prototype (EV-018)

The real product behavior (Google-documented): the listener verbally joins
the hosts, receives a SOURCE-GROUNDED response, then the ORIGINAL overview
resumes. Lab reconstruction, provider-independent:

- **Session contract** (additive, behind existing surfaces): an
  `InteractiveAudioSession` layer over the compiled overview that accepts
  a listener intervention at a TURN BOUNDARY, compiles a response turn
  through the SAME Director/graph machinery with a grounding check
  (response claims must be source-grounded — the W1/W2 grounding
  machinery), then RESUMES the original plan with the original turns
  intact (C-5 locality applies: the injection must not reshuffle untouched
  turns — prove it with a diff proof).
- **Prototype** (`experiments/run-interactive-audio.ts` or a CLI): a
  scripted demonstration of join → source-grounded response → resume on
  the canonical fixture, with recorded input interventions (text-scripted
  stand-ins for voice input — voice capture itself stays UNRESOLVED,
  recorded honestly). Artifacts under `artifacts/audio/interactive-01/`.
- Falsifiers: F1 response turn is source-grounded (grounding check PASS);
  F2 original turns byte-identical across the intervention boundary
  (locality proof); F3 resume order preserved (turn sequence integrity);
  F4 determinism — double-run of the scripted session byte-identical.
- EV-018 registry record. Architecture doc: `docs/audio/interactive-audio-architecture.md`.

## 5. Regression preservation (the C-5 spine)

- EXP-X-02 falsifiers must stay green: re-run `bun run exp:x02` — the
  A/B record must reproduce (1/22 treatment vs 17/22 control; four
  falsifiers PASS). Record the re-run numbers in your report.
- The 370-test baseline stays green + your new tests add on top (record
  the new chunk numbers, e.g. audio 123 → N).
- No committed fingerprint changes (no contract bump → no transition; run
  the manifest packet digest double-run to prove no-transition:
  `bun run manifest:build` twice, digests identical, record them).

## 6. Docs + delivery

- roadmap-status.md: append the WFLX-P1 section (delivered / UNRESOLVED
  per dimension — the work-order §4 gate discipline).
- Evidence registry: EV-016 / EV-017 / EV-018 per protocol.
- Gates before push (four chunks + typecheck + lint): record exact
  numbers. Credential sweep: `rg -i "ghp_|sk-|api[_-]?key|secret" --glob
  '!*.lock'` over your diff = 0 hits.
- Push: `git push -u origin work/wflx-p1-audio-parity` with PAT
  `[REDACTED: push PAT — push-URL-only value, never committed per AGENTS.md]`
  (URL: `https://<PAT>@github.com/payswapdotorg/WebFlix-Lab.git`; the PAT
  is for the push URL only — never in files/commits).
- Final message: `WFLX-P1 COMPLETION REPORT` — (A/B/C) delivered per
  dimension with VERIFIED / EXPLICITLY UNRESOLVED; files touched grouped;
  gate numbers (chunks + totals + new-test counts); EXP-X-02 re-run
  numbers; packet digest pair; honest boundaries; HANDOFF entries; branch
  + HEAD sha. No placeholders; report ONLY what you verified.
