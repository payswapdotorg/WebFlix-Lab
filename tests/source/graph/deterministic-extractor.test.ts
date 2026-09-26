/**
 * DeterministicExtractor tests: the hand-grounded fixture graph is ground
 * truth. The rule-based extractor is not required to reproduce the curated
 * gold graph exactly (curation is editorial); it must be valid, grounded,
 * deterministic, and must cover the gold entities/topics/relationships.
 */

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { DeterministicExtractor } from '../../../src/source/graph/deterministic-extractor';
import {
  SemanticGraphSchema,
  validateSemanticGraph,
  type SemanticGraph,
  type SourceArtifact,
} from '../../../src/contracts';

const SOURCE = JSON.parse(
  readFileSync('fixtures/contracts/reference-messy-note.source-artifact.json', 'utf8'),
) as SourceArtifact;
const GOLD = JSON.parse(
  readFileSync('fixtures/contracts/reference-messy-note.semantic-graph.json', 'utf8'),
) as SemanticGraph;
const FIXED = { createdAt: '2026-09-26T00:00:00Z' };

async function extract(): Promise<SemanticGraph> {
  return new DeterministicExtractor().extract({ sources: [SOURCE], options: FIXED });
}

describe('DeterministicExtractor', () => {
  test('produces a guard-valid, deep-valid, grounded graph', async () => {
    const graph = await extract();
    expect(SemanticGraphSchema.safeParse(graph).success).toBe(true);
    const deep = validateSemanticGraph(graph, SOURCE);
    expect(deep.valid).toBe(true);
  });

  test('is deterministic (byte-identical output)', async () => {
    const a = await extract();
    const b = await extract();
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  test('creates one topic per section (plus the preamble topic)', async () => {
    const graph = await extract();
    const titles = graph.topics.map((t) => t.title);
    // Gold section titles are all covered (title or containment).
    for (const gold of GOLD.topics) {
      expect(
        titles.some((t) => t === gold.title || gold.title.includes(t) || t.includes(gold.title)),
      ).toBe(true);
    }
    expect(titles).toContain('AI tools, models and repositories');
    expect(titles).toContain('Infrastructure');
    expect(titles).toContain('Architecture and workflows');
    expect(graph.topics.length).toBeGreaterThanOrEqual(4);
  });

  test('covers every gold entity (by name or containment)', async () => {
    const graph = await extract();
    const names = graph.entities.map((e) => e.name);
    for (const goldEntity of GOLD.entities) {
      expect(
        names.some((n) => n === goldEntity.name || goldEntity.name.includes(n) || n.includes(goldEntity.name)),
        `gold entity ${goldEntity.name} not covered`,
      ).toBe(true);
    }
  });

  test('finds the slash-pair relationships (Postgres/Neon, Vercel/GitHub)', async () => {
    const graph = await extract();
    const pairs = new Set(graph.relationships.map((r) => `${r.subjectId}|${r.objectId}`));
    expect(pairs.has('entity-postgres|entity-neon')).toBe(true);
    expect(pairs.has('entity-vercel|entity-github')).toBe(true);
    for (const rel of graph.relationships) {
      const span = rel.evidence[0];
      if (span === undefined) throw new Error('relationship without evidence');
      expect(SOURCE.text.slice(span.start, span.end)).toBe(span.quote);
    }
  });

  test('evidences every list item with a claim', async () => {
    const graph = await extract();
    const listItemBlockIds = new Set(
      SOURCE.blocks.filter((b) => b.kind === 'list-item').map((b) => b.id),
    );
    const evidencedBlockIds = new Set(graph.claims.flatMap((c) => c.evidence.map((e) => e.blockId)));
    for (const blockId of listItemBlockIds) {
      expect(evidencedBlockIds.has(blockId), `list item ${blockId} not evidenced`).toBe(true);
    }
    expect(graph.claims.length).toBeGreaterThanOrEqual(listItemBlockIds.size);
  });

  test('classifies entities via lexicon and suffixes', async () => {
    const graph = await extract();
    const byId = new Map(graph.entities.map((e) => [e.id, e]));
    expect(byId.get('entity-postgres')?.kind).toBe('technology');
    expect(byId.get('entity-neon')?.kind).toBe('service');
    expect(byId.get('entity-cloudflare')?.kind).toBe('infrastructure');
    expect(byId.get('entity-ai-video-tools')?.kind).toBe('tool');
    expect(byId.get('entity-deployment-pipelines')?.kind).toBe('process');
    expect(byId.get('entity-multi-agent-orchestration')?.kind).toBe('workflow');
  });

  test('marks the purpose paragraph as a goal claim and the REDACTED paragraph as a constraint', async () => {
    const graph = await extract();
    const purpose = graph.claims.find((c) => c.statement.startsWith('Test semantic organization'));
    expect(purpose?.kind).toBe('goal');
    expect(purpose?.salience).toBe(0.9);
    const redacted = graph.claims.find((c) => c.statement.includes('[REDACTED]'));
    expect(redacted?.kind).toBe('constraint');
  });

  test('claim salience decays with item position inside a section', async () => {
    const graph = await extract();
    const section1Items = graph.claims.filter(
      (c) => c.topicIds[0] === 'topic-ai-tools-models-and-repositories' && c.statement.includes('list includes'),
    );
    expect(section1Items.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < section1Items.length; i += 1) {
      const prev = section1Items[i - 1]?.salience ?? 1;
      const curr = section1Items[i]?.salience ?? 1;
      expect(curr).toBeLessThanOrEqual(prev);
    }
  });

  test('uses stable, predictable claim ids', async () => {
    const graph = await extract();
    expect(graph.claims[0]?.id).toBe('claim-b2');
    expect(graph.claims.some((c) => c.id === 'claim-b41')).toBe(true);
    expect(graph.extractor).toBe('DeterministicExtractor@0.1.0');
  });
});
