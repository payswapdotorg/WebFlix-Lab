/**
 * Interactive Audio session tests (WFLX-P1, EV-018): deterministic claim
 * retrieval, intervention-plan validity, session locality/order/determinism
 * over a compact baseline (the 42 s benchmark plan — the canonical 5-min
 * fixture is exercised by experiments/run-interactive-audio.ts).
 */

import { describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { compileAudioOverview } from '../../src/audio';
import {
  InteractiveAudioSession,
  buildInterventionPlan,
  checkResponseGrounding,
  deriveInterventionPlanId,
  scoreClaimsAgainstIntervention,
  selectGroundedClaims,
} from '../../src/audio/interactive/session';
import {
  buildShortBenchmarkPlan,
  CANONICAL_GRAPH,
  CANONICAL_SOURCE,
  FIXED_NOW,
} from './fixtures';

const SESSION_SEED = 'wflx-interactive-test-seed';

async function baselineFixture() {
  return compileAudioOverview({
    plan: buildShortBenchmarkPlan(),
    graph: CANONICAL_GRAPH,
    sources: CANONICAL_SOURCE,
    options: { seed: SESSION_SEED, now: FIXED_NOW, mastering: 'pure-ts' },
  });
}

describe('deterministic claim retrieval (the graph machinery)', () => {
  test('content-matched retrieval ranks the relevant claim first', () => {
    const retrieval = selectGroundedClaims(
      CANONICAL_GRAPH,
      'Tell me more about the open-source media projects and local model runtimes.',
    );
    expect(retrieval.matchedByContent).toBe(true);
    expect(retrieval.retrievedClaimIds[0]).toBe('claim-oss-runtimes');
  });

  test('the purpose question retrieves the purpose claim', () => {
    const retrieval = selectGroundedClaims(CANONICAL_GRAPH, 'What does the note say about its purpose?');
    expect(retrieval.matchedByContent).toBe(true);
    expect(retrieval.retrievedClaimIds[0]).toBe('claim-purpose');
  });

  test('content-empty question uses the honest top-salience fallback (recorded)', () => {
    const retrieval = selectGroundedClaims(CANONICAL_GRAPH, 'zzzz qqqq');
    expect(retrieval.matchedByContent).toBe(false);
    expect(retrieval.retrievedClaimIds.length).toBeGreaterThan(0);
    // Top salience first.
    const scores = scoreClaimsAgainstIntervention(CANONICAL_GRAPH, 'zzzz qqqq');
    const sorted = [...scores].sort(
      (a, b) => b.salience - a.salience || (a.claimId < b.claimId ? -1 : 1),
    );
    expect(retrieval.retrievedClaimIds[0]).toBe(sorted[0]?.claimId);
  });

  test('scoring is deterministic (stable order across calls)', () => {
    const a = scoreClaimsAgainstIntervention(CANONICAL_GRAPH, 'open-source media projects');
    const b = scoreClaimsAgainstIntervention(CANONICAL_GRAPH, 'open-source media projects');
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe('intervention plan construction (same W1 surfaces)', () => {
  test('buildInterventionPlan passes the frozen guard + W1 deep validation', () => {
    const plan = buildInterventionPlan(
      {
        baselinePlan: buildShortBenchmarkPlan(),
        graph: CANONICAL_GRAPH,
        sources: [CANONICAL_SOURCE],
        listenerText: 'What about the open-source media projects?',
        retrievedClaimIds: ['claim-oss-runtimes'],
        seed: SESSION_SEED,
        now: FIXED_NOW,
      },
      1,
    );
    expect(plan.audioTurns.length).toBe(2);
    expect(plan.audioTurns[0]?.purpose).toBe('interjection');
    expect(plan.audioTurns[0]?.claimIds).toEqual([]);
    const response = plan.audioTurns[1];
    expect(response?.purpose).toBe('explanation');
    expect(response?.claimIds).toEqual(['claim-oss-runtimes']);
    // Coverage accounting: retrieved covered, everything else omitted.
    expect(plan.coverage.covered.map((entry) => entry.claimId)).toEqual(['claim-oss-runtimes']);
    expect(plan.coverage.omitted.length).toBe(CANONICAL_GRAPH.claims.length - 1);
  });

  test('unknown retrieved claims reject (never silently ungrounded)', () => {
    expect(() =>
      buildInterventionPlan(
        {
          baselinePlan: buildShortBenchmarkPlan(),
          graph: CANONICAL_GRAPH,
          sources: [CANONICAL_SOURCE],
          listenerText: 'question',
          retrievedClaimIds: ['claim-does-not-exist'],
          seed: SESSION_SEED,
          now: FIXED_NOW,
        },
        1,
      ),
    ).toThrow(/not in graph/);
  });

  test('plan id is deterministic and content-sensitive', () => {
    const a = deriveInterventionPlanId('plan-x', 'question one', 3);
    const b = deriveInterventionPlanId('plan-x', 'question one', 3);
    const c = deriveInterventionPlanId('plan-x', 'question two', 3);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});

describe('InteractiveAudioSession (42 s benchmark baseline)', () => {
  test('join -> grounded response -> resume: F1/F2/F3 proofs + determinism', async () => {
    const baseline = await baselineFixture();
    const session = new InteractiveAudioSession({
      baseline,
      graph: CANONICAL_GRAPH,
      sources: [CANONICAL_SOURCE],
      seed: SESSION_SEED,
      now: FIXED_NOW,
      mastering: 'pure-ts',
    });

    const result = await session.intervene({
      afterTurnIndex: 1,
      listenerText: 'Can you say more about the open-source media projects and local model runtimes?',
      artifactId: 'artifact-interactive-test-session',
    });

    // F1: grounding (W1 + W2 + claim resolution).
    expect(result.grounding.passed).toBe(true);
    expect(result.grounding.w1Valid).toBe(true);
    expect(result.grounding.w2Issues).toEqual([]);
    expect(result.grounding.claimsResolve).toBe(true);
    expect(result.grounding.responseClaimIds).toContain('claim-oss-runtimes');

    // F2: locality — every original turn byte-identical, exact shift.
    expect(result.proofs.locality.passed).toBe(true);
    expect(result.proofs.locality.rows).toHaveLength(baseline.timing.entries.length);
    for (const row of result.proofs.locality.rows) {
      expect(row.wavSha256Equal).toBe(true);
      expect(row.actualSecondsEqual).toBe(true);
      expect(row.gapAfterMsEqual).toBe(true);
      expect([0, result.proofs.locality.postBoundaryShiftMs]).toContain(row.startMsDelta);
    }
    // The response turns were actually inserted.
    expect(result.session.manifest.entries.length).toBe(
      baseline.timing.entries.length + result.responseCompile.timing.entries.length,
    );

    // F3: order preserved with insertion only at the boundary.
    expect(result.proofs.order.originalOrderPreserved).toBe(true);
    const responseIds = new Set(result.responseCompile.timing.entries.map((e) => e.turnId));
    const insertionIndex = result.proofs.order.sessionSequence.findIndex((id) => responseIds.has(id));
    expect(insertionIndex).toBe(2); // after baseline turns 0..1.

    // F4: determinism — same intervention double-run byte-identical.
    const rerun = await session.intervene({
      afterTurnIndex: 1,
      listenerText: 'Can you say more about the open-source media projects and local model runtimes?',
      artifactId: 'artifact-interactive-test-session',
    });
    const sha = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
    expect(sha(rerun.session.wav)).toBe(sha(result.session.wav));
    expect(JSON.stringify(rerun.session.manifest)).toBe(JSON.stringify(result.session.manifest));

    // The response segment realized the grounded anchors (source-grounded text).
    const responseText = result.responseCompile.realized
      .find((turn) => turn.turnId === 'ix-turn-response')
      ?.text;
    expect(responseText).toContain('open-source media projects');
  });

  test('invalid turn boundary rejects', async () => {
    const baseline = await baselineFixture();
    const session = new InteractiveAudioSession({
      baseline,
      graph: CANONICAL_GRAPH,
      sources: [CANONICAL_SOURCE],
      seed: SESSION_SEED,
      now: FIXED_NOW,
    });
    await expect(
      session.intervene({ afterTurnIndex: 99, listenerText: 'question' }),
    ).rejects.toThrow(/not a valid interior turn boundary/);
    await expect(
      session.intervene({ afterTurnIndex: -1, listenerText: 'question' }),
    ).rejects.toThrow(/not a valid interior turn boundary/);
  });

  test('baseline unchanged by the session construction (no hidden recompile drift)', async () => {
    const baseline = await baselineFixture();
    const wavBefore = createHash('sha256').update(baseline.wav).digest('hex');
    const session = new InteractiveAudioSession({
      baseline,
      graph: CANONICAL_GRAPH,
      sources: [CANONICAL_SOURCE],
      seed: SESSION_SEED,
      now: FIXED_NOW,
    });
    await session.intervene({ afterTurnIndex: 0, listenerText: 'purpose of the note?' });
    // The baseline's own master WAV bytes are untouched by the session.
    expect(createHash('sha256').update(baseline.wav).digest('hex')).toBe(wavBefore);
  });

  test('checkResponseGrounding flags an ungrounded response plan (red case)', async () => {
    // Build a plan with a response turn citing a valid claim, then corrupt
    // the claim reference to prove the check FAILS on ungrounded input.
    const plan = buildInterventionPlan(
      {
        baselinePlan: buildShortBenchmarkPlan(),
        graph: CANONICAL_GRAPH,
        sources: [CANONICAL_SOURCE],
        listenerText: 'What about the open-source media projects?',
        retrievedClaimIds: ['claim-oss-runtimes'],
        seed: SESSION_SEED,
        now: FIXED_NOW,
      },
      1,
    );
    const compile = await compileAudioOverview({
      plan,
      graph: CANONICAL_GRAPH,
      sources: CANONICAL_SOURCE,
      options: { seed: SESSION_SEED, now: FIXED_NOW, mastering: 'pure-ts' },
    });
    const good = checkResponseGrounding(plan, compile.graph, CANONICAL_GRAPH, [CANONICAL_SOURCE]);
    expect(good.passed).toBe(true);

    const corrupted = JSON.parse(JSON.stringify(plan)) as typeof plan;
    const turn = corrupted.audioTurns[1] as unknown as { claimIds: string[] };
    turn.claimIds = ['claim-made-up'];
    const bad = checkResponseGrounding(corrupted, compile.graph, CANONICAL_GRAPH, [CANONICAL_SOURCE]);
    expect(bad.claimsResolve).toBe(false);
    expect(bad.passed).toBe(false);
  });
});
