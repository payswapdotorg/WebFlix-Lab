/**
 * Mode-semantics tests (H-A-01/02/03 lab predicates from
 * tests/audio/mode-semantics.md §2).
 *
 * Post-H-2 (2026-09-27): canonical per-mode plans are Director-emitted
 * fixtures (plan-audio-brief-2min / plan-audio-critique-5min /
 * plan-audio-debate-5min, compiled by compileOverviewPlan with fixed seeds).
 * STRUCTURAL predicates (turn skeletons, purpose distributions, coverage
 * compression, end-to-end validation, speaker pairing) run against those.
 *
 * The keyword-heuristic enriched-tag predicates (assessment/limitation/
 * verdict/position/rebuttal registers) still run against the labeled
 * audio-local stand-ins: those heuristics key on brief trigger words the
 * Director does not emit, so they cannot fire on canonical plans
 * (DESIGN.md §16.4 item 1; feeds the consolidated v2 wave per adjudication
 * H-1). Product-level claims stay HYPOTHESIS until EXP-A black-box runs.
 */

import { describe, expect, test } from 'bun:test';
import { compileAudioOverview } from '../../src/audio';
import { modeProfileFor } from '../../src/audio/modes';
import { buildDialogueGraph } from '../../src/audio/dialogue/engine';
import {
  buildBriefStandinPlan,
  buildCritiqueStandinPlan,
  buildDebateStandinPlan,
  CANONICAL_BRIEF_PLAN,
  CANONICAL_CRITIQUE_PLAN,
  CANONICAL_DEBATE_PLAN,
  CANONICAL_GRAPH,
  CANONICAL_PLAN,
  CANONICAL_SOURCE,
  FIXED_NOW,
  FIXED_SEED,
  FIXED_SEED_ALT,
} from './fixtures';

async function compile(plan: typeof CANONICAL_PLAN) {
  return compileAudioOverview({
    plan,
    graph: CANONICAL_GRAPH,
    sources: CANONICAL_SOURCE,
    options: { seed: FIXED_SEED, now: FIXED_NOW, mastering: 'pure-ts' },
  });
}

describe('H-A-01 — Deep Dive vs Brief (canonical plans)', () => {
  test('canonical brief has no example/connection/question turns; deep dive has all three', () => {
    const briefPurposes = new Set(CANONICAL_BRIEF_PLAN.audioTurns.map((turn) => turn.purpose));
    expect(briefPurposes.has('example')).toBe(false);
    expect(briefPurposes.has('connection')).toBe(false);
    expect(briefPurposes.has('interjection')).toBe(false);
    expect(briefPurposes.has('question')).toBe(false);

    const deepDivePurposes = CANONICAL_PLAN.audioTurns.map((turn) => turn.purpose);
    expect(deepDivePurposes).toContain('example');
    expect(deepDivePurposes).toContain('connection');
    expect(deepDivePurposes).toContain('question');
  });

  test('turn count: deep dive (22) > canonical brief (6, C-10 monologic skeleton) for the same source graph', () => {
    // C-10 (EV-009 LAB-02): the v1 10-turn two-speaker dialog became a
    // 6-turn single-narrator enumerated skeleton — the product's ~120 s ->
    // ~94 s Brief delta is turn-count reduction, not velocity (H-A-05).
    expect(CANONICAL_PLAN.audioTurns.length).toBeGreaterThan(CANONICAL_BRIEF_PLAN.audioTurns.length);
    expect(CANONICAL_BRIEF_PLAN.audioTurns.length).toBe(6);
  });

  test('brief coverage is a salience-ranked subset; dropped claims are reported, never silent', async () => {
    const brief = await compile(CANONICAL_BRIEF_PLAN);
    const covered = new Set(brief.plan.coverage.covered.map((entry) => entry.claimId));
    const deepCovered = new Set(
      CANONICAL_PLAN.coverage.covered.map((entry) => entry.claimId),
    );
    // Brief covered set is a strict subset of the deep-dive covered set.
    expect(deepCovered.size).toBe(11);
    expect(covered.size).toBeLessThan(deepCovered.size);
    for (const claimId of covered) {
      expect(deepCovered.has(claimId)).toBe(true);
    }
    // Dropped claims appear in CoverageMap.omitted WITH reasons.
    expect(brief.plan.coverage.omitted.length).toBe(11 - covered.size);
    for (const omitted of brief.plan.coverage.omitted) {
      expect(omitted.reason.length).toBeGreaterThan(0);
    }
    // And W2's coverage QA re-reports the omission honestly (info surface).
    const coverage = brief.qa.metrics.find((m) => m.metric === 'coverage');
    expect(coverage?.value).toContain('omitted');
    expect(brief.qa.issues.some((issue) => issue.code === 'coverage-gap')).toBe(false);
  }, 30000);

  test('both plans validate end-to-end: every factual turn carries existing claim ids', async () => {
    for (const result of [await compile(CANONICAL_PLAN), await compile(CANONICAL_BRIEF_PLAN)]) {
      expect(result.qa.issues.filter((issue) => issue.code === 'unknown-claim-ref')).toEqual([]);
      expect(result.qa.issues.filter((issue) => issue.code === 'ungrounded-factual-turn')).toEqual([]);
    }
  }, 60000);
});

describe('H-A-02 — Deep Dive vs Critique', () => {
  test('critique coverage is near-full (unlike brief), on the canonical plan', async () => {
    const critique = await compile(CANONICAL_CRITIQUE_PLAN);
    const covered = new Set(critique.plan.coverage.covered.map((entry) => entry.claimId));
    expect(covered.size).toBe(11);
  }, 30000);

  // The enriched-tag predicates below are KEYWORD-HEURISTIC (H-1): they run
  // on the labeled stand-in whose briefs carry the trigger words. On
  // canonical Director plans the heuristics do not fire — that gap is
  // asserted honestly in the QA-expectations describe below.
  test('stand-in critique carries assessment/limitation/verdict tags absent from deep dive', async () => {
    const critique = await compile(buildCritiqueStandinPlan());
    const deepDive = buildDialogueGraph({
      plan: CANONICAL_PLAN,
      graph: CANONICAL_GRAPH,
      seed: FIXED_SEED,
    });
    const critiqueTags = new Set(critique.graph.turns.map((turn) => turn.enrichedTag));
    const deepTags = new Set(deepDive.turns.map((turn) => turn.enrichedTag));
    for (const tag of ['assessment', 'limitation', 'verdict'] as const) {
      expect(critiqueTags.has(tag)).toBe(true);
      expect(deepTags.has(tag)).toBe(false);
    }
  });

  test('limitation turns are grounded: the redaction limitation cites the constraint claim; no invented criticism', async () => {
    const critique = await compile(buildCritiqueStandinPlan());
    const limitations = critique.graph.turns.filter((turn) => turn.enrichedTag === 'limitation');
    expect(limitations.length).toBeGreaterThanOrEqual(2);
    // The credentials limitation cites the plan's constraint claim.
    const redactionLimitation = limitations.find((turn) =>
      turn.claimIds.includes('claim-credentials-redacted'),
    );
    expect(redactionLimitation).toBeDefined();
    const redactionText = critique.realized.find((r) => r.turnId === redactionLimitation?.id);
    expect(redactionText?.text.toLowerCase()).toContain('credentials');
    // Every limitation voices its own anchor (no fabricated facts — an
    // unflagged cluster says "the source does not address X" instead).
    for (const limitation of limitations) {
      const outcome = critique.realized.find((r) => r.turnId === limitation.id);
      const voiced = limitation.claimIds.some((claimId) => {
        const claim = CANONICAL_GRAPH.claims.find((c) => c.id === claimId);
        const fragment = claim?.statement.replace(/\s+/g, ' ').trim().slice(0, 20).toLowerCase();
        return fragment !== undefined && outcome?.text.toLowerCase().includes(fragment);
      });
      expect(voiced).toBe(true);
    }
  }, 30000);
});

describe('H-A-03 — Deep Dive vs Debate (stand-in enriched tags)', () => {
  // The argument-graph predicates are keyword-heuristic on the stand-in
  // (H-1); canonical debate structural differences (speaker-purpose
  // inversion) are asserted in tests/contracts/fixtures.test.ts.
  test('debate stand-in creates an argument graph absent from deep dive', async () => {
    const debate = await compile(buildDebateStandinPlan());
    const deepDive = buildDialogueGraph({
      plan: CANONICAL_PLAN,
      graph: CANONICAL_GRAPH,
      seed: FIXED_SEED,
    });
    const debateTags = new Set(debate.graph.turns.map((turn) => turn.enrichedTag));
    const deepTags = new Set(deepDive.turns.map((turn) => turn.enrichedTag));
    for (const tag of ['position_statement', 'rebuttal', 'cross_examination'] as const) {
      expect(debateTags.has(tag)).toBe(true);
      expect(deepTags.has(tag)).toBe(false);
    }
    // Argument wiring: every rebuttal respondsTo a position.
    const rebuttals = debate.graph.turns.filter((turn) => turn.enrichedTag === 'rebuttal');
    for (const rebuttal of rebuttals) {
      expect(rebuttal.links.respondsTo.length).toBeGreaterThan(0);
    }
  }, 30000);

  test('uncontested claims are never debate positions (no fabricated disagreement)', async () => {
    const debate = await compile(buildDebateStandinPlan());
    const positions = debate.graph.turns.filter(
      (turn) => turn.enrichedTag === 'position_statement',
    );
    // Exactly the two opening positions (the motion statement stays framing).
    expect(positions.length).toBe(2);
    expect(positions.map((p) => p.id).sort()).toEqual(['d-turn-2', 'd-turn-3']);
    for (const position of positions) {
      expect(position.claimIds).not.toContain('claim-audits');
      expect(position.claimIds).not.toContain('claim-provider-integrations');
      expect(position.claimIds).not.toContain('claim-deployment-pipelines');
    }
  }, 30000);

  test('closing is an evidence-weighted synthesis, no artificial winner text', async () => {
    const debate = await compile(buildDebateStandinPlan());
    const closing = debate.graph.turns.filter((turn) => turn.purpose === 'conclusion');
    expect(closing.length).toBe(1);
    const outcome = debate.realized.find((r) => r.turnId === closing[0]?.id);
    expect(outcome?.text.toLowerCase()).not.toContain('winner');
    expect(outcome?.text.toLowerCase()).not.toContain('definitively wins');
  }, 30000);
});

describe('mode-semantics QA expectations', () => {
  test('deep dive compile satisfies its mode expectations (question/example/connection present)', async () => {
    const result = await compile(CANONICAL_PLAN);
    expect(result.qa.issues.some((issue) => issue.code === 'mode-semantics-missing')).toBe(false);
  }, 60000);

  test('critique/debate stand-ins satisfy their keyword-heuristic expectations', async () => {
    for (const plan of [buildCritiqueStandinPlan(), buildDebateStandinPlan()]) {
      const result = await compile(plan);
      expect(result.qa.issues.some((issue) => issue.code === 'mode-semantics-missing')).toBe(false);
    }
  }, 60000);

  test('HONEST GAP (H-1): canonical critique/debate plans flag the keyword heuristics as missing', async () => {
    // The Director emits mode-agnostic briefs (no assess/limitation/verdict/
    // position trigger words), so the HYPOTHESIS-grade enriched-tag heuristics
    // cannot fire on canonical plans and the QA machinery honestly reports
    // mode-semantics-missing. This documents the integration finding that
    // feeds the consolidated v2 contract wave (adjudication H-1): plan-level
    // stance/contestedness signals, not brief keywords.
    for (const plan of [CANONICAL_CRITIQUE_PLAN, CANONICAL_DEBATE_PLAN]) {
      const result = await compile(plan);
      expect(result.qa.issues.some((issue) => issue.code === 'mode-semantics-missing')).toBe(true);
    }
    // The canonical brief (no enriched-tag expectations) stays clean.
    const brief = await compile(CANONICAL_BRIEF_PLAN);
    expect(brief.qa.issues.some((issue) => issue.code === 'mode-semantics-missing')).toBe(false);
  }, 60000);

  test('purpose distributions differ across modes for the same source graph', () => {
    // Honest post-H-2 form: brief is distributionally distinct (compression
    // drops the exploration purposes; C-10 further collapses the skeleton to
    // the monologic framing/explanation×4/conclusion shape); critique and
    // critique-vs-debate share the purpose multiset and differ in the
    // SPEAKER-PURPOSE SIGNATURE (host-a interrogates in critique, host-b in
    // debate) — asserted on the canonical plans; the stand-ins remain
    // distributionally distinct too.
    const dist = (plan: typeof CANONICAL_PLAN): string =>
      [...plan.audioTurns.map((turn) => turn.purpose)].sort().join(',');
    expect(dist(CANONICAL_BRIEF_PLAN)).not.toBe(dist(CANONICAL_PLAN));
    expect(dist(CANONICAL_CRITIQUE_PLAN)).not.toBe(dist(CANONICAL_PLAN));
    expect(dist(CANONICAL_DEBATE_PLAN)).not.toBe(dist(CANONICAL_PLAN));
    expect(dist(CANONICAL_CRITIQUE_PLAN)).toBe(dist(CANONICAL_DEBATE_PLAN)); // same multiset...
    const signature = (plan: typeof CANONICAL_PLAN): string =>
      plan.audioTurns.map((turn) => `${turn.speakerRole}:${turn.purpose}`).join(' ');
    expect(signature(CANONICAL_CRITIQUE_PLAN)).not.toBe(signature(CANONICAL_DEBATE_PLAN)); // ...different pairing
    const standins = new Set([
      dist(buildBriefStandinPlan()),
      dist(buildCritiqueStandinPlan()),
      dist(buildDebateStandinPlan()),
    ]);
    expect(standins.size).toBe(3);
  });
});

describe('C-10 — monologic brief surface (EV-009 LAB-02)', () => {
  /**
   * LAB-02 (OBSERVED): the real Brief is a SINGLE narrator with enumerated
   * structure — First/Second/Finally, 93.92 s single-voice. The predicates
   * below assert the lab reproduction (REPRODUCED at the structure/surface
   * level; fixture-only success is not product parity, AGENTS.md).
   */
  test('enumeration markers are position-based and ordered First/Second/…/Finally — never a seeded pick', async () => {
    const brief = await compile(CANONICAL_BRIEF_PLAN);
    const statementTurns = brief.graph.turns.filter(
      (turn) => turn.enrichedTag === 'explanation',
    );
    expect(statementTurns.length).toBe(4);
    const openers = statementTurns.map((turn) => {
      const outcome = brief.realized.find((r) => r.turnId === turn.id);
      const first = outcome?.text.split(' ')[0];
      return first === undefined ? '' : first;
    });
    // Position among spine turns (4 statement turns): First, Second, Third,
    // Finally — the last spine turn always takes the final marker.
    expect(openers).toEqual(['First,', 'Second,', 'Third,', 'Finally,']);
    // Position-based means SEED-INDEPENDENT: a different seed reproduces the
    // same markers (a seeded pick would reshuffle).
    const alt = await compileAudioOverview({
      plan: CANONICAL_BRIEF_PLAN,
      graph: CANONICAL_GRAPH,
      sources: CANONICAL_SOURCE,
      options: { seed: FIXED_SEED_ALT, now: FIXED_NOW, mastering: 'pure-ts' },
    });
    const altOpeners = statementTurns.map((turn) => {
      const outcome = alt.realized.find((r) => r.turnId === turn.id);
      return outcome?.text.split(' ')[0] ?? '';
    });
    expect(altOpeners).toEqual(openers);
  }, 30000);

  test('narrator sign-on / sign-off; dialogic surfaces absent from the realized text', async () => {
    const brief = await compile(CANONICAL_BRIEF_PLAN);
    const first = brief.realized[0]?.text ?? '';
    const last = brief.realized[brief.realized.length - 1]?.text ?? '';
    expect(first.startsWith('Here is the brief:')).toBe(true);
    expect(last.endsWith('That is the brief.')).toBe(true);
    // No question tails, no acknowledgements, no conversational prefixes:
    // the narrator asks nothing and acknowledges no co-host.
    for (const outcome of brief.realized) {
      expect(outcome.text.includes('?')).toBe(false);
      expect(outcome.text.startsWith('Right —')).toBe(false);
      expect(outcome.text.startsWith('And —')).toBe(false);
      expect(outcome.text.startsWith('Plus —')).toBe(false);
    }
    // The profile declares the surfaces empty (C-10 removal, not a seed gap).
    const profile = modeProfileFor('brief');
    expect(profile.surfaceOverlay.questionTails).toEqual([]);
    expect(profile.surfaceOverlay.acknowledgePrefixes).toEqual([]);
    expect(profile.monologic).toBe(true);
  }, 30000);

  test('monologic QA: no dialogic turn-taking warnings; discouraged dialogic purposes flagged when present', async () => {
    // Canonical monologic brief: the H-A-04 dialogic predicates (parity,
    // same-speaker runs, question-answer pairs) do NOT fire — the metric
    // reports the C-10 monologic note instead.
    const brief = await compile(CANONICAL_BRIEF_PLAN);
    for (const code of [
      'parity-out-of-band',
      'same-speaker-run-long',
      'no-question-answer-pair',
      'no-interjection-turns',
    ]) {
      expect(brief.qa.issues.some((issue) => issue.code === code)).toBe(false);
    }
    const turnTaking = brief.qa.metrics.find((m) => m.metric === 'turn_taking_naturalness');
    expect(turnTaking?.value).toContain('monologic mode (C-10');
    // The stand-in brief plan (audio-local, non-canonical) still carries a
    // dialogic question turn — the C-10 QA honestly discourages it.
    const standin = await compile(buildBriefStandinPlan());
    const discouraged = standin.qa.issues.filter((issue) => issue.code === 'mode-semantics-discouraged');
    expect(discouraged.some((issue) => issue.message.startsWith('question turns present'))).toBe(true);
  }, 60000);

  test('beat coverage preserved through the full pipeline (H-A-01 + C-10)', async () => {
    const brief = await compile(CANONICAL_BRIEF_PLAN);
    // Every plan beat is voiced by at least one realized turn.
    const voicedBeats = new Set(
      brief.graph.turns.map((turn) => turn.beatId).filter((id) => id !== undefined),
    );
    for (const beat of brief.plan.beats) {
      expect(voicedBeats.has(beat.id), `beat ${beat.id} voiced by no realized turn`).toBe(true);
    }
    // Realization covers the full turn skeleton (no dropped turns).
    expect(brief.realized.length).toBe(CANONICAL_BRIEF_PLAN.audioTurns.length);
    // Every turn still voices its cited claim statements (grounding held
    // through the restructure).
    for (const turn of brief.graph.turns) {
      const outcome = brief.realized.find((r) => r.turnId === turn.id);
      if (turn.claimIds.length === 0) continue;
      const voiced = turn.claimIds.some((claimId) => {
        const claim = CANONICAL_GRAPH.claims.find((c) => c.id === claimId);
        const fragment = claim?.statement.replace(/\s+/g, ' ').trim().slice(0, 20).toLowerCase();
        return fragment !== undefined && outcome?.text.toLowerCase().includes(fragment);
      });
      expect(voiced, `${turn.id} does not voice its anchors`).toBe(true);
    }
  }, 30000);
});
