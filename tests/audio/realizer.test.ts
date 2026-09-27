/**
 * Realizer tests: seeded deterministic surface realization, grounding of
 * every factual turn, word-budget fitting, conversational tissue, mode
 * register, language behavior (H-A-06 lab predicates).
 *
 * Lab structural guarantees only — NOT product-parity evidence.
 */

import { describe, expect, test } from 'bun:test';
import { countWords } from '../../src/contracts';
import { buildDialogueGraph } from '../../src/audio/dialogue/engine';
import { realizeDialogue, attachText } from '../../src/audio/dialogue/text/realizer';
import type { RealizerContext } from '../../src/audio/dialogue/text/realizer';
import { modeProfileFor } from '../../src/audio/modes';
import { PACING_MULTIPLIERS } from '../../src/audio/modes/common';
import { languagePackFor } from '../../src/audio/modes/language-packs';
import { compileAudioOverview } from '../../src/audio';
import { AudioTurnSchema } from '../../src/contracts';
import {
  buildBriefStandinPlan,
  buildCritiqueStandinPlan,
  buildDebateStandinPlan,
  buildShortBenchmarkPlan,
  CANONICAL_GRAPH,
  CANONICAL_PLAN,
  CANONICAL_SOURCE,
  CLAIMS_BY_ID,
  FIXED_NOW,
  FIXED_SEED,
  FIXED_SEED_ALT,
} from './fixtures';

function contextFor(plan: typeof CANONICAL_PLAN, seed = FIXED_SEED): RealizerContext {
  const profile = modeProfileFor(plan.mode as Parameters<typeof modeProfileFor>[0]);
  const language = languagePackFor(plan.language);
  const pacing = PACING_MULTIPLIERS[plan.style.pacing ?? 'measured'] ?? 1.0;
  return {
    plan,
    graph: buildDialogueGraph({ plan, graph: CANONICAL_GRAPH, seed }),
    claimIndex: CLAIMS_BY_ID,
    beatIndex: new Map(plan.beats.map((beat) => [beat.id, beat])),
    profile,
    rate: profile.rate.wordsPerSecond * pacing,
    languageId: language.id,
    languageFallback: language.fallback,
  };
}

describe('realizer — canonical deep dive', () => {
  const ctx = contextFor(CANONICAL_PLAN);
  const realized = realizeDialogue(ctx);

  test('every turn gets non-empty text', () => {
    expect(realized.length).toBe(22);
    for (const turn of realized) {
      expect(turn.text.trim().length).toBeGreaterThan(0);
    }
  });

  test('every grounded turn voices its cited claim statement (anchors never drop)', () => {
    for (let i = 0; i < ctx.graph.turns.length; i += 1) {
      const turn = ctx.graph.turns[i];
      const outcome = realized[i];
      expect(turn).toBeDefined();
      expect(outcome).toBeDefined();
      if (turn === undefined || outcome === undefined || turn.claimIds.length === 0) continue;
      // At least one cited claim's statement appears in the realized text
      // (statements may be embedded lowercase mid-sentence).
      const voiced = turn.claimIds.some((claimId) => {
        const claim = CLAIMS_BY_ID.get(claimId);
        if (claim === undefined) return false;
        const fragment = claim.statement.replace(/\s+/g, ' ').trim().slice(0, 24).toLowerCase();
        return outcome.text.toLowerCase().includes(fragment);
      });
      expect(voiced).toBe(true);
    }
  });

  test('word counts fit the mode rate ceiling (no over-budget, no velocity hack — H-A-05)', () => {
    for (const turn of realized) {
      expect(turn.overBudget).toBe(false);
      expect(turn.wordCount).toBeLessThanOrEqual(turn.maxWords);
    }
  });

  test('question turns realize as actual questions (conversational tissue, §16.2 item 4)', () => {
    const questions = ctx.graph.turns.filter((turn) => turn.purpose === 'question');
    expect(questions.length).toBe(3);
    for (const question of questions) {
      const outcome = realized.find((r) => r.turnId === question.id);
      expect(outcome?.text.endsWith('?')).toBe(true);
    }
  });

  test('deterministic: same seed realizes identical text', () => {
    const again = realizeDialogue(contextFor(CANONICAL_PLAN));
    expect(realized.map((r) => r.text)).toEqual(again.map((r) => r.text));
  });

  test('different seed changes surface text but not structure', () => {
    const alt = realizeDialogue(contextFor(CANONICAL_PLAN, FIXED_SEED_ALT));
    const sameTexts = realized.filter((r, i) => r.text === alt[i]?.text).length;
    expect(sameTexts).toBeLessThan(realized.length);
  });

  test('attachText yields contract-valid AudioTurns', () => {
    const turns = attachText(CANONICAL_PLAN, realized);
    for (const turn of turns) {
      const guard = AudioTurnSchema.safeParse(turn);
      expect(guard.success).toBe(true);
    }
  });
});

describe('realizer — mode registers (H-A-01/02/03 lab predicates)', () => {
  test('brief: compact headline register (H-A-01)', async () => {
    const plan = buildBriefStandinPlan();
    const result = await compileAudioOverview({
      plan,
      graph: CANONICAL_GRAPH,
      sources: CANONICAL_SOURCE,
      options: { seed: FIXED_SEED, now: FIXED_NOW, mastering: 'pure-ts' },
    });
    expect(result.qa.status).not.toBe('failed');
    // Brief statements open in the compact register.
    const statementTexts = result.realized.filter((r) => {
      const turn = result.graph.turns.find((t) => t.id === r.turnId);
      return turn?.purpose === 'explanation';
    });
    expect(statementTexts.length).toBeGreaterThan(0);
    const briefOpeners = ['In short:', 'The headline:', 'Core point:', 'Simply put:'];
    const compact = statementTexts.filter((r) =>
      briefOpeners.some((opener) => r.text.includes(opener)),
    );
    expect(compact.length).toBeGreaterThan(0);
  }, 30000);

  test('critique: evaluative register + verdict closing (H-A-02)', async () => {
    const plan = buildCritiqueStandinPlan();
    const result = await compileAudioOverview({
      plan,
      graph: CANONICAL_GRAPH,
      sources: CANONICAL_SOURCE,
      options: { seed: FIXED_SEED, now: FIXED_NOW, mastering: 'pure-ts' },
    });
    // Verdict-tagged closings realize in verdict register.
    const verdictTurns = result.graph.turns.filter((turn) => turn.enrichedTag === 'verdict');
    expect(verdictTurns.length).toBeGreaterThanOrEqual(2);
    const verdictMarkers = ['verdict', 'weighing', 'weigh', 'balance'];
    for (const turn of verdictTurns) {
      const outcome = result.realized.find((r) => r.turnId === turn.id);
      const hit = verdictMarkers.some((marker) => outcome?.text.toLowerCase().includes(marker));
      expect(hit).toBe(true);
    }
    // Assessment turns exist and are absent from a deep-dive realization.
    const critiqueTags = new Set(result.graph.turns.map((turn) => turn.enrichedTag));
    expect(critiqueTags.has('assessment')).toBe(true);
    expect(critiqueTags.has('limitation')).toBe(true);
    const deepDiveTags = new Set(
      buildDialogueGraph({ plan: CANONICAL_PLAN, graph: CANONICAL_GRAPH, seed: FIXED_SEED }).turns.map(
        (turn) => turn.enrichedTag,
      ),
    );
    expect(deepDiveTags.has('assessment')).toBe(false);
    expect(deepDiveTags.has('limitation')).toBe(false);
  }, 30000);

  test('debate: adversarial register with grounded positions (H-A-03)', async () => {
    const plan = buildDebateStandinPlan();
    const result = await compileAudioOverview({
      plan,
      graph: CANONICAL_GRAPH,
      sources: CANONICAL_SOURCE,
      options: { seed: FIXED_SEED, now: FIXED_NOW, mastering: 'pure-ts' },
    });
    const tags = new Set(result.graph.turns.map((turn) => turn.enrichedTag));
    expect(tags.has('position_statement')).toBe(true);
    expect(tags.has('rebuttal')).toBe(true);
    expect(tags.has('cross_examination')).toBe(true);
    expect(tags.has('points_of_agreement')).toBe(true);

    // Personas carry opposing stances (HYPOTHESIS-grade derivation).
    const hostA = result.graph.personas.find((p) => p.speakerRole === 'host-a');
    const hostB = result.graph.personas.find((p) => p.speakerRole === 'host-b');
    expect(hostA?.stance).toBe('pro'); // d-turn-3 is the first host-a stance signal
    expect(hostB?.stance).toBe('con'); // d-turn-2 is the first host-b stance signal

    // Rebuttals cite different claims than the positions they answer.
    const byId = new Map(result.graph.turns.map((turn) => [turn.id, turn]));
    for (const turn of result.graph.turns.filter((t) => t.enrichedTag === 'rebuttal')) {
      for (const targetId of turn.links.respondsTo) {
        const target = byId.get(targetId);
        const overlap = turn.claimIds.filter((id) => target?.claimIds.includes(id) ?? false);
        expect(overlap).toEqual([]);
      }
    }

    // Uncontested claims live in agreement (synthesis) turns, not positions.
    const positionTurns = result.graph.turns.filter((t) => t.enrichedTag === 'position_statement');
    for (const position of positionTurns) {
      expect(position.claimIds).not.toContain('claim-audits');
      expect(position.claimIds).not.toContain('claim-provider-integrations');
    }
    const agreement = result.graph.turns.filter((t) => t.enrichedTag === 'points_of_agreement');
    expect(agreement.some((t) => t.claimIds.includes('claim-audits'))).toBe(true);
  }, 30000);
});

describe('realizer — language behavior (H-A-06 lab predicates)', () => {
  function esVariant(): typeof CANONICAL_PLAN {
    const plan = JSON.parse(JSON.stringify(buildShortBenchmarkPlan())) as typeof CANONICAL_PLAN;
    (plan as unknown as { language: string }).language = 'es';
    return plan;
  }

  test('structure invariant, surface localized, anchors honestly not translated', async () => {
    const enPlan = buildShortBenchmarkPlan();
    const esPlan = esVariant();
    const en = await compileAudioOverview({
      plan: enPlan,
      graph: CANONICAL_GRAPH,
      sources: CANONICAL_SOURCE,
      options: { seed: FIXED_SEED, now: FIXED_NOW, mastering: 'pure-ts' },
    });
    const es = await compileAudioOverview({
      plan: esPlan,
      graph: CANONICAL_GRAPH,
      sources: CANONICAL_SOURCE,
      options: { seed: FIXED_SEED, now: FIXED_NOW, mastering: 'pure-ts' },
    });

    // 1. Identical purpose sequence + claim coverage + link structure.
    expect(es.graph.turns.map((t) => t.purpose)).toEqual(en.graph.turns.map((t) => t.purpose));
    expect(es.graph.turns.map((t) => [...t.claimIds])).toEqual(en.graph.turns.map((t) => [...t.claimIds]));
    expect(es.graph.turns.map((t) => [...t.links.respondsTo])).toEqual(
      en.graph.turns.map((t) => [...t.links.respondsTo]),
    );

    // 2. Surface text differs (localized templates).
    const sameText = es.realized.filter((r, i) => r.text === en.realized[i]?.text).length;
    expect(sameText).toBeLessThan(es.realized.length);

    // 3. Honest note: anchors stay in the source language (info issue).
    expect(es.qa.issues.some((issue) => issue.code === 'anchors-not-localized')).toBe(true);
    expect(en.qa.issues.some((issue) => issue.code === 'anchors-not-localized')).toBe(false);

    // 4. Voice profiles switch per language; persona roles persist.
    const esVoice = es.graph.personas.find((p) => p.speakerRole === 'host-a')?.voice.voice;
    const enVoice = en.graph.personas.find((p) => p.speakerRole === 'host-a')?.voice.voice;
    expect(esVoice?.endsWith('/es')).toBe(true);
    expect(enVoice?.endsWith('/en')).toBe(true);
  });

  test('unknown language falls back honestly (info issue, never silent)', async () => {
    const plan = JSON.parse(JSON.stringify(buildShortBenchmarkPlan())) as typeof CANONICAL_PLAN;
    (plan as unknown as { language: string }).language = 'pt-BR';
    const result = await compileAudioOverview({
      plan,
      graph: CANONICAL_GRAPH,
      sources: CANONICAL_SOURCE,
      options: { seed: FIXED_SEED, now: FIXED_NOW, mastering: 'pure-ts' },
    });
    expect(result.qa.issues.some((issue) => issue.code === 'language-pack-fallback')).toBe(true);
  });
});

describe('realizer — word budget mechanics', () => {
  test('budget numbers follow the rate model (target, floor, ceiling)', () => {
    const ctx = contextFor(CANONICAL_PLAN);
    const realized = realizeDialogue(ctx);
    const rate = 2.6 * 0.96; // deep-dive × measured pacing
    for (const outcome of realized) {
      const turn = ctx.graph.turns.find((t) => t.id === outcome.turnId);
      expect(turn).toBeDefined();
      if (turn === undefined) continue;
      expect(outcome.budgetWords).toBe(Math.round(rate * turn.targetDurationSeconds));
      expect(outcome.maxWords).toBe(
        Math.max(
          outcome.minWords + 2,
          Math.round(rate * ctx.profile.rate.ceilMultiplier * turn.targetDurationSeconds),
        ),
      );
    }
  });

  test('text word count matches countWords of the text', () => {
    const realized = realizeDialogue(contextFor(CANONICAL_PLAN));
    for (const turn of realized) {
      expect(turn.wordCount).toBe(countWords(turn.text));
    }
  });
});
