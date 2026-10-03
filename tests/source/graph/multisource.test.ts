/**
 * Multi-source extraction tests (WFLX-V3A lane 1 — the W1 unblock).
 *
 * The W1 defect: BlockIndex keyed blocks by blockId ALONE while every
 * adapter numbers block ids per source from b1, so two-source ingestion
 * threw "produced an inconsistent graph" (REPRODUCED pre-fix at the station
 * and on this branch's baseline). These tests pin the fixed laws:
 *
 *   1. the exact work-order reproduction (raw fixture split at the
 *      Section 2 marker, ingested as source-note-a / source-note-b)
 *      extracts a guard-valid, deep-valid graph;
 *   2. per-source namespacing of claim ids AND topic ids (same-titled
 *      sections across sources produce distinct topic ids);
 *   3. entities stay GLOBAL (shared entities, merged mentions) — the
 *      intentional design, not a defect;
 *   4. graph.sourceIds is complete for multi-source extraction;
 *   5. the single-source fingerprint path is BYTE-IDENTICAL to the
 *      pre-fix baseline (snapshot generated on the pristine main tree
 *      before the fix landed — tests/source/graph/single-source-baseline.snapshot.json).
 *
 * Lab reproduction evidence only — NOT product parity evidence (AGENTS.md).
 */

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { MarkdownNoteAdapter } from '../../../src/source/markdown-note-adapter';
import { DeterministicExtractor } from '../../../src/source/graph/deterministic-extractor';
import {
  SemanticGraphSchema,
  validateSemanticGraph,
  type SemanticGraph,
  type SourceArtifact,
} from '../../../src/contracts';
import { stableStringify } from '../../../src/audio';

/** The runner's fixed stamp (tools/experiments/runner-types.ts EXP_NOW). */
const EXP_NOW = '2026-09-30T00:00:00Z';
const RAW_NOTE = readFileSync('fixtures/reference-messy-note-redacted.md', 'utf8');
const SPLIT_MARKER = '## Section 2 — Infrastructure';

const adapter = new MarkdownNoteAdapter();
const extractor = new DeterministicExtractor();

async function ingestPair(): Promise<SourceArtifact[]> {
  const idx = RAW_NOTE.indexOf(SPLIT_MARKER);
  expect(idx).toBeGreaterThan(0);
  const parts = [
    { id: 'source-note-a', content: RAW_NOTE.slice(0, idx) },
    { id: 'source-note-b', content: RAW_NOTE.slice(idx) },
  ];
  return Promise.all(
    parts.map((part) =>
      adapter.ingest({
        id: part.id,
        label: `${part.id}.md`,
        createdAt: EXP_NOW,
        content: part.content,
      }),
    ),
  );
}

async function extractPair(order: 'ab' | 'ba'): Promise<SemanticGraph> {
  const sources = await ingestPair();
  return extractor.extract({
    sources: order === 'ab' ? sources : [sources[1] as SourceArtifact, sources[0] as SourceArtifact],
    options: { createdAt: EXP_NOW },
  });
}

describe('multi-source extraction (the W1 unblock)', () => {
  test('the exact work-order reproduction now extracts a consistent graph', async () => {
    const graph = await extractPair('ab');
    // Guard-valid (referential integrity + id uniqueness included)...
    expect(SemanticGraphSchema.safeParse(graph).success).toBe(true);
    // ...and deep-valid (every evidence span resolves per (sourceId, blockId)
    // pair against the real source texts). This is the call that threw
    // "produced an inconsistent graph" before the BlockIndex pair-keying fix.
    const deep = validateSemanticGraph(graph, await ingestPair());
    expect(deep.valid).toBe(true);
  });

  test('block-id collisions resolve per (sourceId, blockId) pair — source B claims evidence in source B', async () => {
    const graph = await extractPair('ab');
    const bClaims = graph.claims.filter((c) => c.id.startsWith('claim-source-note-b-'));
    expect(bClaims.length).toBeGreaterThan(0);
    for (const claim of bClaims) {
      for (const span of claim.evidence) {
        expect(span.sourceId).toBe('source-note-b');
        // source-note-b numbers its own blocks b1..bn; the pair key must
        // resolve them inside source-note-b (pre-fix: "references unknown
        // block bN in source source-note-b").
        expect(span.blockId).toMatch(/^b\d+$/);
      }
    }
    // Source-note-a evidence still resolves in source-note-a.
    const aClaims = graph.claims.filter((c) => c.id.startsWith('claim-source-note-a-'));
    expect(aClaims.length).toBeGreaterThan(0);
    for (const claim of aClaims) {
      for (const span of claim.evidence) expect(span.sourceId).toBe('source-note-a');
    }
  });

  test('graph.sourceIds is complete for multi-source extraction', async () => {
    const graph = await extractPair('ab');
    expect(graph.sourceIds).toEqual(['source-note-a', 'source-note-b']);
    const ba = await extractPair('ba');
    expect(ba.sourceIds).toEqual(['source-note-b', 'source-note-a']);
  });

  test('topic ids are namespaced per source (distinct ids, no guard collision)', async () => {
    const graph = await extractPair('ab');
    const topicIds = graph.topics.map((t) => t.id);
    expect(new Set(topicIds).size).toBe(topicIds.length); // uniqueness law
    expect(topicIds).toContain('topic-source-note-a-ai-tools-models-and-repositories');
    expect(topicIds).toContain('topic-source-note-b-infrastructure');
    expect(topicIds).toContain('topic-source-note-b-architecture-and-workflows');
    // No unprefixed multi-source topic id survives.
    expect(topicIds.some((id) => /^topic-(?!source-note-)/.test(id))).toBe(false);
  });

  test('same-titled sections across two sources produce DISTINCT topic ids', async () => {
    const content = (title: string): string =>
      `# Doc\n\n## ${title}\n\nShared-named section with one list:\n- alpha widgets\n- beta gadgets\n`;
    const sources = await Promise.all(
      ['source-one', 'source-two'].map((id) =>
        adapter.ingest({ id, label: `${id}.md`, createdAt: EXP_NOW, content: content('Shared Title') }),
      ),
    );
    const graph = await extractor.extract({ sources, options: { createdAt: EXP_NOW } });
    expect(SemanticGraphSchema.safeParse(graph).success).toBe(true);
    const topicIds = graph.topics.map((t) => t.id);
    expect(topicIds).toContain('topic-source-one-shared-title');
    expect(topicIds).toContain('topic-source-two-shared-title');
    expect(new Set(topicIds).size).toBe(topicIds.length);
    // Single-source control: the same document extracted alone keeps the
    // unprefixed id (the namespacing is conditional, like claim ids).
    const single = await extractor.extract({
      sources: [sources[0] as SourceArtifact],
      options: { createdAt: EXP_NOW },
    });
    expect(single.topics.map((t) => t.id)).toContain('topic-shared-title');
  });

  test('entities stay GLOBAL across sources (one shared record per id) — intentional', async () => {
    const contentA = '# A\n\n## S\n\n- LLM providers\n- Redis\n';
    const contentB = '# B\n\n## T\n\n- LLM providers\n- Postgres/Neon\n';
    const sources = await Promise.all([
      adapter.ingest({ id: 'src-a', label: 'a.md', createdAt: EXP_NOW, content: contentA }),
      adapter.ingest({ id: 'src-b', label: 'b.md', createdAt: EXP_NOW, content: contentB }),
    ]);
    const graph = await extractor.extract({ sources, options: { createdAt: EXP_NOW } });
    const llm = graph.entities.filter((e) => e.id === 'entity-llm-providers');
    // One GLOBAL record for the shared surface — the intentional design.
    expect(llm.length).toBe(1);
    // OBSERVED (2026-10-03): the cross-source mention set is LAST-PROCESSED-
    // SOURCE-WINS (addEntity merges only within a section-local map; the
    // global entityMap.set replaces the record). The work order calls merged
    // mentions intentional and forbids touching the entity surface, so this
    // test pins the ACTUAL behavior — every present mention verifies, none is
    // fabricated — and the divergence from the work order's description is
    // reported for TL review, not silently "fixed".
    for (const mention of llm[0]?.mentions ?? []) {
      expect(['src-a', 'src-b']).toContain(mention.sourceId);
    }
    // Entity ids are NOT namespaced per source.
    expect(graph.entities.some((e) => e.id.startsWith('entity-src-'))).toBe(false);
    // Relationship ids derive from the global entity ids (fine as-is).
    expect(graph.relationships.some((r) => r.id === 'rel-entity-postgres-entity-neon')).toBe(true);
  });

  test('two-source extraction is deterministic (byte-identical double run)', async () => {
    const a = await extractPair('ab');
    const b = await extractPair('ab');
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    const ba1 = await extractPair('ba');
    const ba2 = await extractPair('ba');
    expect(JSON.stringify(ba1)).toBe(JSON.stringify(ba2));
  });

  test('single-source extraction is BYTE-IDENTICAL to the pre-fix baseline snapshot', async () => {
    // The snapshot was generated on the PRISTINE main tree (before any fix
    // commit): the multi-source fixes must not perturb the single-source
    // fingerprint path. The chain mirrors buildFreshChain exactly.
    const source = await adapter.ingest({
      id: 'source-messy-note-redacted',
      label: 'fixtures/reference-messy-note-redacted.md',
      createdAt: EXP_NOW,
      content: RAW_NOTE,
    });
    const graph = await extractor.extract({ sources: [source], options: { createdAt: EXP_NOW } });
    const snapshot = readFileSync(
      'tests/source/graph/single-source-baseline.snapshot.json',
      'utf8',
    );
    expect(`${stableStringify(graph)}\n`).toBe(snapshot);
  });
});
