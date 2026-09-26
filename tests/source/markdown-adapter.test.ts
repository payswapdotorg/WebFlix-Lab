/**
 * MarkdownNoteAdapter tests: byte-parity with the Stage-1 canonical fixture
 * (the freeze's adapter-parity guarantee), title derivation, error paths.
 */

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import {
  MarkdownNoteAdapter,
  MARKDOWN_NOTE_ADAPTER_ID,
} from '../../src/source/markdown-note-adapter';
import { CredentialShapeError } from '../../src/source/normalize';
import { AdapterError } from '../../src/source/adapter';
import { validateSourceArtifact, type SourceArtifact } from '../../src/contracts';

const RAW = readFileSync('fixtures/reference-messy-note-redacted.md', 'utf8');
const FIXTURE = JSON.parse(
  readFileSync('fixtures/contracts/reference-messy-note.source-artifact.json', 'utf8'),
) as SourceArtifact;

async function ingestMessy(): Promise<SourceArtifact> {
  return new MarkdownNoteAdapter().ingest({
    id: 'source-messy-note-redacted',
    label: 'fixtures/reference-messy-note-redacted.md',
    content: RAW,
    createdAt: '2026-09-26T00:00:00Z',
  });
}

describe('MarkdownNoteAdapter', () => {
  test('reproduces the canonical fixture byte-identically (parse semantics)', async () => {
    const artifact = await ingestMessy();
    expect(artifact.text).toBe(FIXTURE.text);
    expect(artifact.blocks).toEqual(FIXTURE.blocks);
    expect(artifact.fingerprint).toEqual(FIXTURE.fingerprint);
    expect(artifact.wordCount).toBe(FIXTURE.wordCount);
    expect(artifact.blocks.length).toBe(41);
  });

  test('derives title from the H1 heading and records provenance', async () => {
    const artifact = await ingestMessy();
    expect(artifact.title).toBe('Reference Fixture — Redacted Messy Note');
    expect(artifact.provenance.kind).toBe('markdown-note');
    expect(artifact.provenance.label).toBe('fixtures/reference-messy-note-redacted.md');
    expect(artifact.normalizer).toBe(MARKDOWN_NOTE_ADAPTER_ID);
  });

  test('output passes deep validation', async () => {
    const artifact = await ingestMessy();
    const result = validateSourceArtifact(artifact);
    expect(result.valid).toBe(true);
  });

  test('rejects empty content', async () => {
    await expect(
      new MarkdownNoteAdapter().ingest({ id: 's', label: 'x.md', content: '' }),
    ).rejects.toThrow(AdapterError);
  });

  test('refuses credential-shaped content (runtime-assembled secret)', async () => {
    const token = ['ghp_', 'Qq11Ww22Ee33Rr44Tt55Yy66'].join('');
    const poisoned = `# Note\n\nuses ${token} for deploys\n`;
    await expect(
      new MarkdownNoteAdapter().ingest({ id: 's', label: 'poisoned.md', content: poisoned }),
    ).rejects.toThrow(CredentialShapeError);
  });

  test('allows reviewed credential-shaped content when explicitly permitted', async () => {
    const token = ['ghp_', 'Qq11Ww22Ee33Rr44Tt55Yy66'].join('');
    const reviewed = `# Note\n\nuses ${token} for deploys\n`;
    const artifact = await new MarkdownNoteAdapter().ingest({
      id: 's',
      label: 'reviewed.md',
      content: reviewed,
      allowCredentialShapes: true,
    });
    expect(artifact.blocks.length).toBe(2); // heading + paragraph
    expect(artifact.text).toContain(token);
  });
});
