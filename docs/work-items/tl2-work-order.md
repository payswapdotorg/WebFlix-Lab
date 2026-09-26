# TL #2 Work Order — Three Concurrent Workers

## Dependency graph

~~~text
W0  Reference access + evidence infrastructure
 |
 v
W1  Shared IR + Source Intelligence + Director
 |
 +---------------------+
 |                     |
 v                     v
W2  Audio            W3  Video
 |                     |
 +----------+----------+
            v
       TL2 integration
            |
            v
      Cross-modal QA
            |
            v
       Promotion handoff
~~~

W0 and W1 are lead-controlled foundations. W2 and W3 can proceed concurrently after contract freeze.

## Phase 0 — TL #2 bootstrap

Tasks:
- verify repository HEAD
- read all canonical docs
- confirm reference notebook access path
- confirm authenticated browser session or official sharing
- verify golden video hash locally when original is imported
- establish experiment storage convention
- create evidence registry
- establish artifact naming and immutable-reference rules

Exit:
- workers can access the reference environment without the originating chat
- reference artifact identity is verified
- experiment protocol is operational

## Phase 1 — Worker 1 contract freeze

Tasks:
- define TypeScript or JSON schemas for shared IR
- implement SourceArtifact
- implement Claim, Entity, Topic and Relationship records
- implement authorized public article/Substack adapter
- implement normalization
- implement retrieval
- implement OverviewPlan
- implement grounded coverage evaluator
- create canonical plan fixtures

Exit:
- schemas frozen
- fixtures checked in
- W2 and W3 can work without editing shared contracts

## Phase 2A — Worker 2 Audio

Tasks:
- implement AudioTurn compiler
- implement dialogue graph
- implement Gemini TTS adapter
- implement open/local TTS adapter
- implement timing/alignment
- implement mixing/mastering
- implement audio QA
- reproduce documented mode semantics
- save benchmark artifacts and costs/latency

Exit:
- reproducible end-to-end Audio Overview from fixture
- mode differences are tested
- groundedness and speaker consistency are measured

## Phase 2B — Worker 3 Video

Tasks:
- annotate reference video
- define StyleBible schema
- implement VideoScene compiler
- implement deterministic SVG/diagram renderer
- implement illustration provider adapter
- implement optional motion/video provider adapter
- implement Remotion composition
- implement video QA
- reproduce Explainer-style visual grammar

Exit:
- reproducible end-to-end Video Overview from fixture
- scene/narration alignment measured
- style consistency evaluated
- visual grounding verified

## Phase 3 — TL #2 integration

Tasks:
- integrate W2 and W3 against frozen IR
- unify artifact manifests
- add reproducibility metadata
- add experiment result registry
- compare one source through both modalities
- run ablation experiments
- run local refinement tests
- document provider matrix

## Phase 4 — Promotion gate

Required:
- real-reference comparison evidence
- implementation artifacts
- benchmark results
- costs
- latency
- failure modes
- security and authorization posture
- unresolved gaps
- WebFlix integration design

No production promotion without TL #2 evidence sign-off.

## Worker path ownership

Worker 1:
- src/source
- src/director
- src/contracts
- tests/source
- tests/director

Worker 2:
- src/audio
- src/providers/audio
- tests/audio

Worker 3:
- src/video
- src/providers/visual
- src/providers/video
- src/compositor
- tests/video

TL #2:
- docs/handoff
- shared IR changes
- cross-cutting config
- integration tests
- final promotion package

## Drift controls

- shared contracts are versioned
- worker boundaries are explicit
- no worker may silently change another worker's IR
- provider-specific schemas stay inside adapters
- experiments must link to evidence
- every generated artifact carries provenance
- hypotheses must remain labeled as hypotheses

## Final deliverable

A future engineer should be able to clone this repository, read the canonical docs, establish authorized reference access, run the experiment protocol, and understand exactly why each implementation choice exists without asking for context from the originating chat.
