/**
 * Grounding red/green tests (DESIGN.md §3.2, §16.2 item 6).
 *
 * GREEN: the canonical plan validates at the audio boundary.
 * RED: one-rule mutants must fail with the exact stable issue codes — at the
 * engine layer and through the full compiler. Fixture-only success is not
 * product-parity evidence.
 */

import { describe, expect, test } from 'bun:test';
import {
  buildDialogueGraph,
  buildValidatedDialogueGraph,
  validateDialogueGraph,
} from '../../src/audio/dialogue/engine';
import { AudioCompilerError } from '../../src/audio/errors';
import { compileAudioOverview } from '../../src/audio';
import {
  CANONICAL_GRAPH,
  CANONICAL_PLAN,
  CANONICAL_SOURCE,
  CLAIMS_BY_ID,
  FIXED_NOW,
  FIXED_SEED,
  mutantCoverageGap,
  mutantDanglingClaimRef,
  mutantDebateRebuttalRestatement,
  mutantUngroundedFactualTurn,
} from './fixtures';

describe('grounding — green', () => {
  test('canonical plan passes the W2 boundary validation', () => {
    const graph = buildValidatedDialogueGraph({
      plan: CANONICAL_PLAN,
      graph: CANONICAL_GRAPH,
      seed: FIXED_SEED,
    });
    expect(graph.turns.length).toBe(22);
  });

  test('groundedness metric reports zero violations on the canonical compile', async () => {
    const result = await compileAudioOverview({
      plan: CANONICAL_PLAN,
      graph: CANONICAL_GRAPH,
      sources: CANONICAL_SOURCE,
      options: { seed: FIXED_SEED, now: FIXED_NOW, mastering: 'pure-ts' },
    });
    const groundedness = result.qa.metrics.find((m) => m.metric === 'groundedness');
    expect(groundedness?.value).toContain('violations: 0');
    expect(result.qa.issues.filter((i) => i.code === 'unknown-claim-ref')).toEqual([]);
  }, 60000);
});

describe('grounding — red (engine layer)', () => {
  test('dangling claim id -> unknown-claim-ref', () => {
    const mutant = mutantDanglingClaimRef();
    const graph = buildDialogueGraph({ plan: mutant, graph: CANONICAL_GRAPH, seed: FIXED_SEED });
    const issues = validateDialogueGraph(graph, CLAIMS_BY_ID);
    expect(issues.some((issue) => issue.code === 'unknown-claim-ref')).toBe(true);
    expect(issues.some((issue) => issue.turnId === 'turn-4')).toBe(true);
  });

  test('factual turn with zero claims -> ungrounded-factual-turn', () => {
    const mutant = mutantUngroundedFactualTurn();
    expect(() =>
      buildValidatedDialogueGraph({ plan: mutant, graph: CANONICAL_GRAPH, seed: FIXED_SEED }),
    ).toThrow(AudioCompilerError);
  });

  test('debate rebuttal restating its position -> rebuttal-restatement', () => {
    const mutant = mutantDebateRebuttalRestatement();
    try {
      buildValidatedDialogueGraph({ plan: mutant, graph: CANONICAL_GRAPH, seed: FIXED_SEED });
      expect.unreachable('rebuttal restatement must fail validation');
    } catch (error) {
      expect(error).toBeInstanceOf(AudioCompilerError);
      const typed = error as AudioCompilerError;
      expect(typed.code).toBe('dialogue-validation-failed');
      expect(typed.issues.some((issue) => issue.code === 'rebuttal-restatement')).toBe(true);
      expect(typed.issues.some((issue) => issue.turnId === 'd-turn-4')).toBe(true);
    }
  });
});

describe('grounding — red (full compiler)', () => {
  test('dangling claim id fails the W1 deep validation layer first (defense in depth)', async () => {
    const mutant = mutantDanglingClaimRef();
    try {
      await compileAudioOverview({
        plan: mutant,
        graph: CANONICAL_GRAPH,
        sources: CANONICAL_SOURCE,
        options: { seed: FIXED_SEED, now: FIXED_NOW, mastering: 'pure-ts' },
      });
      expect.unreachable('dangling claim ref must fail compilation');
    } catch (error) {
      expect(error).toBeInstanceOf(AudioCompilerError);
      expect((error as AudioCompilerError).code).toBe('invalid-plan');
    }
  });

  test('ungrounded factual turn fails at the W2 dialogue boundary', async () => {
    const mutant = mutantUngroundedFactualTurn();
    try {
      await compileAudioOverview({
        plan: mutant,
        graph: CANONICAL_GRAPH,
        sources: CANONICAL_SOURCE,
        options: { seed: FIXED_SEED, now: FIXED_NOW, mastering: 'pure-ts' },
      });
      expect.unreachable('ungrounded factual turn must fail compilation');
    } catch (error) {
      expect(error).toBeInstanceOf(AudioCompilerError);
      const typed = error as AudioCompilerError;
      expect(typed.code).toBe('dialogue-validation-failed');
      expect(typed.issues.some((issue) => issue.code === 'ungrounded-factual-turn')).toBe(true);
    }
  });

  test('coverage gap (covered claim grounded by no turn) -> QA error, not a throw', async () => {
    const mutant = mutantCoverageGap();
    const result = await compileAudioOverview({
      plan: mutant,
      graph: CANONICAL_GRAPH,
      sources: CANONICAL_SOURCE,
      options: { seed: FIXED_SEED, now: FIXED_NOW, mastering: 'pure-ts' },
    });
    expect(result.qa.status).toBe('failed');
    const gap = result.qa.issues.find((issue) => issue.code === 'coverage-gap');
    expect(gap).toBeDefined();
    expect(gap?.message).toContain('claim-forecasting-projects');
  }, 60000);
});
