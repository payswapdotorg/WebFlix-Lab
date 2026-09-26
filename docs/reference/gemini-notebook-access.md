# Gemini Notebook Reference Access Runbook

## Purpose

Make direct access to the real Gemini Notebook experience part of the lab rather than a dependency on the originating chat.

The real product is treated as a black-box oracle. Workers record observable behavior; they do not attempt to inspect private internals.

## Security boundary

Do not provide workers with:
- Google passwords
- recovery codes
- session cookies
- OAuth tokens
- browser profile archives
- API keys

Authentication happens interactively by the human operator.

Never commit authentication state.

## Preferred setup: dedicated reference notebook

Create a dedicated Gemini Notebook for the experiment and load only source material that you are authorized to use.

Recommended contents:
- the canonical messy source fixture
- the source used to make the reference artifact, if authorized
- a small set of controlled mutation sources
- no unrelated private documents

Record the notebook URL in a local environment file outside git:

~~~text
GEMINI_REFERENCE_NOTEBOOK_URL=https://...
GEMINI_REFERENCE_SESSION=gemini-reference
~~~

## Browser session setup

When agent-browser is available:

~~~bash
agent-browser --session gemini-reference --headed open https://notebooklm.google.com/
agent-browser --session gemini-reference wait --load networkidle
~~~

Complete Google login manually in the headed browser.

Navigate to the reference notebook and verify:
- the expected sources are present
- the expected artifacts are present
- no unrelated personal data is exposed

Workers can reuse the same named session:

~~~bash
agent-browser --session gemini-reference open "$GEMINI_REFERENCE_NOTEBOOK_URL"
agent-browser --session gemini-reference wait --load networkidle
agent-browser --session gemini-reference snapshot -i
~~~

Always take a fresh snapshot after navigation or DOM changes.

## Alternative: official sharing

When the coding environment cannot share a browser session, use Gemini Notebook's official sharing mechanisms.

Grant the minimum required access.

Treat shared notebook contents as accessible to the workers. Do not place sensitive personal data in the reference notebook.

## Artifact capture protocol

For every reference generation record:
- notebook/source identity
- selected sources
- format
- language
- length
- visual style
- custom prompt/instructions
- generation timestamp
- artifact title/id if visible
- download/export filename
- SHA-256 of downloaded artifact
- screenshots of important UI states
- notes about generation timing

Never claim UI behavior was observed if only the downloaded artifact was inspected.

## Audio experiments

1. establish a baseline
2. record mode/settings
3. inspect generated audio
4. download it
5. fingerprint it
6. repeat with one controlled mutation
7. compare transcript, turn structure, timing and speaker behavior

## Video experiments

1. establish an Explainer baseline
2. download the original output
3. fingerprint it
4. annotate scenes
5. repeat with one controlled mutation
6. compare scene count, narration, visuals, ordering, style and duration

Test format, language, style, custom-instruction, duration and source mutations independently.

## What workers should infer

Workers may infer:
- input/output relationships
- editorial invariants
- temporal invariants
- prompt sensitivity
- source-selection behavior
- visual asset classes
- regeneration locality

Workers must not infer private implementation details merely because an output looks consistent with them.

Use:
“Observed: X. Hypothesis: Y. Confidence: medium.”
not:
“Google internally does Y.”

## Evidence retention

Save observations under:
- docs/experiments
- reference
- artifacts

Do not commit private notebook content unless explicitly authorized for repository storage.

## Failure handling

If the notebook UI changes:
- capture the new UI state
- record the change as an observation
- update the runbook only after confirming the behavior
- do not silently rewrite historical experiment results

If browser automation is unavailable, perform the same experiments manually and record the exact observation in the experiment log.
