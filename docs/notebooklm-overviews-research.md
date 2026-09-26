# NotebookLM / Gemini Notebook Overviews — Reverse-Engineering Research

Date: 2026-09-26

## Executive finding

The strongest explanation for the observed quality is not one giant prompt. It is an editorial compilation pipeline:

raw sources -> normalize -> source-grounded understanding -> topic/claim/relationship map -> narrative plan -> script -> visual storyboard -> asset generation -> speech generation -> timeline composition -> QA/refinement -> artifact.

Google publicly describes early Video Overviews as narrated slides that create new visuals and combine generated visuals with images, diagrams, quotes and numbers from source material. Later updates added Nano Banana contextual illustrations and Brief. The 2026 Cinematic pipeline combines Gemini 3, Nano Banana Pro and Veo 3 and describes Gemini as a creative director making many structural/style decisions and refining consistency.

Sources:
- https://blog.google/innovation-and-ai/models-and-research/google-labs/notebooklm-video-overviews-studio-upgrades/
- https://blog.google/innovation-and-ai/models-and-research/google-labs/video-overviews-nano-banana/
- https://blog.google/innovation-and-ai/products/notebooklm/generate-your-own-cinematic-video-overviews-in-notebooklm/
- https://support.google.com/gemininotebook/answer/16454555

## Audio Overview

Current Gemini Notebook documents four formats: Deep Dive, Brief, Critique and Debate. Users can choose language, length and a custom prompt. Audio generation is asynchronous, downloadable and shareable; interactive mode can let a user join the hosts.

Google has also publicly stated that Gemini native audio/TTS supports expressive multi-speaker output specifically including NotebookLM-style two-person overviews.

Sources:
- https://support.google.com/gemininotebook/answer/16212820
- https://blog.google/innovation-and-ai/products/notebooklm-audio-overviews/
- https://blog.google/innovation-and-ai/models-and-research/google-deepmind/gemini-2-5-native-audio/
- https://ai.google.dev/gemini-api/docs/speech-generation

## Video Overview

Current Gemini Notebook documents Cinematic, Explainer and Short formats, plus language, visual styles and custom instructions.

The user's supplied reference MP4 is approximately 6m56s, 1280x720, 30fps, mono AAC. Visual inspection shows a highly coherent hand-drawn technical/illustrative language with recurring motifs, diagrams, generated code/technical visuals, visual metaphors and deliberate scene pacing.

That artifact strongly resembles the narrated-illustration / Explainer family rather than an all-Veo cinematic sequence. Therefore the lab should reproduce Explainer first.

## Reverse-engineered behavior hypothesis

### 1. Source normalization

Messy text is converted into a structured source representation:
- source blocks
- headings
- entities
- claims
- relationships
- examples
- quantities
- provenance
- content hash

### 2. Semantic synthesis

The system likely builds a concept/claim graph so related ideas from different parts of the input can be synthesized together instead of summarized paragraph-by-paragraph.

### 3. Overview Director

Create a first-class editor/creative-director stage. It decides:
- what matters
- ordering
- grouping
- omissions
- emphasis
- target audience
- duration
- scene types
- visual metaphors
- where exact diagrams are needed

This is the most important architectural hypothesis to test.

### 4. Grounded script

Generate narration from the editorial plan, not raw chunks. Every segment retains supporting source blocks/claims and a target duration.

### 5. Visual storyboard

Each narrative segment becomes a typed scene containing purpose, duration, narration reference, visual type, source facts, exact labels, visual prompt, style reference, motion and transition.

### 6. Hybrid visual generation

Use deterministic rendering for exact diagrams, labels and numbers. Use generative images for illustration and metaphor. Use video generation only where actual motion adds explanatory value.

This is likely the best route to reproducing the supplied artifact efficiently and reliably.

### 7. Multi-speaker audio

Build a real dialogue plan, for example:
Host A -> framing/question
Host B -> explanation/example
Host A -> connection/clarification
Host B -> synthesis/conclusion

Do not alternate independent TTS calls without a dialogue representation.

### 8. Temporal composition

Compose speech and visuals on one timeline. Remotion is a strong fit because it renders real MP4 and supports programmatic timelines and audio.

Source: https://www.remotion.dev/

### 9. Evaluation/refinement

Evaluate grounding, source coverage, visual label accuracy, style consistency, pacing, pronunciation, audio defects and render integrity. Regenerate the smallest failed unit rather than the entire artifact.

## Why this unlocks Substack and other text sources

Gemini Notebook currently supports pasted text and web URLs. For web URLs, Google documents that the text content is imported while embedded images/videos are not, and paywalled pages are unsupported.

Source: https://support.google.com/gemininotebook/answer/16215270

Therefore WebFlix should add a first-class text/article source adapter:
public Substack/article URL -> fetch -> canonical metadata -> article extraction -> SourceArtifact -> Overview Director

Never bypass paywalls, login, CAPTCHA or access controls.

## Candidate technology stack

Editorial reasoning: Model Fabric routing across Gemini, Qwen and other long-context models.

Audio: Gemini multi-speaker TTS as a reference provider; Chatterbox as an open/local evaluation path. Chatterbox Multilingual is currently MIT and supports multilingual TTS/voice conditioning.

Source: https://huggingface.co/ResembleAI/chatterbox

Images: Nano Banana/equivalent closed provider plus FLUX.1 Schnell for open-weight experimentation and deterministic SVG/diagram rendering. Black Forest Labs lists FLUX.1 Schnell as Apache-2.0.

Source: https://github.com/black-forest-labs/flux

Motion: Veo for provider experiments; Wan2.2 and LTX-2 for open-weight experiments.

Sources:
- https://huggingface.co/Wan-AI/Wan2.2-Animate-14B
- https://huggingface.co/docs/diffusers/api/pipelines/ltx2

Composition: Remotion.

## Architectural conclusion

Do not build a monolithic NotebookLM clone.

Build a reusable Overview Compiler:

Source -> Understand -> Plan -> Script/Storyboard -> Generate -> Compose -> Evaluate -> Publish

This can later power Audio Overview, Video Overview, visual articles, narrated briefings, podcasts, clips and course lessons.

## Security

The original user source contained credential-like secrets. Do not store them, pass them to models, or place them in fixtures. Use a redacted fixture and rotate exposed credentials.