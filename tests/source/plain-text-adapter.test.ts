/**
 * PlainTextAdapter tests: line-based paragraph policy, fixture parity for the
 * minimal fixture, error paths.
 */

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { PlainTextAdapter } from '../../src/source/plain-text-adapter';
import { validateSourceArtifact, type SourceArtifact } from '../../src/contracts';

const MINIMAL_FIXTURE = JSON.parse(
  readFileSync('fixtures/contracts/minimal.source-artifact.json', 'utf8'),
) as SourceArtifact;

describe('PlainTextAdapter', () => {
  test('reproduces the minimal fixture parse semantics', async () => {
    const artifact = await new PlainTextAdapter().ingest({
      id: 'source-minimal',
      label: 'minimal.txt',
      content: 'Alpha tools need scheduled audits.',
      createdAt: '2026-09-26T00:00:00Z',
    });
    expect(artifact.text).toBe(MINIMAL_FIXTURE.text);
    expect(artifact.blocks).toEqual(MINIMAL_FIXTURE.blocks);
    expect(artifact.fingerprint).toEqual(MINIMAL_FIXTURE.fingerprint);
    expect(artifact.wordCount).toBe(5);
    expect(validateSourceArtifact(artifact).valid).toBe(true);
  });

  test('every non-blank line is one paragraph block (lab policy)', async () => {
    const artifact = await new PlainTextAdapter().ingest({
      id: 'source-two',
      label: 'two.txt',
      content: 'Alpha tools need scheduled audits.\nBeta tools ship weekly.',
      createdAt: '2026-09-26T00:00:00Z',
    });
    expect(artifact.blocks.length).toBe(2);
    expect(artifact.blocks.map((b) => b.kind)).toEqual(['paragraph', 'paragraph']);
    expect(artifact.text.slice(artifact.blocks[1]?.start ?? 0, artifact.blocks[1]?.end ?? 0)).toBe(
      'Beta tools ship weekly.',
    );
  });

  test('blank lines are separators, not blocks', async () => {
    const artifact = await new PlainTextAdapter().ingest({
      id: 'source-three',
      label: 'three.txt',
      content: 'first paragraph\n\nsecond paragraph\n\n\nthird',
      createdAt: '2026-09-26T00:00:00Z',
    });
    expect(artifact.blocks.map((b) => b.text)).toEqual([
      'first paragraph',
      'second paragraph',
      'third',
    ]);
  });

  test('rejects empty content', async () => {
    await expect(
      new PlainTextAdapter().ingest({ id: 's', label: 'x.txt', content: '   ' }),
    ).rejects.toThrow();
  });
});
