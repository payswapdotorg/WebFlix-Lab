# WebFlix-Lab

Research and reconstruction laboratory for source-to-multimedia synthesis inspired by Gemini Notebook / NotebookLM.

## Mission

Reproduce the observable behavior and quality loop of Audio Overview, Video Overview, authorized public text/article/Substack ingestion, and source-grounded narrative plus visual compilation.

This repository is self-contained for TL #2 and three workers. The team should not need the originating chat for mission, architecture, references, access procedure, experiment protocol, work split, or acceptance gates.

## Start here

1. AGENTS.md — immutable lab rules.
2. docs/tl2-overview-studio-handoff.md — canonical takeover.
3. docs/reference/gemini-notebook-access.md — real-product access runbook.
4. docs/reference/reference-artifact-manifest.json — exact reference artifact identity.
5. docs/reference/reference-video-scene-atlas.md — observed visual evidence.
6. docs/experiments/protocol.md — black-box experiment protocol.
7. docs/experiments/matrix.md — initial experiments.
8. docs/work-items/tl2-work-order.md — dependency graph and three-worker scope.

## Canonical rule

The repository is the source of truth.

Do not rely on the originating chat, unverified agent summaries, fixture-only demos, screenshots without provenance, a single generated artifact, or guesses about Google's private implementation.

Classify claims as OBSERVED, DOCUMENTED, HYPOTHESIS, REPRODUCED, or UNRESOLVED.

## Reference environment

Workers should use a dedicated Gemini Notebook containing only authorized material. Human authentication is manual. Credentials, cookies, browser state, and secrets stay outside git.

The exact supplied reference video is fingerprinted in docs/reference/reference-artifact-manifest.json. The binary is not yet in git because the available repository connector cannot upload the 65 MB original directly. The repo therefore freezes its hash, metadata, import procedure, and scene annotations; the operator can import and verify the original and commit it through Git LFS.

## Architecture

~~~text
Source / media
      |
      v
Source Adapter -> SourceArtifact -> Source Intelligence
                                      |
                                      v
                                Overview Director
                                  /           \
                                 v             v
                         Audio Dialogue    Video Storyboard
                                 |             |
                                 v             v
                            Speech Engine   Visual Engine
                                 |             |
                                 +------ + ------+
                                        v
                                  Timeline Composer
                                        |
                                        v
                                     Artifact
                                        |
                                        v
                                  QA / Refinement
                                        |
                                        v
                                     Publish
~~~

The core abstraction is an Overview Compiler, not a monolithic prompt.

## Operator Studio (apps/studio)

Compile an Audio Overview through the real pipeline and play it in the
browser (REPRODUCED-class lab evidence; offline deterministic provider):

```bash
bun run studio    # serves http://localhost:4313 (fixed port)
```

See apps/studio/README.md for the surface, port law, and honest boundaries.

## Team

TL #2 owns shared contracts, reference environment, evidence integrity, integration, and acceptance.

Worker 1 owns source intelligence and the Overview Director.

Worker 2 owns Audio Overview.

Worker 3 owns Video Overview and composition.

Workers 2 and 3 proceed concurrently after Worker 1 freezes the shared contracts.

## Safety and security

Only process content the experiment is authorized to use. Do not bypass paywalls, login barriers, CAPTCHA, DRM, access controls, anti-bot measures, geo restrictions, or rate limits. Do not attempt to extract private Google prompts or private endpoints.

Credential-like values from the originating source are intentionally excluded. Never copy or commit them.
