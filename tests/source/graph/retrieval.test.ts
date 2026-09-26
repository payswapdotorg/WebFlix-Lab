/**
 * Retrieval API tests over the gold fixture graph.
 */

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { GraphIndex } from '../../../src/source/graph/retrieval';
import type { SemanticGraph, SourceArtifact } from '../../../src/contracts';

const SOURCE = JSON.parse(
  readFileSync('fixtures/contracts/reference-messy-note.source-artifact.json', 'utf8'),
) as SourceArtifact;
const GRAPH = JSON.parse(
  readFileSync('fixtures/contracts/reference-messy-note.semantic-graph.json', 'utf8'),
) as SemanticGraph;
const INDEX = new GraphIndex(GRAPH, [SOURCE]);

describe('GraphIndex', () => {
  test('look up claims, entities, topics', () => {
    expect(INDEX.getClaim('claim-infra-stack')?.statement).toContain('infrastructure notes');
    expect(INDEX.getEntity('entity-postgres')?.name).toBe('Postgres');
    expect(INDEX.getTopic('topic-tool-catalog')?.title).toBe('AI tools, models and repositories');
    expect(INDEX.getClaim('claim-nope')).toBeUndefined();
  });

  test('claims by topic and by entity', () => {
    expect(INDEX.claimsByTopicId('topic-tool-catalog').map((c) => c.id).sort()).toEqual([
      'claim-forecasting-projects',
      'claim-oss-runtimes',
      'claim-tool-catalog',
    ]);
    const byEntity = INDEX.claimsByEntityId('entity-postgres').map((c) => c.id);
    expect(byEntity).toContain('claim-infra-stack');
  });

  test('entities in claim', () => {
    const names = INDEX.entitiesInClaim('claim-infra-stack').map((e) => e.name);
    expect(names).toContain('Cloudflare');
    expect(names).toContain('Neon');
    expect(names).toContain('Redis');
  });

  test('relationships for an entity', () => {
    const rels = INDEX.relationshipsForEntity('entity-postgres').map((r) => r.id);
    expect(rels).toContain('rel-postgres-neon');
  });

  test('verifySpan accepts gold spans and rejects corrupted ones', () => {
    for (const claim of GRAPH.claims) {
      for (const span of claim.evidence) {
        expect(INDEX.verifySpan(span)).toBeNull();
      }
    }
    const base = GRAPH.claims[0]?.evidence[0];
    if (base === undefined) throw new Error('fixture has no evidence spans');
    const corrupted = { ...base, quote: 'tampered quote' };
    expect(INDEX.verifySpan(corrupted)).toContain('quote does not equal');
    const badBlock = { ...base, blockId: 'b999' };
    expect(INDEX.verifySpan(badBlock)).toContain('unknown block');
  });

  test('quoteContext expands around the span', () => {
    const span = INDEX.evidenceForClaim('claim-purpose')[0];
    expect(span).toBeDefined();
    const context = INDEX.quoteContext(span as NonNullable<typeof span>, 40);
    expect(context.length).toBeGreaterThan((span as NonNullable<typeof span>).quote.length);
    expect(context).toContain('Purpose');
  });

  test('searchClaims matches statements and evidence quotes', () => {
    const byStatement = INDEX.searchClaims('mixed catalog').map((c) => c.id);
    expect(byStatement).toContain('claim-tool-catalog');
    const byQuote = INDEX.searchClaims('Postgres/Neon').map((c) => c.id);
    expect(byQuote).toContain('claim-infra-stack');
    expect(INDEX.searchClaims('   ')).toEqual([]);
  });

  test('rankedClaims orders by salience descending with stable ties', () => {
    const ranked = INDEX.rankedClaims();
    expect(ranked[0]?.id).toBe('claim-tool-catalog'); // salience 1.0
    for (let i = 1; i < ranked.length; i += 1) {
      const prev = ranked[i - 1]?.salience ?? 0;
      const curr = ranked[i]?.salience ?? 0;
      expect(curr).toBeLessThanOrEqual(prev);
    }
  });
});
