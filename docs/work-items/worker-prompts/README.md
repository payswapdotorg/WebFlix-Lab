# Worker prompt templates (TL-maintained)

These are the dispatch-time prompt templates for the WebFlix-Lab worker
program. They are PAT-free: `__PAT_PLACEHOLDER__` is substituted by the
resident TL at dispatch time from the sandbox secret store. The
substituted prompt is NEVER committed anywhere.

- `wflx-w2.md` — W2 Stage 2 (audio dialogue compiler implementation,
  per merged DESIGN.md section 16).
- `wflx-w3.md` — W3 Phase 2B (full video surface; golden video is in-repo,
  verification-gated annotation).

Report markers for harvest: `WFLX-W2 COMPLETION REPORT`,
`WFLX-W3 COMPLETION REPORT`.
