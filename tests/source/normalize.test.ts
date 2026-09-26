/**
 * Normalization + credential-scan tests (WFLX-W1, Stage 2).
 *
 * Credential hygiene: any secret-shaped fixture content is ASSEMBLED AT
 * RUNTIME from fragments so no complete credential-shaped string ever
 * appears in source (W1 hard rule).
 */

import { describe, expect, test } from 'bun:test';
import {
  countWords,
  CredentialShapeError,
  fingerprintOf,
  normalizeText,
  scanForCredentialShapes,
} from '../../src/source/normalize';

describe('normalizeText', () => {
  test('NFC-normalizes combining characters', () => {
    expect(normalizeText('e\u0301')).toBe('\u00e9');
  });

  test('canonicalizes newlines', () => {
    expect(normalizeText('a\r\nb\rc\nd')).toBe('a\nb\nc\nd');
  });

  test('strips line-trailing whitespace and the final newline', () => {
    expect(normalizeText('alpha  \nbeta\t\n')).toBe('alpha\nbeta');
  });

  test('matches the Stage-1 fixture builder semantics', () => {
    const raw = '# Cafe\u0301\r\n\r\n- item \r\n';
    expect(normalizeText(raw)).toBe('# Caf\u00e9\n\n- item');
  });
});

describe('fingerprintOf', () => {
  test('hashes raw and normalized content independently', () => {
    const raw = 'line\r\n';
    const normalizedText = normalizeText(raw);
    const fp = fingerprintOf({ raw, normalizedText });
    expect(fp.contentSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(fp.rawSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(fp.contentSha256).not.toBe(fp.rawSha256);
    expect(fp.textLength).toBe(normalizedText.length);
  });
});

describe('scanForCredentialShapes', () => {
  test('detects runtime-assembled token shapes without echoing them', () => {
    // Assembled at runtime from fragments; the full shape never appears in source.
    const githubToken = ['ghp_', 'Ab01Cd23Ef45Gh67Ij89'].join('');
    const openAiKey = ['sk-', 'zy0987654321zy0987654321zy0'].join('');
    const text = `config uses ${githubToken} and ${openAiKey} for auth`;
    const findings = scanForCredentialShapes(text);
    const names = findings.map((f) => f.pattern);
    expect(names).toContain('github-token');
    expect(names).toContain('openai-style-key');
    // Findings must not carry the matched text (secret-free reporting).
    for (const finding of findings) {
      expect(Object.keys(finding).sort()).toEqual(['end', 'length', 'pattern', 'start']);
      expect('text' in finding).toBe(false);
      expect('excerpt' in finding).toBe(false);
      expect('value' in finding).toBe(false);
    }
  });

  test('detects private key blocks and AWS key ids', () => {
    const keyBlock = ['-----BEGIN', ' RSA PRIVATE KEY-----'].join('');
    const awsKey = ['AKIA', 'ABCDEFGHIJKLMNOP'].join('');
    const findings = scanForCredentialShapes(`${keyBlock}\n${awsKey}`);
    expect(findings.map((f) => f.pattern).sort()).toEqual(['aws-access-key', 'private-key-block']);
  });

  test('clean text and legit hex hashes produce no findings', () => {
    const sha = '36485eb804de5c69aadf9c0a9d4998dfa85ce4e3ed9a4f502bbd45fc170cdce2';
    expect(scanForCredentialShapes(`the sha256 is ${sha} (DOCUMENTED).`)).toEqual([]);
    expect(scanForCredentialShapes('All credentials are `[REDACTED]`.')).toEqual([]);
  });

  test('CredentialShapeError reports pattern names only', () => {
    const token = ['ghp_', 'Zz99Yy88Xx77Ww66Vv55Uu44'].join('');
    const findings = scanForCredentialShapes(token);
    const error = new CredentialShapeError(findings);
    expect(error.message).toContain('github-token');
    expect(error.message).not.toContain(token);
  });
});

describe('countWords', () => {
  test('whitespace-delimited', () => {
    expect(countWords('one two  three\tfour\nfive')).toBe(5);
  });
});
