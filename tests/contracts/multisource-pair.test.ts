/**
 * Multi-source BlockIndex pair-keying tests (WFLX-V3A lane 1 — the W1
 * unblock, contract layer).
 *
 * Drives validateSemanticGraph with hand-built two-source artifacts whose
 * block ids COLLIDE (every adapter numbers blocks per source from b1):
 *
 *   1. a span on (sourceB, b2) validates against source B's own b2 even
 *      though source A also defines b2 — pre-fix this failed with
 *      "references unknown block b2 in source source-b" because the index
 *      resolved b2 to source A's block and rejected the pair;
 *   2. a span on (sourceB, b2) placed INSIDE B's b2 but OUTSIDE A's b2
 *      bounds validates — the pair resolves per source, never per blockId;
 *   3. genuinely unknown blocks still fail (the honest negative path);
 *   4. the same two-source graph validates end-to-end (claims, relationships,
 *      entity mentions, topic blockRefs all resolve per pair).
 *
 * Lab reproduction evidence only — NOT product parity evidence (AGENTS.md).
 */

import { describe, expect, test } from 'bun:test';
import {
  CONTRACTS_VERSION,
  SemanticGraphSchema,
  validateSemanticGraph,
  type ClaimRecord,
  type EvidenceSpan,
  type SemanticGraph,
  type SourceArtifact,
} from '../../src/contracts';

const NOW = '2026-09-26T00:00:00Z';

function artifact(id: string, title: string, text: string, blocks: { id: string; start: number; end: number }[]): SourceArtifact {
  return {
    recordType: 'SourceArtifact',
    contractVersion: CONTRACTS_VERSION,
    id,
    title,
    provenance: { kind: 'markdown-note', label: `${id}.md`, authorization: 'user-provided' },
    // Minimal fingerprint fields are not needed by the deep validator; only
    // id/text/blocks participate in graph grounding.
    fingerprint: { contentSha256: '0'.repeat(64), textLength: text.length },
    text,
    blocks: blocks.map((b) => ({
      id: b.id,
      kind: 'paragraph',
      text: text.slice(b.start, b.end),
      start: b.start,
      end: b.end,
    })),
    language: 'en',
    wordCount: 1,
    createdAt: NOW,
    normalizer: 'test',
  } as unknown as SourceArtifact;
}

// Two sources with COLLIDING block ids (b1, b2 in both) and DIFFERENT b2 bounds.
const TEXT_A = 'alpha start\nalpha second block body here';
const TEXT_B = 'beta start\nbeta second block body with different length';
const SOURCE_A = artifact('source-a', 'Doc A', TEXT_A, [
  { id: 'b1', start: 0, end: 11 },
  { id: 'b2', start: 12, end: 37 },
]);
const SOURCE_B = artifact('source-b', 'Doc B', TEXT_B, [
  { id: 'b1', start: 0, end: 10 },
  { id: 'b2', start: 11, end: 46 },
]);

function span(sourceId: string, blockId: string, start: number, end: number, text: string): EvidenceSpan {
  return { sourceId, blockId, start, end, quote: text.slice(start, end) };
}

function claim(id: string, evidence: EvidenceSpan[], topicId: string): ClaimRecord {
  return {
    recordType: 'ClaimRecord',
    contractVersion: CONTRACTS_VERSION,
    id,
    statement: `statement for ${id}`,
    kind: 'fact',
    evidence,
    entityIds: [],
    topicIds: [topicId],
    salience: 0.8,
  };
}

function graph(claims: ClaimRecord[], topicIds: string[]): SemanticGraph {
  return {
    recordType: 'SemanticGraph',
    contractVersion: CONTRACTS_VERSION,
    id: 'graph-pair-test',
    sourceIds: ['source-a', 'source-b'],
    claims,
    entities: [],
    topics: topicIds.map((id) => ({
      recordType: 'TopicRecord',
      contractVersion: CONTRACTS_VERSION,
      id,
      title: id,
      summary: 's',
      keywords: [],
      claimIds: claims.filter((c) => c.topicIds.includes(id)).map((c) => c.id),
      entityIds: [],
      blockRefs: [],
      salience: 0.9,
    })),
    relationships: [],
    extractor: 'DeterministicExtractor@0.1.0',
    createdAt: NOW,
  };
}

describe('BlockIndex pair-keying (multi-source deep validation)', () => {
  test('a span on (source-b, b2) resolves inside source b even though source a also defines b2', () => {
    // Span fully inside B's b2 [11, 46) but OUTSIDE A's b2 [12, 37): under
    // blockId-alone keying the index resolved b2 to A's block and rejected
    // the pair ("references unknown block b2 in source source-b").
    const evidence = span('source-b', 'b2', 30, 40, TEXT_B);
    const g = graph([claim('claim-b-b2', [evidence], 'topic-b')], ['topic-b']);
    expect(SemanticGraphSchema.safeParse(g).success).toBe(true);
    const deep = validateSemanticGraph(g, [SOURCE_A, SOURCE_B]);
    expect(deep.valid).toBe(true);
  });

  test('source a spans still resolve (first source is not shadowed)', () => {
    const evidence = span('source-a', 'b2', 15, 25, TEXT_A);
    const g = graph([claim('claim-a-b2', [evidence], 'topic-a')], ['topic-a']);
    const deep = validateSemanticGraph(g, [SOURCE_A, SOURCE_B]);
    expect(deep.valid).toBe(true);
  });

  test('a two-source graph with colliding block ids validates end-to-end', () => {
    const g = graph(
      [
        claim('claim-a-b1', [span('source-a', 'b1', 0, 11, TEXT_A)], 'topic-a'),
        claim('claim-b-b1', [span('source-b', 'b1', 0, 10, TEXT_B)], 'topic-b'),
        claim('claim-a-b2', [span('source-a', 'b2', 12, 37, TEXT_A)], 'topic-a'),
        claim('claim-b-b2', [span('source-b', 'b2', 11, 46, TEXT_B)], 'topic-b'),
      ],
      ['topic-a', 'topic-b'],
    );
    expect(SemanticGraphSchema.safeParse(g).success).toBe(true);
    const deep = validateSemanticGraph(g, [SOURCE_A, SOURCE_B]);
    expect(deep.valid).toBe(true);
  });

  test('genuinely unknown blocks still fail honestly', () => {
    const evidence = span('source-b', 'b9', 0, 4, TEXT_B);
    const g = graph([claim('claim-b-b9', [evidence], 'topic-b')], ['topic-b']);
    const deep = validateSemanticGraph(g, [SOURCE_A, SOURCE_B]);
    expect(deep.valid).toBe(false);
    expect(deep.issues.some((i) => i.message.includes('references unknown block b9 in source source-b'))).toBe(true);
  });

  test('a span that escapes its OWN source block still fails (bounds law intact)', () => {
    // [0, 20) covers b1+b2 boundary in source b — escapes b1.
    const evidence = span('source-b', 'b1', 0, 20, TEXT_B);
    const g = graph([claim('claim-b-esc', [evidence], 'topic-b')], ['topic-b']);
    const deep = validateSemanticGraph(g, [SOURCE_A, SOURCE_B]);
    expect(deep.valid).toBe(false);
    expect(deep.issues.some((i) => i.message.includes('escapes block b1'))).toBe(true);
  });
});
