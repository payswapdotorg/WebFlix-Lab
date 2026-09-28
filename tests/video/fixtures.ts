/**
 * Video test fixtures (WFLX-W3).
 *
 * Canonical inputs: the W1-frozen explainer plan fixture over the
 * reference-messy-note graph (Director-emitted, byte-identical regeneration
 * enforced by tests/contracts). Stand-in builders below produce tiny video
 * plans for fast tests; they reuse the canonical graph's claims so every
 * grounding invariant holds. Mutants deliberately violate one rule at a time
 * for red tests. Stand-ins are NOT product-parity evidence (tests/README.md).
 */

import { readFileSync } from 'node:fs';
import {
  CONTRACTS_VERSION,
  type CoverageEntry,
  type Id,
  type NarrativeBeat,
  type OverviewPlan,
  type SceneTextItem,
  type SemanticGraph,
  type SourceArtifact,
  type UtcTimestamp,
  type VideoScene,
} from '../../src/contracts';

export const CANONICAL_VIDEO_PLAN: OverviewPlan = JSON.parse(
  readFileSync('fixtures/contracts/plan-video-explainer-7min.json', 'utf8'),
) as OverviewPlan;

export const CANONICAL_GRAPH: SemanticGraph = JSON.parse(
  readFileSync('fixtures/contracts/reference-messy-note.semantic-graph.json', 'utf8'),
) as SemanticGraph;

export const CANONICAL_SOURCE: SourceArtifact = JSON.parse(
  readFileSync('fixtures/contracts/reference-messy-note.source-artifact.json', 'utf8'),
) as SourceArtifact;

export const FIXED_SEED = 'wflx-w3-test-seed';
export const FIXED_NOW: UtcTimestamp = '2026-09-28T00:00:00Z';

interface TinyPlanOptions {
  readonly planId?: Id;
  readonly mode?: 'explainer' | 'short' | 'cinematic';
  readonly targetDurationSeconds?: number;
}

function coverageFor(
  graph: SemanticGraph,
  coveredClaimIds: readonly Id[],
): { covered: CoverageEntry[]; omitted: { claimId: Id; reason: string }[] } {
  const covered = coveredClaimIds.map((claimId) => ({
    claimId,
    role: 'primary' as const,
    unitIds: ['beat-1'],
  }));
  const omitted = graph.claims
    .filter((claim) => !coveredClaimIds.includes(claim.id))
    .map((claim) => ({
      claimId: claim.id,
      reason: `omitted by the tiny test builder (salience ${claim.salience})`,
    }));
  return { covered, omitted };
}

function beatsFor(claimIds: readonly Id[]): NarrativeBeat[] {
  const weight = 1;
  return [
    {
      id: 'beat-1',
      index: 0,
      title: 'Tiny beat',
      purpose: 'Exercise the video surface end-to-end.',
      brief: 'Cover the catalog, the infrastructure stack and the purpose.',
      claimIds: [...claimIds],
      topicIds: [],
      weight,
    },
  ];
}

function scene(
  index: number,
  overrides: Partial<VideoScene> & Pick<VideoScene, 'id' | 'visualType' | 'renderingClass'>,
): VideoScene {
  const base: VideoScene = {
    recordType: 'VideoScene',
    contractVersion: CONTRACTS_VERSION,
    id: `scene-${index + 1}`,
    index,
    beatId: 'beat-1',
    narrativePurpose: 'Explain the segment with exact labels.',
    visualType: 'title-card',
    renderingClass: 'deterministic',
    exactTexts: [{ role: 'title', value: 'A Messy Note, Mapped', exact: true }],
    claimIds: ['claim-purpose'],
    narrationRef: `narr-s${index + 1}`,
    narrationBrief: 'Narrate the segment.',
    targetDurationSeconds: 4,
    motion: 'static',
    transition: index === 0 ? 'cut' : 'crossfade',
    styleBibleId: 'style-bible--reference-ink',
  };
  return { ...base, ...overrides };
}

/** Tiny 3-scene explainer over the canonical graph (fast tests). */
export function buildTinyVideoPlan(options: TinyPlanOptions = {}): OverviewPlan {
  const claimIds: Id[] = ['claim-purpose', 'claim-infra-stack', 'claim-tool-catalog', 'claim-oss-runtimes'];
  const texts = (values: string[], role: SceneTextItem['role'] = 'label'): SceneTextItem[] =>
    values.map((value) => ({ role, value, exact: true }));

  const scenes: VideoScene[] = [
    scene(0, {
      id: 'scene-1',
      visualType: 'title-card',
      renderingClass: 'deterministic',
      targetDurationSeconds: 4,
      exactTexts: [
        { role: 'title', value: 'A Messy Note, Mapped', exact: true },
        { role: 'caption', value: 'an explainer overview', exact: true },
      ],
    }),
    scene(1, {
      id: 'scene-2',
      visualType: 'architecture-diagram',
      renderingClass: 'deterministic',
      targetDurationSeconds: 8,
      claimIds: ['claim-infra-stack'],
      exactTexts: texts(['Cloudflare', 'Postgres', 'Neon']),
      motion: 'animated-diagram',
    }),
    scene(2, {
      id: 'scene-3',
      visualType: 'metaphor-illustration',
      renderingClass: 'generative',
      targetDurationSeconds: 8,
      claimIds: ['claim-tool-catalog'],
      exactTexts: [],
      transition: 'crossfade',
    }),
  ];

  return {
    recordType: 'OverviewPlan',
    contractVersion: CONTRACTS_VERSION,
    id: options.planId ?? 'plan-tiny-video-explainer-20s',
    sourceIds: [...CANONICAL_GRAPH.sourceIds],
    modality: 'video',
    mode: options.mode ?? 'explainer',
    objective: 'A tiny explainer for the video surface tests.',
    audience: 'technical',
    language: 'en',
    targetDurationSeconds: options.targetDurationSeconds ?? 20,
    style: {
      tone: 'clear, technical',
      register: 'plain-technical',
      pacing: 'measured',
      styleBibleId: 'style-bible--reference-ink',
    },
    coverage: coverageFor(CANONICAL_GRAPH, claimIds),
    beats: beatsFor(claimIds),
    audioTurns: [],
    videoScenes: scenes,
    generator: {
      name: 'w3-test-builder',
      version: '1.0.0',
      seed: FIXED_SEED,
      deterministic: true,
    },
    createdAt: FIXED_NOW,
    notes: 'Tiny stand-in plan for fast tests; NOT product parity evidence.',
  };
}

/** Clone + mutate helper for red tests (one rule broken per mutant). */
export function mutatePlan(plan: OverviewPlan, mutate: (draft: OverviewPlan) => void): OverviewPlan {
  const draft = JSON.parse(JSON.stringify(plan)) as OverviewPlan;
  mutate(draft);
  return draft;
}

/** One scene per deterministic visual type (renderer coverage matrix). */
export function buildAllTypesPlan(): OverviewPlan {
  const claimIds: Id[] = ['claim-purpose'];
  const types: { type: VideoScene['visualType']; cls: VideoScene['renderingClass'] }[] = [
    { type: 'title-card', cls: 'deterministic' },
    { type: 'architecture-diagram', cls: 'deterministic' },
    { type: 'state-diagram', cls: 'deterministic' },
    { type: 'process-flow', cls: 'deterministic' },
    { type: 'data-chart', cls: 'deterministic' },
    { type: 'code-panel', cls: 'hybrid' },
    { type: 'quote-panel', cls: 'deterministic' },
    { type: 'callout', cls: 'deterministic' },
    { type: 'table', cls: 'deterministic' },
    { type: 'hero-illustration', cls: 'generative' },
    { type: 'metaphor-illustration', cls: 'generative' },
    { type: 'workstation-scene', cls: 'hybrid' },
    { type: 'montage', cls: 'hybrid' },
  ];
  const scenes: VideoScene[] = types.map(({ type, cls }, index) =>
    scene(index, {
      id: `scene-${index + 1}`,
      visualType: type,
      renderingClass: cls,
      targetDurationSeconds: 2,
      exactTexts:
        cls === 'generative'
          ? []
          : [{ role: 'label', value: `${type} exact`, exact: true }],
      claimIds: ['claim-purpose'],
      transition: index === 0 ? 'cut' : 'crossfade',
    }),
  );
  return {
    recordType: 'OverviewPlan',
    contractVersion: CONTRACTS_VERSION,
    id: 'plan-all-types-26s',
    sourceIds: [...CANONICAL_GRAPH.sourceIds],
    modality: 'video',
    mode: 'explainer',
    objective: 'Exercise every visual type once.',
    audience: 'technical',
    language: 'en',
    targetDurationSeconds: 26,
    style: {
      tone: 'clear, technical',
      register: 'plain-technical',
      pacing: 'measured',
      styleBibleId: 'style-bible--reference-ink',
    },
    coverage: coverageFor(CANONICAL_GRAPH, claimIds),
    beats: beatsFor(claimIds),
    audioTurns: [],
    videoScenes: scenes,
    generator: {
      name: 'w3-test-builder',
      version: '1.0.0',
      seed: FIXED_SEED,
      deterministic: true,
    },
    createdAt: FIXED_NOW,
    notes: 'All-types stand-in plan; NOT product parity evidence.',
  };
}
