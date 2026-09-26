# TL #2 Handoff — WebFlix Overview Studio Lab

## Mission

Build an isolated R&D reconstruction of the observable Audio Overview and Video Overview behaviors of Gemini Notebook / NotebookLM.

Reverse-engineer through public documentation, direct black-box observation of the real product, supplied reference artifacts, controlled mutations, ablation experiments, and reproducible lab implementation.

Do not claim knowledge of Google's private internals.

~~~text
OBSERVED -> HYPOTHESIS -> EXPERIMENT -> REPRODUCTION -> COMPARISON
                                           |
                                           v
                                      VALIDATED
~~~

## Required reference access

The real Gemini Notebook product is a required black-box instrument.

Follow docs/reference/gemini-notebook-access.md.

The human operator establishes a dedicated reference notebook and authenticates manually. Workers use the authorized browser session or official sharing. No passwords, cookies, OAuth tokens, recovery codes, or browser archives enter git.

The notebook should contain only authorized material, including the source used for the supplied artifact when permitted and controlled mutation sources.

## Golden artifact

Reference:
Orchestrating_Agentic_Development__Deconstructing_a_Multi-Agent.mp4

Metadata:
- duration 415.660408 s
- H.264 1280x720 30 fps
- AAC mono 44.1 kHz
- SHA-256 36485eb804de5c69aadf9c0a9d4998dfa85ce4e3ed9a4f502bbd45fc170cdce2

The original 65 MB binary is fingerprinted but not yet committed. See reference/video/ORIGINAL-ARTIFACT.md for the one-time import and Git LFS procedure.

The supplied artifact is the visual golden reference. Worker 3 must inspect it directly and annotate it before optimizing the implementation.

## Frozen architecture

~~~text
Authorized Source
      |
      v
Source Adapter
      |
      v
SourceArtifact
      |
      v
Source Intelligence
  structure / topics / entities / claims / relationships / evidence
      |
      v
Overview Director
  objective / audience / duration / coverage / narrative / style
      |
      +----------------------+
      |                      |
      v                      v
Audio Dialogue Graph   Video Storyboard
      |                      |
      v                      v
AudioTurn[]             VideoScene[]
      |                      |
      v                      v
Speech Providers       Visual Providers
      |                      |
      +----------+-----------+
                 v
           Timeline Composer
                 |
                 v
            Artifact Store
                 |
                 v
           QA / Evaluator
                 |
                 v
       smallest-unit refinement
~~~

## Shared contracts

Worker 1 freezes:
- SourceArtifact
- ClaimRecord
- EntityRecord
- TopicRecord
- RelationshipRecord
- OverviewPlan
- AudioTurn
- VideoScene
- GeneratedArtifact
- ExperimentRecord

Provider-specific request/response structures stay inside adapters.

## Worker 1

Own:
- source adapters
- public article/Substack ingestion
- normalization
- semantic graph
- retrieval
- OverviewPlan
- narrative compiler
- grounding/coverage evaluator
- shared contracts and tests

First gate: canonical OverviewPlan fixtures are checked in and contracts are frozen.

## Worker 2

Own:
- AudioTurn compiler
- multi-speaker dialogue graph
- Gemini TTS adapter
- open/local TTS adapter
- timing/alignment
- mixing/mastering
- audio QA

Test:
- mode changes
- prompt mutations
- language changes
- duration changes
- speaker consistency
- natural turn-taking
- groundedness
- pronunciation
- pacing

Do not implement dialogue as mechanical speaker alternation.

## Worker 3

Own:
- reference scene annotation
- StyleBible
- VideoScene compiler
- deterministic SVG/diagram renderer
- illustration adapters
- optional video-generation adapters
- Remotion composition
- video QA

First visual target: Explainer / narrated illustration.

Observed reference characteristics:
- hand-drawn / ink technical illustration
- graphite/slate background
- cyan/teal/green emphasis
- architecture and state/process diagrams
- code-like technical panels
- visual metaphors
- recurring motifs
- deliberate camera motion and scene transitions
- little reliance on stock photography

Use deterministic graphics for exact labels, numbers and relationships. Use generative media for illustration and metaphor. Use generated video only where motion adds explanatory value.

## Controlled experiments

Required initial experiments are in docs/experiments/matrix.md.

Core questions:
- How do format modes change editorial structure?
- Which changes are local when one claim/entity/source changes?
- How does target duration change narration density and scene count?
- Which layers respond to custom instructions?
- What remains invariant across languages?
- How stable are speakers, visuals and structure across regeneration?
- Does a staged compiler materially outperform one-shot generation?
- Does local refinement preserve unaffected units?

Every experiment follows docs/experiments/protocol.md.

## Acceptance

No parity claim is accepted from unit tests alone, fixture-only artifacts, screenshots alone, LLM self-assessment, or one successful run.

Promotion requires:
1. reproducible implementation evidence
2. real reference-product comparison evidence
3. artifact hashes and provenance
4. cost and latency measurements
5. failure-mode documentation
6. security and authorization review
7. WebFlix integration design

## Production boundary

Do not modify payswapdotorg/WebFlix from this repository.

The final deliverable is a promotion handoff, not a production change.
