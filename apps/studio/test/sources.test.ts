/**
 * WebFlix-Lab Operator Studio (WFLX-UI1) — GET /api/sources contract.
 *
 * The source surface enumerates the checked-in fixtures usable as REAL
 * pipeline sources. The fingerprint must be exactly what the repo computes:
 * the canonical checked-in source-artifact.json parity (enforced repo-wide
 * by tests/source/markdown-adapter.test.ts) is asserted here directly.
 */

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { bootStudio } from './helpers';
import type { SourceArtifact } from '../../../src/contracts';
import type { SourceDescriptor, SourcesResponse } from '../api/types';

const CANONICAL_SOURCE_ARTIFACT: SourceArtifact = JSON.parse(
  readFileSync('fixtures/contracts/reference-messy-note.source-artifact.json', 'utf8'),
) as SourceArtifact;

describe('GET /api/sources', () => {
  test('enumerates the canonical LAB-series fixture with repo-computed fingerprint', async () => {
    const studio = bootStudio();
    try {
      const response = await fetch(`${studio.baseUrl}/api/sources`);
      expect(response.status).toBe(200);
      const body = (await response.json()) as SourcesResponse;

      expect(body.sources.length).toBeGreaterThanOrEqual(1);
      const canonical = body.sources.find((s) => s.id === 'source-messy-note-redacted');
      expect(canonical).toBeDefined();
      const source: SourceDescriptor = canonical as SourceDescriptor;

      // Fingerprint EXACTLY as the repo computes it (checked-in artifact parity).
      expect(source.fingerprint.contentSha256).toBe(CANONICAL_SOURCE_ARTIFACT.fingerprint.contentSha256);
      expect(source.fingerprint.rawSha256).toBe(CANONICAL_SOURCE_ARTIFACT.fingerprint.rawSha256);
      expect(source.fingerprint.textLength).toBe(CANONICAL_SOURCE_ARTIFACT.fingerprint.textLength);
      expect(source.wordCount).toBe(CANONICAL_SOURCE_ARTIFACT.wordCount);

      // Real pipeline identity, honestly labeled.
      expect(source.adapter).toBe('MarkdownNoteAdapter@0.1.0');
      expect(source.extractor).toBe('DeterministicExtractor@0.1.0');
      expect(source.label).toBe('fixtures/reference-messy-note-redacted.md');
    } finally {
      await studio.stop();
    }
  });

  test('labels the surface as the WebFlix-Lab research implementation (not Gemini Notebook)', async () => {
    const studio = bootStudio();
    try {
      const response = await fetch(`${studio.baseUrl}/api/sources`);
      const body = (await response.json()) as SourcesResponse;
      expect(body.surface).toContain('WebFlix-Lab research implementation');
      expect(body.surface).toContain('Not the Gemini Notebook product');
    } finally {
      await studio.stop();
    }
  });

  test('exposes the Director mode surface with the canonical deep-dive default', async () => {
    const studio = bootStudio();
    try {
      const response = await fetch(`${studio.baseUrl}/api/sources`);
      const body = (await response.json()) as SourcesResponse;
      const source = body.sources[0];
      expect(source).toBeDefined();
      const modes = (source as SourceDescriptor).modes.map((m) => m.mode);
      expect(modes).toEqual(['deep-dive', 'brief', 'critique', 'debate']);
      const defaultMode = (source as SourceDescriptor).modes.find((m) => m.default);
      expect(defaultMode?.mode).toBe('deep-dive');
      expect(defaultMode?.canonicalDurationSeconds).toBe(300);
    } finally {
      await studio.stop();
    }
  });
});
