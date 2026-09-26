# TL #2 Handoff — WebFlix Overview Studio Lab

## Mission

Build an isolated R&D implementation in `payswapdotorg/WebFlix-Lab` for:

1. Audio Overview — source-grounded multi-speaker conversational synthesis.
2. Video Overview — source-grounded narrated visual synthesis.

Target observable behavior/quality of Gemini Notebook / NotebookLM, not Google's private internals, branding or proprietary assets.

## Primary reference

Use the user-supplied reference MP4 from the originating task.

Observed properties:
- ~6m56s
- 1280x720
- 30fps
- AAC mono
- coherent hand-drawn technical illustration language
- architecture/process diagrams
- visual metaphors
- source-driven technical visuals

The first target is **Explainer-style Video Overview**, not Cinematic.

## Why this lab matters

A public Substack/article/Markdown/text source could become:
- Audio Overview
- Video Overview
- semantic-search source
- visual explainer
- future podcast/briefing/clips

## Ground truth

Repository is source of truth.

Do not claim NotebookLM parity from a single demo, a screenshot, fixture-only generation, or an LLM's self-assessment.

Every artifact records:
- source hash
- generation config
- model/provider
- cost
- latency
- QA result
- reproducibility record

Behavioral reverse engineering may use public documentation and supplied artifacts.

Do not access private Google endpoints, bypass access controls, extract private prompts, scrape private notebook data, or copy proprietary visual assets.

## Frozen architecture

```text
Text / article / PDF / audio / video
              |
              v
       Source Adapter Layer
              |
              v
       Source Artifact IR
              |
              v
     Source / Media Intelligence
              |
              v
       Overview Director
          /          \
         v            v
   Audio Script   Video Storyboard
         |            |
         v            v
   Voice Engine   Visual Engine
         |            |
         +-----+------+
               v
          Compositor
               |
               v
         Artifact Store
               |
               v
          QA / Refinement
```

## Shared intermediate representation

### SourceArtifact
- id
- type
- canonical URL/location
- title
- author
- date
- cleaned content
- source blocks
- provenance
- extraction method
- content hash
- authorization state

### ClaimRecord
- id
- normalized claim
- source block ids
- entities
- evidence
- importance
- confidence

### OverviewPlan
- objective
- audience
- language
- target duration
- selected themes
- narrative arc
- source coverage
- excluded material
- style
- sequence

### AudioTurn
- segment id
- speaker
- text
- supporting claims/source blocks
- style
- pronunciation
- target duration

### VideoScene
- scene id
- narrative purpose
- duration
- narration ids
- visual type
- source-supported facts
- exact labels
- visual prompt
- style reference
- motion
- transition

### GeneratedArtifact
- id
- type
- source ids
- plan id
- model/provider
- generation version
- assets
- duration
- resolution
- hash
- QA state

# Worker 1 — Source Intelligence + Overview Director

Own:
- SourceArtifact
- public article/Substack adapter
- normalization
- topic/entity/claim graph
- retrieval
- OverviewPlan
- narrative compiler
- coverage evaluator
- shared contracts/tests

Experiments:
1. messy note -> semantic graph
2. semantic graph -> coherent OverviewPlan
3. narration claim -> source evidence mapping
4. same source -> Brief / Deep Dive / Critique / Debate
5. important omissions and duplicates

Allowed paths:
- `src/source/**`
- `src/director/**`
- `src/contracts/**`
- `tests/source/**`
- `tests/director/**`

# Worker 2 — Audio Overview

Own:
- AudioTurn compiler
- multi-speaker dialogue generation
- Gemini TTS provider adapter
- open TTS provider adapter
- timing
- mixing/mastering
- audio artifact
- audio QA

Target:
- two stable hosts
- natural turn-taking
- cross-source connections
- examples
- source-grounded explanations
- non-robotic pacing

Measure:
- speaker consistency
- naturalness
- factual support
- pronunciation
- pauses
- clipping
- duration
- provider cost
- generation latency

Allowed paths:
- `src/audio/**`
- `src/providers/audio/**`
- `tests/audio/**`

# Worker 3 — Video Overview + Composition

Own:
- VideoScene compiler
- StyleBible
- visual generation adapters
- SVG/diagram renderer
- image-generation adapter
- optional video-generation adapter
- Remotion composition
- final MP4
- video QA

Target first: narrated illustrated Explainer.

Reference visual language:
- hand-drawn/ink treatment
- coherent palette
- technical diagrams
- visual metaphors
- recurring motifs
- deliberate motion
- scene timing coupled to narration

Do not require full video diffusion for every scene.

Allowed paths:
- `src/video/**`
- `src/providers/visual/**`
- `src/providers/video/**`
- `src/compositor/**`
- `tests/video/**`

# Concurrency

Worker 1 freezes SourceArtifact, ClaimRecord, OverviewPlan and the evaluation protocol.

Then Workers 2 and 3 work concurrently against fixed fixture OverviewPlans.

```text
                 Worker 1
           Source + Director
              /         \
             /           \
         Worker 2      Worker 3
          Audio          Video
             \           /
              \         /
                TL #2
                  |
             Integration
                  |
               QA / Lab
```

# Reverse-engineering experiments

## LAB-01 — Messy source normalization
Use a redacted version of the supplied source. Verify concepts, themes, entities, important facts and secret exclusion.

## LAB-02 — Audio overview
Generate Deep Dive, Brief, Critique and Debate. Verify that mode changes editorial structure, not merely the opening sentence.

## LAB-03 — Explainer video
Generate 5–8 minutes from the same source. Require coherent narrative, visual storytelling, diagrams for structure, metaphor illustrations for abstractions, synchronized narration and coherent style.

## LAB-04 — Reference reconstruction
Annotate the supplied MP4 by scene boundaries, visual type, narrative purpose, approximate duration, motion, recurring motifs and transitions. Do not copy exact assets.

## LAB-05 — Ablation
Compare A: one-shot prompt -> video; B: graph -> script -> generated images -> compositor; C: graph -> director -> storyboard -> generation -> compositor -> evaluator. Determine which stages materially improve output.

## LAB-06 — Self-refinement
Generate v1, identify weak units, regenerate only defective units and compare v1/v2.

# Required text-source adapter

Public article/Substack:

```text
URL
 -> fetch
 -> canonicalize
 -> article extraction
 -> SourceArtifact
```

Preserve canonical URL, title, author, publication date, extracted text and provenance.

Paywalled/private content requires an authorized connector or user-provided content.

# Quality gates

Grounding: every substantive narration statement maps to source evidence.

Visual grounding: exact numbers and labels come from structured data, not hallucinated image text.

Visual consistency: style, palette, line language, recurring motifs, typography and diagram language.

Audio: identity consistency, intelligibility, turn-taking, pronunciation, clipping and pacing.

Temporal: scene duration matches narration; visual changes support spoken points; transitions do not interrupt meaning.

Artifact: MP4/audio decodes, seeks, plays end-to-end, exposes correct duration and preserves provenance.

# Production promotion boundary

This repository is a lab. Do not directly modify `payswapdotorg/WebFlix`.

Final TL #2 output is a production promotion handoff with contracts, proven pipeline, model/provider matrix, benchmark evidence, example artifacts, cost/latency, failure modes and integration plan.

# Security

The original source contained credential-like values. Never store them here. Use the redacted fixture. Rotate exposed credentials separately.

# Final success criterion

The lab succeeds only if it can reliably transform messy authorized text into genuinely useful Audio and Video Overviews through a reproducible, provider-neutral compilation pipeline.

The objective is to reproduce the editorial intelligence + visual storytelling + voice performance + composition loop that makes the reference result compelling.