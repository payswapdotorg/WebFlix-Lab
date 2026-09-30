/**
 * Primitive contract tests: regexes, evidence-label helpers, contract version
 * and small cross-field behaviors.
 */

import { describe, expect, test } from 'bun:test';
import {
  CONTRACTS_VERSION,
  countWords,
  hasEvidenceLabel,
  EvidenceSpanSchema,
  sha256Hex,
  SourceBlockSchema,
} from '../../src/contracts';

describe('primitive schemas', () => {
  // v2 contract wave (ruling 2026-09-29): the bundle bumped 1.0.0 -> 2.0.0
  // (one breaking wave: C-5/C-7/C-9/C-3). Re-pinned here, dated; the v1
  // value is preserved as git history.
  test('contract version is frozen at 2.0.0', () => {
    expect(CONTRACTS_VERSION).toBe('2.0.0');
  });

  test('sha256Hex produces lowercase hex digests', () => {
    expect(sha256Hex('webflix')).toMatch(/^[0-9a-f]{64}$/);
  });

  test('countWords splits on whitespace', () => {
    expect(countWords('Alpha tools need scheduled audits.')).toBe(5);
    expect(countWords('  spaced\tout\nwords  ')).toBe(3);
    expect(countWords('')).toBe(0);
  });

  test('EvidenceSpan rejects end <= start', () => {
    const base = {
      sourceId: 'source-minimal',
      blockId: 'b1',
      start: 0,
      end: 5,
      quote: 'Alpha',
    };
    expect(EvidenceSpanSchema.safeParse(base).success).toBe(true);
    expect(EvidenceSpanSchema.safeParse({ ...base, end: 0 }).success).toBe(false);
    expect(EvidenceSpanSchema.safeParse({ ...base, end: -1 }).success).toBe(false);
  });

  test('SourceBlock enforces heading level rules', () => {
    const heading = {
      id: 'b1',
      kind: 'heading',
      text: '# Title',
      start: 0,
      end: 7,
      level: 1,
    };
    expect(SourceBlockSchema.safeParse(heading).success).toBe(true);
    expect(SourceBlockSchema.safeParse({ ...heading, level: undefined }).success).toBe(false);
    const paragraph = {
      id: 'b2',
      kind: 'paragraph',
      text: 'Body.',
      start: 8,
      end: 13,
    };
    expect(SourceBlockSchema.safeParse(paragraph).success).toBe(true);
    expect(SourceBlockSchema.safeParse({ ...paragraph, level: 2 }).success).toBe(false);
  });
});

describe('evidence labels (AGENTS.md discipline)', () => {
  test('labels are detected in observation strings', () => {
    expect(hasEvidenceLabel('Golden reference pinned by SHA-256 (DOCUMENTED).')).toBe(true);
    expect(hasEvidenceLabel('OBSERVED: two fetches were byte-identical.')).toBe(true);
    expect(hasEvidenceLabel('REPRODUCED via deterministic test.')).toBe(true);
    expect(hasEvidenceLabel('The pipeline probably works.')).toBe(false);
    expect(hasEvidenceLabel('undocumented behavior')).toBe(false);
  });
});
