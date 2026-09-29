/**
 * Integration test fixtures (WFLX-P3B wave 1 — TL #2 integration station).
 *
 * Cross-modal IR compliance, unified manifest registry and refinement-loop
 * tests all ground on the SAME frozen W1 fixture source
 * (`fixtures/contracts/reference-messy-note-redacted.md` parsed into the
 * canonical SourceArtifact + hand-grounded SemanticGraph), following the
 * loading convention of tests/audio/fixtures.ts and tests/video/fixtures.ts.
 *
 * The Director (src/director/compiler.ts) compiles this one fixture source
 * into BOTH modalities with one seed, giving the cross-modal suite its
 * shared-IR pair: identical (seed, targetDurationSeconds) -> identical
 * editorial claim selection -> audio plan (audioTurns) + video plan
 * (videoScenes) over the same claim universe.
 *
 * These are lab-reproduction fixtures only — NOT product-parity evidence
 * (AGENTS.md; tests/README.md).
 */

import { readFileSync } from 'node:fs';
import type { Id, OverviewPlan, SemanticGraph, SourceArtifact, UtcTimestamp } from '../../src/contracts';

export const CANONICAL_GRAPH: SemanticGraph = JSON.parse(
  readFileSync('fixtures/contracts/reference-messy-note.semantic-graph.json', 'utf8'),
) as SemanticGraph;

export const CANONICAL_SOURCE: SourceArtifact = JSON.parse(
  readFileSync('fixtures/contracts/reference-messy-note.source-artifact.json', 'utf8'),
) as SourceArtifact;

/** Frozen W1 audio-modality canonical plan fixture (Deep Dive ~5 min, 22 turns). */
export const CANONICAL_AUDIO_PLAN: OverviewPlan = JSON.parse(
  readFileSync('fixtures/contracts/plan-audio-deep-dive-5min.json', 'utf8'),
) as OverviewPlan;

/** Frozen W1 video-modality canonical plan fixture (Explainer ~7 min, 15 scenes). */
export const CANONICAL_VIDEO_PLAN: OverviewPlan = JSON.parse(
  readFileSync('fixtures/contracts/plan-video-explainer-7min.json', 'utf8'),
) as OverviewPlan;

/** Fixed seed for the integration suite (distinct from W2/W3 test seeds). */
export const INTEGRATION_SEED = 'wflx-p3b-integration-seed';

/** Fixed seed for the refinement-loop suite (checklist §2 item 7). */
export const LOOP_SEED = 'wflx-p3b-loop-seed';

/** Fixed sidecar timestamp for the refinement-loop suite (no hidden clock). */
export const LOOP_NOW: UtcTimestamp = '2026-09-29T12:00:00Z';

/** Fixed sidecar timestamp for the integration suite (no hidden clock). */
export const INTEGRATION_NOW: UtcTimestamp = '2026-09-29T00:00:00Z';

/** Fixed timestamp for manifest registry builds in tests. */
export const REGISTRY_NOW: UtcTimestamp = '2026-09-29T00:00:00Z';

/** Deep clone for freeze/mutation checks (plans are plain JSON records). */
export function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Claim ids a plan editorially accounts for (covered + omitted). */
export function accountedClaimIds(plan: OverviewPlan): Id[] {
  return [
    ...new Set([...plan.coverage.covered.map((c) => c.claimId), ...plan.coverage.omitted.map((o) => o.claimId)]),
  ].sort();
}

/** Claim ids a plan covers (the editorial selection). */
export function coveredClaimIds(plan: OverviewPlan): Id[] {
  return [...new Set(plan.coverage.covered.map((c) => c.claimId))].sort();
}

/** Claim ids cited by the plan's audio turns (audio-surface grounding). */
export function turnCitedClaimIds(plan: OverviewPlan): Id[] {
  return [...new Set(plan.audioTurns.flatMap((t) => t.claimIds))].sort();
}

/** Claim ids cited by the plan's video scenes (video-surface grounding). */
export function sceneCitedClaimIds(plan: OverviewPlan): Id[] {
  return [...new Set(plan.videoScenes.flatMap((s) => s.claimIds))].sort();
}

/**
 * A canonical-plan mutant for the refinement-loop escalation path: turn 6 is
 * handed seven claims and 3 seconds, so its anchors cannot fit the mode rate
 * ceiling and the audio QA flags `turn-over-budget` naming the smallest
 * regenerable unit (recipe mirrors the proven W2 mutant class; built here so
 * the integration tree stays self-contained).
 */
export function buildOverBudgetTurnPlan(): OverviewPlan {
  const plan = deepClone(CANONICAL_AUDIO_PLAN);
  const turn = plan.audioTurns[5];
  if (turn === undefined) throw new Error('mutant: missing turn 5');
  turn.claimIds = [
    'claim-tool-catalog',
    'claim-oss-runtimes',
    'claim-forecasting-projects',
    'claim-infra-stack',
    'claim-multi-agent-orchestration',
    'claim-audits',
    'claim-provider-integrations',
  ];
  turn.targetDurationSeconds = 3;
  // Re-balance the duration sum inside the W1 tolerance by trimming a neighbor.
  const neighbor = plan.audioTurns[6];
  if (neighbor !== undefined) {
    neighbor.targetDurationSeconds = neighbor.targetDurationSeconds + 15.75;
  }
  return plan;
}
