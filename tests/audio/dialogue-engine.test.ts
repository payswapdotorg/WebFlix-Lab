/**
 * DialogueGraph engine tests: plan -> graph fidelity, enriched tags, links,
 * sections, personas, planHash binding.
 *
 * Lab structural guarantees only — NOT product-parity evidence (AGENTS.md).
 */

import { describe, expect, test } from 'bun:test';
import {
  buildDialogueGraph,
  planHashOf,
  stableStringify,
  validateDialogueGraph,
} from '../../src/audio/dialogue/engine';
import { ENRICHED_TAG_TO_PURPOSE } from '../../src/audio/dialogue/types';
import { CANONICAL_GRAPH, CANONICAL_PLAN, FIXED_SEED, CLAIMS_BY_ID } from './fixtures';
import type { ClaimIndex } from '../../src/audio/dialogue/types';

const CLAIM_INDEX: ClaimIndex = CLAIMS_BY_ID;

function buildGraph() {
  return buildDialogueGraph({ plan: CANONICAL_PLAN, graph: CANONICAL_GRAPH, seed: FIXED_SEED });
}

describe('buildDialogueGraph', () => {
  test('passes the plan turn skeleton through unchanged (§16.2 item 1)', () => {
    const graph = buildGraph();
    expect(graph.turns.length).toBe(CANONICAL_PLAN.audioTurns.length);
    graph.turns.forEach((turn, i) => {
      const planTurn = CANONICAL_PLAN.audioTurns[i];
      if (planTurn === undefined) throw new Error(`missing plan turn at index ${i}`);
      expect(turn.id).toBe(planTurn.id);
      expect(turn.index).toBe(planTurn.index);
      expect(turn.speakerRole).toBe(planTurn.speakerRole);
      expect(turn.purpose).toBe(planTurn.purpose);
      expect(turn.claimIds).toEqual(planTurn.claimIds);
      expect(turn.beatId).toBe(planTurn.beatId);
      expect(turn.targetDurationSeconds).toBe(planTurn.targetDurationSeconds);
      expect(turn.style).toEqual(planTurn.style);
    });
  });

  test('every enriched tag projects onto the frozen purpose (§16.2 item 5)', () => {
    const graph = buildGraph();
    for (const turn of graph.turns) {
      expect(ENRICHED_TAG_TO_PURPOSE[turn.enrichedTag]).toBe(turn.purpose);
    }
  });

  test('meta binds the graph to the exact plan input', () => {
    const graph = buildGraph();
    expect(graph.meta.planId).toBe(CANONICAL_PLAN.id);
    expect(graph.meta.mode).toBe('deep-dive');
    expect(graph.meta.language).toBe('en');
    expect(graph.meta.targetDurationSeconds).toBe(300);
    expect(graph.meta.seed).toBe(FIXED_SEED);
    // planHash is the sha256 of the canonical JSON serialization.
    expect(graph.meta.planHash).toBe(planHashOf(CANONICAL_PLAN));
  });

  test('planHash is key-order independent (stable stringify)', () => {
    const reordered = JSON.parse(stableStringify(CANONICAL_PLAN)) as typeof CANONICAL_PLAN;
    // Re-serialize with reversed key order at the top level.
    const keys = Object.keys(reordered).reverse();
    const shuffled: Record<string, unknown> = {};
    for (const key of keys) {
      shuffled[key] = (reordered as unknown as Record<string, unknown>)[key];
    }
    expect(planHashOf(shuffled)).toBe(planHashOf(CANONICAL_PLAN));
  });

  test('derives question -> answer respondsTo links', () => {
    const graph = buildGraph();
    const answered = graph.turns.filter((turn) => turn.links.respondsTo.length > 0);
    // The canonical plan has 3 question turns answered by the next speaker.
    expect(answered.length).toBeGreaterThanOrEqual(3);
    const byId = new Map(graph.turns.map((turn) => [turn.id, turn]));
    for (const turn of answered) {
      for (const targetId of turn.links.respondsTo) {
        const target = byId.get(targetId);
        expect(target).toBeDefined();
        expect(target?.purpose).toBe('question');
        expect(target?.speakerRole).not.toBe(turn.speakerRole);
        expect(target?.index).toBeLessThan(turn.index);
      }
    }
  });

  test('sections derive from beats: opening / body / closing', () => {
    const graph = buildGraph();
    const first = graph.turns[0];
    const last = graph.turns[graph.turns.length - 1];
    expect(first?.section.role).toBe('opening');
    expect(first?.section.beatId).toBe('beat-1');
    expect(last?.section.role).toBe('closing');
    expect(last?.section.beatId).toBe('beat-6');
    const middle = graph.turns[5];
    expect(middle?.section.role).toBe('body');
  });

  test('personas: two hosts, lab display names, language-conditioned voices', () => {
    const graph = buildGraph();
    expect(graph.personas.length).toBe(2);
    const hostA = graph.personas.find((p) => p.speakerRole === 'host-a');
    const hostB = graph.personas.find((p) => p.speakerRole === 'host-b');
    expect(hostA?.displayName).toBe('Ava');
    expect(hostB?.displayName).toBe('Ben');
    expect(hostA?.roleBias).toBe('guide');
    expect(hostB?.roleBias).toBe('analyst');
    expect(hostA?.voice.voice.endsWith('/en')).toBe(true);
    expect(hostA?.voice.voice).not.toBe(hostB?.voice.voice);
  });

  test('deterministic: same inputs build an identical graph', () => {
    const a = buildGraph();
    const b = buildDialogueGraph({ plan: CANONICAL_PLAN, graph: CANONICAL_GRAPH, seed: FIXED_SEED });
    expect(stableStringify(a)).toBe(stableStringify(b));
  });

  test('grounding validation is green on the canonical plan', () => {
    const graph = buildGraph();
    const issues = validateDialogueGraph(graph, CLAIM_INDEX);
    expect(issues).toEqual([]);
  });

  test('estimated words follow the rate model (deep-dive 2.6 w/s, measured pacing)', () => {
    const graph = buildGraph();
    const rate = 2.6 * 0.96; // plan.style.pacing === 'measured'
    for (const turn of graph.turns) {
      expect(turn.estimatedWords).toBe(Math.round(rate * turn.targetDurationSeconds));
    }
  });
});
