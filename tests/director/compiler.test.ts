/**
 * Overview Director tests: deterministic compilation, budget-driven
 * coverage (compression/expansion), mode semantics, custom-instruction
 * invariance, seed behavior, and the end-to-end offline pipeline
 * (adapter -> extractor -> director -> evaluator).
 *
 * These are lab-reproduction tests (fixture graph as ground truth); they are
 * NOT product-parity evidence (AGENTS.md).
 */

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import {
  compileOverviewPlan,
  DEFAULT_SECONDS_PER_CLAIM,
  TURN_PLANNING_RATE_WPS,
  type DirectorRequest,
} from '../../src/director/compiler';
import { evaluateCoverage } from '../../src/director/evaluate';
import { MarkdownNoteAdapter } from '../../src/source/markdown-note-adapter';
import { DeterministicExtractor } from '../../src/source/graph/deterministic-extractor';
import {
  countWords,
  OverviewPlanSchema,
  validateOverviewPlan,
  type AudioTurn,
  type AudioTurnPurpose,
  type OverviewPlan,
  type SemanticGraph,
  type SourceArtifact,
} from '../../src/contracts';

/**
 * Purposes the audio grounding rule (W2, src/audio/dialogue/types.ts
 * ZERO_CLAIM_ALLOWED_PURPOSES) treats as factual carriers: such turns MUST
 * cite >= 1 claim. Structural purposes may be claim-less topical tissue.
 * Documented mirror, not an import (path ownership).
 */
const FACTUAL_TURN_PURPOSES: ReadonlySet<AudioTurnPurpose> = new Set([
  'explanation',
  'example',
  'connection',
  'clarification',
]);

/** Anchor-mass model mirroring the Director's allocation priors. */
const QUESTION_TAIL_TOKENS = 8;
const ANCHOR_CONNECTOR_TOKENS = 5;

function mandatoryMass(turn: AudioTurn, graph: SemanticGraph): number {
  const claimsById = new Map(graph.claims.map((c) => [c.id, c]));
  const anchorTokens = turn.claimIds.reduce(
    (acc, claimId, i) =>
      acc + countWords(claimsById.get(claimId)?.statement ?? '') + (i > 0 ? ANCHOR_CONNECTOR_TOKENS : 0),
    0,
  );
  return anchorTokens + (turn.purpose === 'question' ? QUESTION_TAIL_TOKENS : 0);
}

const SOURCE = JSON.parse(
  readFileSync('fixtures/contracts/reference-messy-note.source-artifact.json', 'utf8'),
) as SourceArtifact;
const GRAPH = JSON.parse(
  readFileSync('fixtures/contracts/reference-messy-note.semantic-graph.json', 'utf8'),
) as SemanticGraph;
const NOW = '2026-09-26T00:00:00Z';

function baseRequest(overrides: Partial<DirectorRequest> = {}): DirectorRequest {
  return {
    sources: [SOURCE],
    graph: GRAPH,
    modality: 'audio',
    targetDurationSeconds: 300,
    seed: 'seed-a',
    now: NOW,
    ...overrides,
  };
}

describe('compileOverviewPlan — validity and determinism', () => {
  test('audio deep-dive at 300s covers the full fixture graph', () => {
    const plan = compileOverviewPlan(baseRequest());
    expect(OverviewPlanSchema.safeParse(plan).success).toBe(true);
    expect(validateOverviewPlan(plan, GRAPH, SOURCE).valid).toBe(true);
    expect(plan.mode).toBe('deep-dive');
    expect(plan.beats.length).toBe(6); // opening + 4 topics + closing
    // EV-005 fix: the skeleton is anchor-mass-aware, so the single-claim
    // "Purpose of the note" beat keeps 3 of its 4 pattern slots (two factual
    // carriers cannot share one claim): 2 + 4 + 4 + 4 + 3 + 3.
    expect(plan.audioTurns.length).toBe(20);
    expect(plan.videoScenes).toEqual([]);
    const durationSum = plan.audioTurns.reduce((acc, t) => acc + t.targetDurationSeconds, 0);
    expect(durationSum).toBe(300);
    const weightSum = plan.beats.reduce((acc, b) => acc + b.weight, 0);
    expect(Math.abs(weightSum - 1)).toBeLessThanOrEqual(0.005);
    const evaluation = evaluateCoverage(plan, GRAPH, SOURCE);
    expect(evaluation.coveragePercent).toBe(100);
    expect(evaluation.grounded).toBe(true);
  });

  test('video explainer at 420s compiles a valid scene plan', () => {
    const plan = compileOverviewPlan(
      baseRequest({ modality: 'video', mode: 'explainer', targetDurationSeconds: 420 }),
    );
    expect(OverviewPlanSchema.safeParse(plan).success).toBe(true);
    expect(validateOverviewPlan(plan, GRAPH, SOURCE).valid).toBe(true);
    expect(plan.audioTurns).toEqual([]);
    expect(plan.videoScenes.length).toBeGreaterThan(0);
    for (const scene of plan.videoScenes) {
      if (scene.renderingClass !== 'generative') {
        expect(scene.exactTexts.some((t) => t.exact)).toBe(true);
      }
    }
    const evaluation = evaluateCoverage(plan, GRAPH, SOURCE);
    expect(evaluation.coveragePercent).toBe(100);
    expect(evaluation.grounded).toBe(true);
  });

  test('identical inputs + seed produce byte-identical plans', () => {
    const a = compileOverviewPlan(baseRequest());
    const b = compileOverviewPlan(baseRequest());
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  test('different seeds keep coverage but vary seeded details', () => {
    const a = compileOverviewPlan(baseRequest({ seed: 'seed-a' }));
    const b = compileOverviewPlan(baseRequest({ seed: 'seed-b' }));
    const c = compileOverviewPlan(baseRequest({ seed: 'seed-c' }));
    const coverage = (p: OverviewPlan) => p.coverage.covered.map((e) => e.claimId).sort().join(',');
    expect(coverage(b)).toBe(coverage(a));
    expect(coverage(c)).toBe(coverage(a));
    // At least one alternative seed must change some seeded detail.
    expect(
      JSON.stringify(b) !== JSON.stringify(a) || JSON.stringify(c) !== JSON.stringify(a),
    ).toBe(true);
  });

  test('rejects mode/modality mismatches', () => {
    expect(() => compileOverviewPlan(baseRequest({ mode: 'explainer' }))).toThrow();
    expect(() =>
      compileOverviewPlan(baseRequest({ modality: 'video', mode: 'deep-dive' })),
    ).toThrow();
  });
});

describe('compileOverviewPlan — budget-driven coverage (compression/expansion)', () => {
  test('60s compresses to the top-salience claims with explicit omissions', () => {
    const plan = compileOverviewPlan(baseRequest({ targetDurationSeconds: 60 }));
    const capacity = Math.ceil(60 / DEFAULT_SECONDS_PER_CLAIM); // 3
    expect(plan.coverage.covered.length).toBe(capacity);
    expect(plan.coverage.omitted.length).toBe(GRAPH.claims.length - capacity);
    // Highest-salience claims survive compression.
    expect(plan.coverage.covered.map((c) => c.claimId)).toContain('claim-tool-catalog');
    expect(plan.coverage.covered.map((c) => c.claimId)).toContain('claim-purpose');
    for (const omitted of plan.coverage.omitted) {
      expect(omitted.reason).toContain('capacity');
    }
    // Still fully accounted and grounded.
    expect(validateOverviewPlan(plan, GRAPH, SOURCE).valid).toBe(true);
    const evaluation = evaluateCoverage(plan, GRAPH, SOURCE);
    expect(evaluation.unaccountedClaimIds).toEqual([]);
    expect(evaluation.grounded).toBe(true);
    expect(evaluation.coveragePercent).toBeLessThan(100);
  });

  test('longer durations monotonically increase claim coverage', () => {
    const percents = [60, 120, 300, 900].map((duration) => {
      const plan = compileOverviewPlan(baseRequest({ targetDurationSeconds: duration }));
      return evaluateCoverage(plan, GRAPH, SOURCE).coveragePercent;
    });
    for (let i = 1; i < percents.length; i += 1) {
      expect(percents[i] as number).toBeGreaterThanOrEqual(percents[i - 1] as number);
    }
    expect(percents[percents.length - 1]).toBe(100);
  });

  test('validity grid across durations, modalities and seeds', () => {
    for (const duration of [45, 90, 180, 300, 420, 900, 1800]) {
      for (const modality of ['audio', 'video'] as const) {
        for (const seed of ['grid-1', 'grid-2']) {
          const plan = compileOverviewPlan(
            baseRequest({
              modality,
              ...(modality === 'video' ? { mode: 'explainer' } : {}),
              targetDurationSeconds: duration,
              seed,
            }),
          );
          expect(OverviewPlanSchema.safeParse(plan).success, `${modality}@${duration}/${seed}`).toBe(true);
          expect(validateOverviewPlan(plan, GRAPH, SOURCE).valid, `${modality}@${duration}/${seed}`).toBe(true);
        }
      }
    }
  });
});

describe('compileOverviewPlan — editorial invariants', () => {
  test('custom instructions never change claim coverage (EXP-V-03 falsifier anchor)', () => {
    const plain = compileOverviewPlan(baseRequest());
    const instructed = compileOverviewPlan(
      baseRequest({ customInstructions: 'Focus on beginners, keep it light, skip nothing technical.' }),
    );
    expect(instructed.customInstructions).toContain('beginners');
    expect(
      instructed.coverage.covered.map((c) => c.claimId).sort().join(','),
    ).toBe(plain.coverage.covered.map((c) => c.claimId).sort().join(','));
    expect(
      instructed.coverage.omitted.map((c) => c.claimId).sort().join(','),
    ).toBe(plain.coverage.omitted.map((c) => c.claimId).sort().join(','));
  });

  test('modes produce distinct dialogue shapes', () => {
    const deepDive = compileOverviewPlan(baseRequest({ mode: 'deep-dive' }));
    const debate = compileOverviewPlan(baseRequest({ mode: 'debate' }));
    const critique = compileOverviewPlan(baseRequest({ mode: 'critique' }));
    const brief = compileOverviewPlan(baseRequest({ mode: 'brief' }));
    const purposeMultiset = (p: OverviewPlan) =>
      p.audioTurns.map((t) => t.purpose).sort().join(',');
    expect(purposeMultiset(debate)).not.toBe(purposeMultiset(deepDive));
    expect(purposeMultiset(critique)).not.toBe(purposeMultiset(deepDive));
    expect(purposeMultiset(brief)).not.toBe(purposeMultiset(deepDive));
    // Brief compresses the arc: fewer turns than deep-dive at the same target.
    expect(brief.audioTurns.length).toBeLessThan(deepDive.audioTurns.length);
    // Every plan remains valid.
    for (const plan of [deepDive, debate, critique, brief]) {
      expect(validateOverviewPlan(plan, GRAPH, SOURCE).valid).toBe(true);
    }
  });

  test('turn purposes and evidence stay grounded (no mechanical alternation)', () => {
    const plan = compileOverviewPlan(baseRequest());
    const purposes = new Set(plan.audioTurns.map((t) => t.purpose));
    // A dialogue graph, not raw speaker ping-pong: multiple purposes appear.
    expect(purposes.size).toBeGreaterThanOrEqual(5);
    for (const turn of plan.audioTurns) {
      expect(turn.brief.length).toBeGreaterThan(0);
      // W2 grounding rule: factual carriers must cite claims; structural
      // purposes (framing/question/transition/synthesis/conclusion) may be
      // claim-less topical tissue (EV-005 fix: anchors only where they fit).
      if (FACTUAL_TURN_PURPOSES.has(turn.purpose)) {
        expect(turn.claimIds.length).toBeGreaterThanOrEqual(1);
      }
    }
    // Grounded turns: evidence spans verify against the source.
    for (const turn of plan.audioTurns) {
      for (const span of turn.evidence) {
        expect(SOURCE.text.slice(span.start, span.end)).toBe(span.quote);
      }
    }
  });

  test('fact-bearing exact labels (label/number/quote) come from the source text', () => {
    const plan = compileOverviewPlan(
      baseRequest({ modality: 'video', mode: 'explainer', targetDurationSeconds: 420 }),
    );
    for (const scene of plan.videoScenes) {
      for (const item of scene.exactTexts) {
        if (!item.exact || item.role === 'title' || item.role === 'caption') continue;
        expect(SOURCE.text.includes(item.value), `label not grounded: ${item.value}`).toBe(true);
      }
    }
  });
});

describe('compileOverviewPlan — turn-budget allocation (EV-005 fix, WFLX-P3A)', () => {
  // The pre-fix Director assigned up to two full claim statements to EVERY
  // turn regardless of duration, so the minimum-weight topic beat's 5-6 s
  // turns could not voice their mandatory anchors within the mode rate
  // ceiling (canonical critique/debate: 4 turn-over-budget errors each; a
  // 180 s deep-dive compounded to 11 — EV-005/EV-006 EXP-A-05). The fix:
  // anchor mass vs slot duration.

  test('every turn slot can voice its mandatory anchor mass at the planning rate', () => {
    // Mass-fit invariant: for every anchored turn, ceil(mass / planning
    // rate) <= duration. The planning rate (2.5 wps) sits below every audio
    // mode's effective rate ceiling (tightest 2.87 wps), so a fitting slot
    // cannot be flagged turn-over-budget by the audio compiler.
    for (const mode of ['deep-dive', 'brief', 'critique', 'debate'] as const) {
      for (const duration of [120, 180, 300, 600]) {
        const plan = compileOverviewPlan(baseRequest({ mode, targetDurationSeconds: duration }));
        for (const turn of plan.audioTurns) {
          if (turn.claimIds.length === 0) continue;
          const need = Math.ceil(mandatoryMass(turn, GRAPH) / TURN_PLANNING_RATE_WPS);
          expect(
            turn.targetDurationSeconds,
            `${mode}@${duration}s ${turn.id} (${turn.claimIds.join(',')}): ${need}s needed`,
          ).toBeGreaterThanOrEqual(need);
        }
      }
    }
  });

  test('every covered claim is voiced by at least one turn (no silent coverage)', () => {
    for (const mode of ['deep-dive', 'brief', 'critique', 'debate'] as const) {
      for (const duration of [120, 180, 300]) {
        const plan = compileOverviewPlan(baseRequest({ mode, targetDurationSeconds: duration }));
        const voiced = new Set(plan.audioTurns.flatMap((turn) => [...turn.claimIds]));
        for (const entry of plan.coverage.covered) {
          expect(
            voiced.has(entry.claimId),
            `${mode}@${duration}s: covered claim ${entry.claimId} is voiced by no turn`,
          ).toBe(true);
        }
      }
    }
  });

  test('the minimum-weight topic beat stays in budget: 1-claim beats cap factual carriers', () => {
    // The EV-005 locus: the "Purpose of the note" topic beat carries a
    // single 22-word claim. Pre-fix, all four pattern slots anchored it at
    // 5-6 s each. Post-fix the beat keeps at most one factual carrier per
    // claim and the carrier's duration covers the anchor mass.
    const plan = compileOverviewPlan(baseRequest());
    const purposeBeat = plan.beats.find((b) => b.title === 'Purpose of the note');
    expect(purposeBeat).toBeDefined();
    const beatTurns = plan.audioTurns.filter((t) => t.beatId === purposeBeat?.id);
    expect(beatTurns.length).toBeGreaterThanOrEqual(1);
    const carriers = beatTurns.filter((t) => FACTUAL_TURN_PURPOSES.has(t.purpose));
    expect(carriers.length).toBeLessThanOrEqual(purposeBeat?.claimIds.length ?? 0);
    for (const turn of carriers) {
      const need = Math.ceil(mandatoryMass(turn, GRAPH) / TURN_PLANNING_RATE_WPS);
      expect(turn.targetDurationSeconds).toBeGreaterThanOrEqual(need);
    }
    // Durations still sum to the beat budget exactly.
    const beatWeight = purposeBeat?.weight ?? 0;
    const beatBudget = Math.round(beatWeight * 300);
    expect(beatTurns.reduce((acc, t) => acc + t.targetDurationSeconds, 0)).toBe(beatBudget);
  });

  test('claim-less turns are topical tissue on structural purposes only', () => {
    for (const mode of ['deep-dive', 'brief', 'critique', 'debate'] as const) {
      const plan = compileOverviewPlan(baseRequest({ mode }));
      for (const turn of plan.audioTurns) {
        if (turn.claimIds.length === 0) {
          expect(FACTUAL_TURN_PURPOSES.has(turn.purpose), `${mode} ${turn.id}`).toBe(false);
          // The brief must say so honestly (no "anchors: everything").
          expect(turn.brief).toContain('No claim anchors this turn');
        }
      }
    }
  });

  test('duration compression prunes the skeleton mass-aware, coverage drops by salience', () => {
    // EXP-A-05 mechanism, post-fix: compression (300 s -> 180 s) drops
    // low-salience claims with reasons instead of producing impossible
    // anchor slots; every kept claim still fits its slot.
    const wide = compileOverviewPlan(baseRequest({ targetDurationSeconds: 300 }));
    const tight = compileOverviewPlan(baseRequest({ targetDurationSeconds: 180 }));
    expect(tight.coverage.covered.length).toBeLessThan(wide.coverage.covered.length);
    expect(tight.coverage.omitted.length).toBe(11 - tight.coverage.covered.length);
    for (const omitted of tight.coverage.omitted) {
      expect(omitted.reason).toContain('capacity');
    }
    const voiced = new Set(tight.audioTurns.flatMap((turn) => [...turn.claimIds]));
    for (const entry of tight.coverage.covered) {
      expect(voiced.has(entry.claimId)).toBe(true);
    }
    for (const turn of tight.audioTurns) {
      if (turn.claimIds.length === 0) continue;
      const need = Math.ceil(mandatoryMass(turn, GRAPH) / TURN_PLANNING_RATE_WPS);
      expect(turn.targetDurationSeconds, `${turn.id}`).toBeGreaterThanOrEqual(need);
    }
  });
});

describe('end-to-end offline pipeline (adapter -> extractor -> director -> evaluator)', () => {
  test('raw markdown compiles to a grounded explainer plan with zero network access', async () => {
    const raw = readFileSync('fixtures/reference-messy-note-redacted.md', 'utf8');
    const source = await new MarkdownNoteAdapter().ingest({
      id: 'source-messy-note-redacted',
      label: 'fixtures/reference-messy-note-redacted.md',
      content: raw,
      createdAt: NOW,
    });
    const graph = await new DeterministicExtractor().extract({ sources: [source], options: { createdAt: NOW } });
    expect(graph.claims.length).toBe(36);

    const plan = compileOverviewPlan({
      sources: [source],
      graph,
      modality: 'video',
      mode: 'explainer',
      targetDurationSeconds: 420,
      seed: 'pipeline-e2e',
      now: NOW,
      styleBibleId: 'style-bible--reference-ink',
    });
    const evaluation = evaluateCoverage(plan, graph, source);
    // Fine-grained extractor graph: 420s selects the top 16 of 36 claims.
    expect(evaluation.coveragePercent).toBe(44.4);
    expect(evaluation.grounded).toBe(true);
    expect(evaluation.unaccountedClaimIds).toEqual([]);
    expect(evaluation.omittedClaims).toBe(20);
    expect(plan.generator.deterministic).toBe(true);
    expect(plan.generator.seed).toBe('pipeline-e2e');
  });
});
