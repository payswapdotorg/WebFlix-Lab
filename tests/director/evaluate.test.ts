/**
 * Groundedness / coverage evaluator tests: fixture ground truth, corrupted
 * inputs, and later-stage turn/scene list evaluation for Workers 2/3.
 */

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import {
  evaluateAudioTurns,
  evaluateCoverage,
  evaluateVideoScenes,
} from '../../src/director/evaluate';
import type {
  AudioTurn,
  OverviewPlan,
  SemanticGraph,
  SourceArtifact,
  VideoScene,
} from '../../src/contracts';

const SOURCE = JSON.parse(
  readFileSync('fixtures/contracts/reference-messy-note.source-artifact.json', 'utf8'),
) as SourceArtifact;
const GRAPH = JSON.parse(
  readFileSync('fixtures/contracts/reference-messy-note.semantic-graph.json', 'utf8'),
) as SemanticGraph;
const AUDIO_PLAN = JSON.parse(
  readFileSync('fixtures/contracts/plan-audio-deep-dive-5min.json', 'utf8'),
) as OverviewPlan;
const VIDEO_PLAN = JSON.parse(
  readFileSync('fixtures/contracts/plan-video-explainer-7min.json', 'utf8'),
) as OverviewPlan;
const UNACCOUNTED_MUTANT = JSON.parse(
  readFileSync('fixtures/contracts/mutants/s09-unaccounted-claims.json', 'utf8'),
) as OverviewPlan;

describe('evaluateCoverage — fixture ground truth', () => {
  test('audio plan: 100% coverage, fully grounded', () => {
    const evaluation = evaluateCoverage(AUDIO_PLAN, GRAPH, SOURCE);
    expect(evaluation.totalClaims).toBe(11);
    expect(evaluation.coveredClaims).toBe(11);
    expect(evaluation.coveragePercent).toBe(100);
    expect(evaluation.omittedClaims).toBe(0);
    expect(evaluation.unaccountedClaimIds).toEqual([]);
    expect(evaluation.unsupportedClaimRefs).toEqual([]);
    expect(evaluation.evidenceLinkErrors).toEqual([]);
    expect(evaluation.roleCounts).toEqual({ primary: 4, supporting: 5, mention: 2 });
    expect(evaluation.grounded).toBe(true);
  });

  test('video plan: 100% coverage, fully grounded', () => {
    const evaluation = evaluateCoverage(VIDEO_PLAN, GRAPH, SOURCE);
    expect(evaluation.coveragePercent).toBe(100);
    expect(evaluation.grounded).toBe(true);
  });

  test('unaccounted-claims mutant is flagged and not grounded', () => {
    const evaluation = evaluateCoverage(UNACCOUNTED_MUTANT, GRAPH, SOURCE);
    expect(evaluation.unaccountedClaimIds).toEqual(['claim-credentials-redacted']);
    expect(evaluation.coveredClaims).toBe(10);
    expect(evaluation.coveragePercent).toBe(90.9);
    expect(evaluation.grounded).toBe(false);
  });

  test('dropped coverage entry lowers the percentage', () => {
    const dropped: OverviewPlan = {
      ...AUDIO_PLAN,
      coverage: {
        covered: AUDIO_PLAN.coverage.covered.slice(0, 8) as OverviewPlan['coverage']['covered'],
        omitted: AUDIO_PLAN.coverage.omitted,
      },
    };
    const evaluation = evaluateCoverage(dropped, GRAPH, SOURCE);
    expect(evaluation.coveredClaims).toBe(8);
    expect(evaluation.coveragePercent).toBe(72.7);
    // The three dropped claims become unaccounted (not omitted).
    expect(evaluation.unaccountedClaimIds.length).toBe(3);
  });

  test('unknown claim references are flagged as unsupported', () => {
    const poisoned: OverviewPlan = {
      ...AUDIO_PLAN,
      beats: AUDIO_PLAN.beats.map((b, i) =>
        i === 0 ? { ...b, claimIds: [...b.claimIds, 'claim-ghost'] } : b,
      ),
    };
    const evaluation = evaluateCoverage(poisoned, GRAPH, SOURCE);
    expect(evaluation.unsupportedClaimRefs).toEqual(['claim-ghost']);
    expect(evaluation.grounded).toBe(false);
  });

  test('corrupted evidence links are reported per unit', () => {
    const poisoned: OverviewPlan = {
      ...AUDIO_PLAN,
      audioTurns: AUDIO_PLAN.audioTurns.map((t, i) => {
        if (i !== 0) return t;
        const first = t.evidence[0];
        if (first === undefined) return t;
        return { ...t, evidence: [{ ...first, quote: 'tampered' }] };
      }),
    };
    const evaluation = evaluateCoverage(poisoned, GRAPH, SOURCE);
    expect(evaluation.evidenceLinkErrors.length).toBeGreaterThan(0);
    expect(evaluation.evidenceLinkErrors[0]?.unitId).toBe('turn-1');
    expect(evaluation.grounded).toBe(false);
  });
});

describe('evaluateAudioTurns — Worker 2 script stage', () => {
  test('fixture turns are fully grounded', () => {
    const evaluation = evaluateAudioTurns(AUDIO_PLAN.audioTurns, GRAPH, SOURCE);
    expect(evaluation.turnCount).toBe(22);
    expect(evaluation.groundedTurns).toBe(22);
    expect(evaluation.grounded).toBe(true);
  });

  test('ungrounded turn (no claims, no evidence) is detected', () => {
    const hollow: AudioTurn = {
      ...(AUDIO_PLAN.audioTurns[0] as AudioTurn),
      claimIds: [],
      evidence: [],
    };
    const evaluation = evaluateAudioTurns([hollow], GRAPH, SOURCE);
    expect(evaluation.groundedTurns).toBe(0);
    expect(evaluation.grounded).toBe(false);
  });

  test('turn citing an unknown claim is unsupported', () => {
    const ghost: AudioTurn = {
      ...(AUDIO_PLAN.audioTurns[0] as AudioTurn),
      claimIds: ['claim-ghost'],
    };
    const evaluation = evaluateAudioTurns([ghost], GRAPH, SOURCE);
    expect(evaluation.unsupportedClaimRefs).toEqual(['claim-ghost']);
    expect(evaluation.grounded).toBe(false);
  });
});

describe('evaluateVideoScenes — Worker 3 storyboard stage', () => {
  test('fixture scenes are fully label-grounded', () => {
    const evaluation = evaluateVideoScenes(VIDEO_PLAN.videoScenes, GRAPH, SOURCE);
    expect(evaluation.sceneCount).toBe(15);
    expect(evaluation.labelGroundedScenes).toBe(15);
    expect(evaluation.labelIssues).toEqual([]);
    expect(evaluation.grounded).toBe(true);
  });

  test('invented fact-bearing labels are flagged; editorial titles are exempt (atlas rule 2)', () => {
    const fabricated: VideoScene = {
      ...(VIDEO_PLAN.videoScenes[0] as VideoScene),
      exactTexts: [
        { role: 'label', value: 'Totally Made Up Label Not In Source', exact: true },
        { role: 'title', value: 'An Editorial Title Is Allowed', exact: true },
      ],
    };
    const evaluation = evaluateVideoScenes([fabricated], GRAPH, SOURCE);
    expect(evaluation.labelIssues.length).toBe(1);
    expect(evaluation.labelIssues[0]?.issue).toContain('not found in any source');
    expect(evaluation.grounded).toBe(false);
  });

  test('scene citing an unknown claim is unsupported', () => {
    const ghost: VideoScene = {
      ...(VIDEO_PLAN.videoScenes[0] as VideoScene),
      claimIds: ['claim-ghost'],
    };
    const evaluation = evaluateVideoScenes([ghost], GRAPH, SOURCE);
    expect(evaluation.unsupportedClaimRefs).toEqual(['claim-ghost']);
  });
});
