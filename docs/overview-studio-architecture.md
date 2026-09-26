# Overview Studio — Frozen Lab Architecture

## Core abstraction

Overview generation is a compiler.

```text
Source -> Normalize -> Understand -> Plan -> Generate -> Compose -> Evaluate -> Publish
```

## Intermediate representation

```text
SourceArtifact
  +-- ClaimRecord[]
  +-- EntityRecord[]
  +-- TopicRecord[]
  +-- RelationshipRecord[]
          |
          v
      OverviewPlan
        +-- AudioTurn[]
        +-- VideoScene[]
```

## Director

The Overview Director owns editorial decisions only:
- what to include
- ordering
- emphasis
- omissions
- audience level
- duration
- scene/turn objectives

It does not generate speech, images or MP4.

## Audio compiler

```text
OverviewPlan -> DialogueGraph -> AudioTurn[] -> Speech Provider -> aligned audio -> mastering
```

## Video compiler

```text
OverviewPlan -> VideoScene[] -> visual asset jobs -> validated assets -> Remotion timeline -> MP4
```

## Visual strategy

Use deterministic rendering for diagrams, exact labels, numbers, relationships and source quotes.

Use generative visual models for illustration, metaphor, atmosphere and non-critical visual texture.

Use video generation only where actual motion adds explanatory value.

## StyleBible

A StyleBible defines:
- palette
- line language
- texture
- lighting
- camera/motion
- recurring motifs
- typography
- diagram language

Every scene references the same StyleBible.

## Evaluation

QA takes source claims, narration, scene labels, rendered frames, final audio and final video metadata.

QA emits typed issues and identifies the smallest regenerable unit.

## Regeneration

```text
bad scene -> regenerate scene -> re-QA scene -> recompose
```

Avoid whole-artifact regeneration for local defects.

## Provider independence

Model Fabric/provider adapters handle:
- reasoning
- TTS
- image generation
- video generation
- visual QA

Provider-specific request/response structures remain inside adapters.

## Text-source extension

All authorized text sources produce SourceArtifact:
- pasted text
- TXT
- Markdown
- public article
- Substack
- RSS/newsletter
- PDF text
- EPUB
- future authorized private sources

Source adapters preserve provenance and authorization state.

## Security

Secrets are never copied to fixtures, prompts, artifacts, logs or git history.

Paywalled/private content is processed only through authorized paths.