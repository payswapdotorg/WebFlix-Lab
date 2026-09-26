/**
 * Red/green mutant tests: every mutant is exactly one mutation away from a
 * valid fixture. Structural mutants (m*) must be rejected; guard-only
 * mutants must additionally PASS the JSON Schema (proving the cross-field
 * zod checks carry weight schemas cannot express). Semantic mutants (s*)
 * must pass both guards but fail the deep validators.
 */

import { describe, expect, test } from 'bun:test';
import { readdirSync } from 'node:fs';
import { loadJson, validateWithJsonSchema } from './helpers';
import {
  ExperimentRecordSchema,
  GeneratedArtifactSchema,
  OverviewPlanSchema,
  SemanticGraphSchema,
  SourceArtifactSchema,
  validateOverviewPlan,
  validateSemanticGraph,
  validateSourceArtifact,
  type OverviewPlan,
  type SemanticGraph,
  type SourceArtifact,
} from '../../src/contracts';

const MUTANT_DIR = 'fixtures/contracts/mutants';
const FIXTURE_DIR = 'fixtures/contracts';

/** Mutants that only the zod guard rejects (cross-field rules). */
const GUARD_ONLY = new Set([
  'm09-end-lte-start.json',
  'm11-audio-mode-on-video.json',
  'm15-self-relationship.json',
  'm16-audio-plan-without-turns.json',
  'm17-heading-without-level.json',
  'm18-audio-artifact-without-audio-spec.json',
]);

/** Deep mutants keyed by the validator that must reject them. */
const DEEP_VALIDATOR: Record<string, 'source' | 'graph' | 'plan'> = {
  's01-quote-mismatch.json': 'graph',
  's02-span-outside-block.json': 'graph',
  's03-overlapping-blocks.json': 'source',
  's04-wrong-content-hash.json': 'source',
  's05-bad-word-count.json': 'source',
  's06-beat-weights-not-summing.json': 'plan',
  's07-turn-duration-sum-off.json': 'plan',
  's08-unknown-claim-ref.json': 'plan',
  's09-unaccounted-claims.json': 'plan',
  's10-deterministic-scene-no-exact-text.json': 'plan',
  's11-dangling-block-ref.json': 'graph',
  's12-mention-text-mismatch.json': 'graph',
  's13-dangling-beat-ref.json': 'plan',
  's14-block-slice-mismatch.json': 'source',
};

function guardFor(recordType: string) {
  switch (recordType) {
    case 'SourceArtifact':
      return SourceArtifactSchema;
    case 'SemanticGraph':
      return SemanticGraphSchema;
    case 'OverviewPlan':
      return OverviewPlanSchema;
    case 'GeneratedArtifact':
      return GeneratedArtifactSchema;
    case 'ExperimentRecord':
      return ExperimentRecordSchema;
    default:
      throw new Error(`unexpected mutant recordType ${recordType}`);
  }
}

describe('structural mutants (red)', () => {
  const files = readdirSync(MUTANT_DIR)
    .filter((f) => f.startsWith('m') && f.endsWith('.json'))
    .sort();

  test('the full structural mutant corpus is present', () => {
    expect(files.length).toBe(18);
  });

  for (const file of files) {
    test(`${file} is rejected${GUARD_ONLY.has(file) ? ' by the guard only' : ' by guard and schema'}`, () => {
      const mutant = loadJson(`${MUTANT_DIR}/${file}`) as { recordType: string };
      const guard = guardFor(mutant.recordType);
      expect(guard.safeParse(mutant).success).toBe(false);
      if (GUARD_ONLY.has(file)) {
        // Cross-field rules are NOT expressible in JSON Schema: the schema
        // must still accept the shape, proving the guard adds real checks.
        expect(validateWithJsonSchema(mutant)).toBe(true);
      } else {
        expect(validateWithJsonSchema(mutant)).toBe(false);
      }
    });
  }
});

describe('semantic mutants (deep red)', () => {
  const files = readdirSync(MUTANT_DIR)
    .filter((f) => f.startsWith('s') && f.endsWith('.json'))
    .sort();

  test('the full semantic mutant corpus is present', () => {
    expect(files.length).toBe(14);
  });

  const messySource = loadJson(`${FIXTURE_DIR}/reference-messy-note.source-artifact.json`) as SourceArtifact;
  const minimalSource = loadJson(`${FIXTURE_DIR}/minimal.source-artifact.json`) as SourceArtifact;
  const messyGraph = loadJson(`${FIXTURE_DIR}/reference-messy-note.semantic-graph.json`) as SemanticGraph;

  for (const file of files) {
    test(`${file} passes guards but fails deep validation`, () => {
      const mutant = loadJson(`${MUTANT_DIR}/${file}`) as { recordType: string };
      const guard = guardFor(mutant.recordType);
      expect(guard.safeParse(mutant).success).toBe(true);
      expect(validateWithJsonSchema(mutant)).toBe(true);

      const validator = DEEP_VALIDATOR[file];
      expect(validator).toBeDefined();
      if (validator === 'source') {
        const result = validateSourceArtifact(mutant as unknown as SourceArtifact);
        expect(result.valid).toBe(false);
        expect(result.issues.length).toBeGreaterThan(0);
      } else if (validator === 'graph') {
        const source = (mutant as unknown as SemanticGraph).sourceIds.includes('source-minimal')
          ? minimalSource
          : messySource;
        const result = validateSemanticGraph(mutant as unknown as SemanticGraph, source);
        expect(result.valid).toBe(false);
        expect(result.issues.length).toBeGreaterThan(0);
      } else {
        const result = validateOverviewPlan(mutant as unknown as OverviewPlan, messyGraph, messySource);
        expect(result.valid).toBe(false);
        expect(result.issues.length).toBeGreaterThan(0);
      }
    });
  }
});
