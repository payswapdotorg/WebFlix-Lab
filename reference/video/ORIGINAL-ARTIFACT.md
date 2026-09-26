# Original Reference Video

## Identity

Filename:
Orchestrating_Agentic_Development__Deconstructing_a_Multi-Agent.mp4

SHA-256:
36485eb804de5c69aadf9c0a9d4998dfa85ce4e3ed9a4f502bbd45fc170cdce2

Duration:
415.660408 s

Video:
H.264 1280x720 30fps

Audio:
AAC mono 44.1 kHz

## Repository status

The exact 65 MB binary was fingerprinted during lab bootstrap but is not stored in git because the repository connector available during bootstrap cannot upload large binary content directly.

The lab is independent of the originating chat because:
- the exact artifact identity is frozen by SHA-256
- metadata is frozen
- scene/style observations are checked in
- the import and verification script is checked in
- Git LFS rules are configured for future binary storage

## Import

When a local copy of the original is available:

~~~bash
./scripts/reference/import-and-verify-video.sh /path/to/Orchestrating_Agentic_Development__Deconstructing_a_Multi-Agent.mp4
~~~

When binary storage is desired:

~~~bash
git lfs track "reference/video/*.mp4"
git add reference/video/Orchestrating_Agentic_Development__Deconstructing_a_Multi-Agent.mp4 .gitattributes
git commit -m "reference: add golden Gemini Notebook video artifact"
~~~

Never replace the golden artifact in place after acceptance. New generations receive new artifact ids.
