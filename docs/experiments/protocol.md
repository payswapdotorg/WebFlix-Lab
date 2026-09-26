# Black-Box Reverse-Engineering Protocol

## Objective

Infer the observable editorial, audio, visual and temporal rules of Gemini Notebook Overviews without attempting to access private implementation details.

## Evidence hierarchy

1. Real product UI observation
2. Downloaded reference artifacts
3. Official/public documentation
4. Controlled reproduction
5. Hypothesis

Do not reverse this order.

## Experiment record

Each experiment records:

~~~yaml
id:
timestamp_utc:
operator:
surface: audio | video
reference_notebook:
source_fingerprint:
selected_sources:
format:
language:
length:
visual_style:
custom_prompt:
other_config:
baseline_artifact:
mutation:
artifact_under_test:
artifact_hash:
observations:
invariants:
differences:
hypothesis:
confidence: low | medium | high
falsifier:
next_experiment:
~~~

## One-variable rule

Change one major input at a time.

Allowed mutations:
- source text
- source ordering
- source selection
- one claim
- one entity
- one requested duration
- one output mode
- language
- visual style
- custom prompt

When two variables must change together, mark the experiment as multi-variable and explain why.

## Differential analysis

For audio compare:
- turn count
- speaker count
- speaker identity
- turn ordering
- claim coverage
- examples
- host questions/interjections
- pauses
- speaking rate
- pronunciation
- loudness
- total duration

For video compare:
- scene count
- scene duration
- scene ordering
- narration coverage
- visual type distribution
- exact labels
- diagrams vs illustration
- recurring motifs
- composition
- transitions
- camera motion
- total duration

## Falsification mindset

For every hypothesis ask:
“What result would prove this hypothesis wrong?”

Example:
Hypothesis: custom instructions primarily affect tone/style, not source coverage.
Falsifier: a style-only prompt reliably changes which source claims appear.

## Artifact handling

Downloaded reference artifacts remain immutable.

Never overwrite a golden artifact.

Use a new artifact id for every new generation.

Store SHA-256 and generation metadata alongside the artifact.

## Acceptance of observations

A statement becomes REPRODUCED only when the lab implementation demonstrates the behavior with a reproducible test or artifact.

A statement stays HYPOTHESIS when it is only inferred from appearance.

## Browser evidence

When using agent-browser:
- capture the initial page
- capture relevant settings
- capture generated result state
- capture result/download UI
- refresh snapshots after navigation
- store screenshots with timestamps

Do not store screenshots containing private personal data.

## Stopping rule

Do not keep adding experiments that answer the same question. Mark each hypothesis supported, weakened, falsified, or unresolved and move to the next information-rich question.
