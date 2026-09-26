# WebFlix-Lab

Research laboratory for reproducing and extending source-to-multimedia synthesis inspired by Gemini Notebook / NotebookLM.

## Mission

Build and benchmark:
- Audio Overview
- Video Overview
- public text/article/Substack ingestion
- source-grounded narrative and visual compilation

## Canonical documents

- `docs/notebooklm-overviews-research.md`
- `docs/tl2-overview-studio-handoff.md`
- `docs/overview-studio-architecture.md`
- `fixtures/reference-messy-note-redacted.md`

## Execution

TL #2 coordinates three concurrent workers:
1. Source Intelligence + Overview Director
2. Audio Overview
3. Video Overview + Composition

Worker 1 freezes shared IR/contracts before Workers 2 and 3 diverge.

## Evidence

The originating task includes a user-supplied reference MP4. Workers must use the artifact itself for visual comparison.

## Repository boundary

This is an isolated R&D lab. Do not directly modify `payswapdotorg/WebFlix` from this repository.

## Security

The original source included credential-like secrets. They are deliberately excluded from fixtures and documentation. Rotate any credentials that may have been exposed.