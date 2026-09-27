/**
 * Audio test fixtures and stand-in plan builders (WFLX-W2, Stage 2).
 *
 * Canonical inputs: the W1-frozen fixtures (plan-audio-deep-dive-5min over
 * the reference-messy-note graph). Mode stand-ins (brief / critique / debate)
 * are AUDIO-LOCAL and NON-CANONICAL: canonical per-mode plans are a HANDOFF
 * (DESIGN.md §16.4 item 2), so these stand-ins are lab scaffolding for the
 * mode-semantics predicates — NOT product-parity evidence (tests/README.md,
 * tests/audio/mode-semantics.md §0).
 *
 * Stand-ins reuse the canonical graph's claims and their evidence spans, so
 * every grounding invariant holds. Mutants deliberately violate one rule at
 * a time for red tests.
 */

import { readFileSync } from 'node:fs';
import {
  CONTRACTS_VERSION,
  OverviewPlanSchema,
  validateOverviewPlan,
  type AudioTurn,
  type AudioTurnPurpose,
  type ClaimRecord,
  type CoverageEntry,
  type Id,
  type OverviewPlan,
  type OmittedClaim,
  type SemanticGraph,
  type SourceArtifact,
  type SpeakerRole,
  type TurnStyle,
  type UtcTimestamp,
} from '../../src/contracts';

export const CANONICAL_PLAN: OverviewPlan = JSON.parse(
  readFileSync('fixtures/contracts/plan-audio-deep-dive-5min.json', 'utf8'),
) as OverviewPlan;
export const CANONICAL_GRAPH: SemanticGraph = JSON.parse(
  readFileSync('fixtures/contracts/reference-messy-note.semantic-graph.json', 'utf8'),
) as SemanticGraph;
export const CANONICAL_SOURCE: SourceArtifact = JSON.parse(
  readFileSync('fixtures/contracts/reference-messy-note.source-artifact.json', 'utf8'),
) as SourceArtifact;

export const FIXED_SEED = 'wflx-w2-audio-test-seed';
export const FIXED_SEED_ALT = 'wflx-w2-audio-test-seed-alt';
export const FIXED_NOW: UtcTimestamp = '2026-01-01T00:00:00Z';

/** Fixed default: matches the fixtures' convention (regenerable sidecars). */
export const CLAIMS_BY_ID: ReadonlyMap<Id, ClaimRecord> = new Map(
  CANONICAL_GRAPH.claims.map((claim) => [claim.id, claim]),
);

// ---------------------------------------------------------------------------
// Stand-in plan builder
// ---------------------------------------------------------------------------

interface TurnSpec {
  readonly id: string;
  readonly speakerRole: SpeakerRole;
  readonly purpose: AudioTurnPurpose;
  readonly brief: string;
  readonly claimIds: readonly Id[];
  readonly beatId: Id;
  readonly targetDurationSeconds: number;
  readonly delivery?: string;
  readonly emphasis?: string;
}

interface BeatSpec {
  readonly id: Id;
  readonly title: string;
  readonly purpose: string;
  readonly brief: string;
  readonly claimIds: readonly Id[];
  readonly topicIds: readonly Id[];
  readonly weight: number;
}

interface StandinPlanSpec {
  readonly id: Id;
  readonly mode: 'deep-dive' | 'brief' | 'critique' | 'debate';
  readonly objective: string;
  readonly targetDurationSeconds: number;
  readonly tone: string;
  readonly beats: readonly BeatSpec[];
  readonly turns: readonly TurnSpec[];
}

/** Every claim the turns ground, for coverage accounting. */
function claimsUsedBy(turns: readonly TurnSpec[]): Set<Id> {
  const used = new Set<Id>();
  for (const turn of turns) {
    for (const claimId of turn.claimIds) used.add(claimId);
  }
  return used;
}

function styleFor(spec: TurnSpec): TurnStyle {
  return {
    delivery: spec.delivery ?? 'clear, conversational',
    ...(spec.emphasis !== undefined ? { emphasis: spec.emphasis } : {}),
  };
}

/** Build a valid, deep-validatable stand-in plan over the canonical graph. */
export function buildStandinPlan(spec: StandinPlanSpec): OverviewPlan {
  const used = claimsUsedBy(spec.turns);
  const covered: CoverageEntry[] = [...used].map((claimId) => ({
    claimId,
    role: 'primary' as const,
    unitIds: spec.turns.filter((turn) => turn.claimIds.includes(claimId)).map((turn) => turn.id),
  }));
  const omitted: OmittedClaim[] = CANONICAL_GRAPH.claims
    .filter((claim) => !used.has(claim.id))
    .map((claim) => ({
      claimId: claim.id,
      reason: `below salience threshold at ${spec.targetDurationSeconds} s ${spec.mode} budget`,
    }));

  const turns: AudioTurn[] = spec.turns.map((turn, i) => {
    const evidence = turn.claimIds
      .map((claimId) => CLAIMS_BY_ID.get(claimId)?.evidence[0])
      .filter((span): span is NonNullable<typeof span> => span !== undefined);
    return {
      recordType: 'AudioTurn' as const,
      contractVersion: CONTRACTS_VERSION,
      id: turn.id,
      index: i,
      speaker: turn.speakerRole === 'host-a' ? 'Host A' : 'Host B',
      speakerRole: turn.speakerRole,
      purpose: turn.purpose,
      brief: turn.brief,
      claimIds: [...turn.claimIds],
      evidence,
      beatId: turn.beatId,
      style: styleFor(turn),
      targetDurationSeconds: turn.targetDurationSeconds,
    };
  });

  const plan: OverviewPlan = {
    recordType: 'OverviewPlan',
    contractVersion: CONTRACTS_VERSION,
    id: spec.id,
    sourceIds: [...CANONICAL_PLAN.sourceIds],
    modality: 'audio',
    mode: spec.mode,
    objective: spec.objective,
    audience: 'technical',
    language: 'en',
    targetDurationSeconds: spec.targetDurationSeconds,
    style: {
      tone: spec.tone,
      register: 'plain-technical',
      pacing: 'measured',
      speakerCount: 2,
    },
    coverage: { covered, omitted },
    beats: spec.beats.map((beat, i) => ({
      id: beat.id,
      index: i,
      title: beat.title,
      purpose: beat.purpose,
      brief: beat.brief,
      claimIds: [...beat.claimIds],
      topicIds: [...beat.topicIds],
      weight: beat.weight,
    })),
    audioTurns: turns,
    videoScenes: [],
    generator: {
      name: 'wflx-w2-audio-standin-builder',
      version: '1.0.0',
      seed: `wflx-audio-local-${spec.mode}`,
      deterministic: true,
    },
    createdAt: FIXED_NOW,
    notes: `AUDIO-LOCAL STAND-IN (non-canonical): ${spec.mode} mode scaffolding for mode-semantics predicates; canonical per-mode fixtures are a DESIGN.md §16.4 item 2 HANDOFF.`,
  };

  // Builder honesty: the stand-in must pass the frozen guard AND deep checks.
  const guard = OverviewPlanSchema.safeParse(plan);
  if (!guard.success) {
    throw new Error(`stand-in plan failed guard: ${guard.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
  }
  const deep = validateOverviewPlan(plan, CANONICAL_GRAPH, CANONICAL_SOURCE);
  if (!deep.valid) {
    throw new Error(`stand-in plan failed deep validation: ${deep.issues.map((i) => `${i.path}: ${i.message}`).join('; ')}`);
  }
  return plan;
}

// ---------------------------------------------------------------------------
// Brief stand-in (H-A-01): compact headline structure, top-k claims only.
// ---------------------------------------------------------------------------

export function buildBriefPlan(): OverviewPlan {
  return buildStandinPlan({
    id: 'plan-messy-note-audio-brief-90s-standin',
    mode: 'brief',
    objective: 'A tight Brief of the messy note: headline claims only.',
    targetDurationSeconds: 90,
    tone: 'crisp, headline-first, conversational',
    beats: [
      {
        id: 'beat-open',
        title: 'The headline',
        purpose: 'Frame the brief.',
        brief: 'Open with the single most important claim.',
        claimIds: ['claim-tool-catalog'],
        topicIds: ['topic-tool-catalog'],
        weight: 0.12,
      },
      {
        id: 'beat-core',
        title: 'Core claims',
        purpose: 'Deliver the top-emphasis claims compactly.',
        brief: 'One compact exchange per selected claim; no examples.',
        claimIds: ['claim-purpose', 'claim-infra-stack', 'claim-multi-agent-orchestration', 'claim-oss-runtimes'],
        topicIds: ['topic-purpose', 'topic-infrastructure', 'topic-architecture-workflows', 'topic-tool-catalog'],
        weight: 0.76,
      },
      {
        id: 'beat-close',
        title: 'The upshot',
        purpose: 'Single takeaway.',
        brief: 'One takeaway, no summary walk.',
        claimIds: ['claim-purpose'],
        topicIds: ['topic-purpose'],
        weight: 0.12,
      },
    ],
    turns: [
      { id: 'b-turn-1', speakerRole: 'host-a', purpose: 'framing', brief: 'Frame the brief around the headline claim. Anchors: The source contains a mixed catalog of AI tools covering video, image, voice and music generation.', claimIds: ['claim-tool-catalog'], beatId: 'beat-open', targetDurationSeconds: 12 },
      { id: 'b-turn-2', speakerRole: 'host-b', purpose: 'explanation', brief: 'State the purpose claim compactly. Anchors: The stated purpose of the note is to test semantic organization, source-grounded planning.', claimIds: ['claim-purpose'], beatId: 'beat-core', targetDurationSeconds: 15 },
      { id: 'b-turn-3', speakerRole: 'host-a', purpose: 'question', brief: 'One compact clarifying question on infrastructure. Anchors: The infrastructure notes name Cloudflare/object storage, Postgres/Neon, LLM providers.', claimIds: ['claim-infra-stack'], beatId: 'beat-core', targetDurationSeconds: 12 },
      { id: 'b-turn-4', speakerRole: 'host-b', purpose: 'explanation', brief: 'Answer with the infrastructure claim. Anchors: The infrastructure notes name Cloudflare/object storage, Postgres/Neon, LLM providers.', claimIds: ['claim-infra-stack'], beatId: 'beat-core', targetDurationSeconds: 15 },
      { id: 'b-turn-5', speakerRole: 'host-a', purpose: 'explanation', brief: 'State the multi-agent claim compactly. Anchors: The architecture section discusses multi-agent orchestration.', claimIds: ['claim-multi-agent-orchestration'], beatId: 'beat-core', targetDurationSeconds: 15 },
      { id: 'b-turn-6', speakerRole: 'host-b', purpose: 'explanation', brief: 'State the open-source claim compactly. Anchors: The catalog also includes open-source media projects, local model runtimes and model catalogs.', claimIds: ['claim-oss-runtimes'], beatId: 'beat-core', targetDurationSeconds: 15 },
      { id: 'b-turn-7', speakerRole: 'host-a', purpose: 'conclusion', brief: 'One takeaway from the purpose claim. Anchors: The stated purpose of the note is to test semantic organization, source-grounded planning.', claimIds: ['claim-purpose'], beatId: 'beat-close', targetDurationSeconds: 6 },
    ],
  });
}

// ---------------------------------------------------------------------------
// Critique stand-in (H-A-02): assessment/limitation/verdict structure.
// ---------------------------------------------------------------------------

export function buildCritiquePlan(): OverviewPlan {
  return buildStandinPlan({
    id: 'plan-messy-note-audio-critique-300s-standin',
    mode: 'critique',
    objective: 'Stress-test the messy note: what holds, what is missing, verdict.',
    targetDurationSeconds: 300,
    tone: 'evaluative, rigorous, fair',
    beats: [
      { id: 'c-beat-open', title: 'Why we are poking at this', purpose: 'Evaluative framing.', brief: 'Frame the episode as a stress test, not a summary.', claimIds: ['claim-purpose'], topicIds: ['topic-purpose'], weight: 0.1 },
      { id: 'c-beat-catalog', title: 'Catalog under scrutiny', purpose: 'Assess the catalog claims.', brief: 'Assess what holds in the tool catalog cluster and name limitations.', claimIds: ['claim-tool-catalog', 'claim-oss-runtimes', 'claim-forecasting-projects'], topicIds: ['topic-tool-catalog'], weight: 0.3 },
      { id: 'c-beat-infra', title: 'Infrastructure under scrutiny', purpose: 'Assess infrastructure claims.', brief: 'Assess the infrastructure cluster; the credentials constraint is the obvious limitation.', claimIds: ['claim-infra-stack', 'claim-credentials-redacted'], topicIds: ['topic-infrastructure'], weight: 0.25 },
      { id: 'c-beat-arch', title: 'Architecture under scrutiny', purpose: 'Assess architecture claims.', brief: 'Assess the architecture/workflow cluster.', claimIds: ['claim-multi-agent-orchestration', 'claim-audits', 'claim-sandbox-limits'], topicIds: ['topic-architecture-workflows'], weight: 0.25 },
      { id: 'c-beat-verdict', title: 'The verdict', purpose: 'Balanced judgment.', brief: 'Weigh the evidence and deliver the verdict.', claimIds: ['claim-purpose'], topicIds: ['topic-purpose'], weight: 0.1 },
    ],
    turns: [
      { id: 'c-turn-1', speakerRole: 'host-a', purpose: 'framing', brief: 'Frame as evaluation: we are here to stress-test this source. Anchors: The stated purpose of the note is to test semantic organization, source-grounded planning.', claimIds: ['claim-purpose'], beatId: 'c-beat-open', targetDurationSeconds: 20 },
      { id: 'c-turn-2', speakerRole: 'host-b', purpose: 'explanation', brief: 'Assess what holds in the catalog cluster. Anchors: The source contains a mixed catalog of AI tools covering video, image, voice and music generation.', claimIds: ['claim-tool-catalog'], beatId: 'c-beat-catalog', targetDurationSeconds: 25 },
      { id: 'c-turn-3', speakerRole: 'host-a', purpose: 'explanation', brief: 'Name the limitation: the catalog claim is broad but the source does not address depth or quality per tool. Anchors: The catalog also includes open-source media projects, local model runtimes and model catalogs.', claimIds: ['claim-oss-runtimes'], beatId: 'c-beat-catalog', targetDurationSeconds: 25 },
      { id: 'c-turn-4', speakerRole: 'host-b', purpose: 'question', brief: 'Press on the forecasting claim. Anchors: The catalog extends to forecasting and digital-twin/world-monitoring projects.', claimIds: ['claim-forecasting-projects'], beatId: 'c-beat-catalog', targetDurationSeconds: 15 },
      { id: 'c-turn-5', speakerRole: 'host-a', purpose: 'clarification', brief: 'Clarify what the evidence supports for forecasting. Anchors: The catalog extends to forecasting and digital-twin/world-monitoring projects.', claimIds: ['claim-forecasting-projects'], beatId: 'c-beat-catalog', targetDurationSeconds: 15 },
      { id: 'c-turn-6', speakerRole: 'host-b', purpose: 'explanation', brief: 'Assess the infrastructure claim. Anchors: The infrastructure notes name Cloudflare/object storage, Postgres/Neon, LLM providers.', claimIds: ['claim-infra-stack'], beatId: 'c-beat-infra', targetDurationSeconds: 25 },
      { id: 'c-turn-7', speakerRole: 'host-a', purpose: 'explanation', brief: 'Name the limitation: all credentials are redacted, so operational claims cannot be verified. Anchors: All credentials in the source are redacted.', claimIds: ['claim-credentials-redacted'], beatId: 'c-beat-infra', targetDurationSeconds: 25 },
      { id: 'c-turn-8', speakerRole: 'host-b', purpose: 'explanation', brief: 'Assess the multi-agent claim. Anchors: The architecture section discusses multi-agent orchestration.', claimIds: ['claim-multi-agent-orchestration'], beatId: 'c-beat-arch', targetDurationSeconds: 25 },
      { id: 'c-turn-9', speakerRole: 'host-a', purpose: 'explanation', brief: 'Assess the audit claim and its limits. Anchors: The workflows include security/integrity audits.', claimIds: ['claim-audits'], beatId: 'c-beat-arch', targetDurationSeconds: 20 },
      { id: 'c-turn-10', speakerRole: 'host-b', purpose: 'explanation', brief: 'Assess the sandbox-limits claim. Anchors: Sandbox and resource limits are discussed as architectural guardrails.', claimIds: ['claim-sandbox-limits'], beatId: 'c-beat-arch', targetDurationSeconds: 20 },
      { id: 'c-turn-11', speakerRole: 'host-a', purpose: 'question', brief: 'Cross-check what the source does not address: integration depth. Anchors: Provider integrations are part of the discussed architecture and workflows.', claimIds: ['claim-provider-integrations'], beatId: 'c-beat-arch', targetDurationSeconds: 15 },
      { id: 'c-turn-12', speakerRole: 'host-b', purpose: 'explanation', brief: 'Weigh the deployment claim. Anchors: The source covers deployment pipelines, operational loops and execution workflows.', claimIds: ['claim-deployment-pipelines'], beatId: 'c-beat-arch', targetDurationSeconds: 20 },
      { id: 'c-turn-13', speakerRole: 'host-a', purpose: 'conclusion', brief: 'Deliver the verdict: the note holds as a plan sketch but is thin on evidence; weigh it accordingly. Anchors: The stated purpose of the note is to test semantic organization, source-grounded planning.', claimIds: ['claim-purpose'], beatId: 'c-beat-verdict', targetDurationSeconds: 25 },
      { id: 'c-turn-14', speakerRole: 'host-b', purpose: 'conclusion', brief: 'Final verdict framing on what a reader should trust. Anchors: All credentials in the source are redacted.', claimIds: ['claim-credentials-redacted'], beatId: 'c-beat-verdict', targetDurationSeconds: 20 },
    ],
  });
}

// ---------------------------------------------------------------------------
// Debate stand-in (H-A-03): positions, rebuttals, cross-examination.
// ---------------------------------------------------------------------------

export interface DebateBuildOptions {
  /** RED-test switch: rebuttals cite the SAME claims as the positions they rebut. */
  readonly rebuttalRestates?: boolean;
}

export function buildDebatePlan(options: DebateBuildOptions = {}): OverviewPlan {
  const restates = options.rebuttalRestates === true;
  // Grounded positions over genuinely differing claim pairs:
  //   pro  = the catalog leans open/forward-looking (oss-runtimes + forecasting)
  //   con  = the catalog is a broad mixed bag with operational gaps (tool-catalog + credentials)
  const proClaims: Id[] = ['claim-oss-runtimes', 'claim-forecasting-projects'];
  const conClaims: Id[] = ['claim-tool-catalog', 'claim-credentials-redacted'];
  const rebuttalClaims: Id[] = restates ? proClaims.slice(0, 1) : ['claim-infra-stack', 'claim-sandbox-limits'];
  return buildStandinPlan({
    id: restates
      ? 'plan-messy-note-audio-debate-240s-standin-red'
      : 'plan-messy-note-audio-debate-240s-standin',
    mode: 'debate',
    objective: 'Debate the motion: the messy note describes a coherent, open-leaning platform plan.',
    targetDurationSeconds: 240,
    tone: 'sharp, evidence-bound, fair',
    beats: [
      { id: 'd-beat-motion', title: 'The motion', purpose: 'State the motion and positions.', brief: 'Motion from the purpose claim; each host stakes a position.', claimIds: ['claim-purpose'], topicIds: ['topic-purpose'], weight: 0.15 },
      { id: 'd-beat-argue', title: 'The argument', purpose: 'Position, rebuttal, cross-examination.', brief: 'Evidence-bound argument over the contested framing.', claimIds: ['claim-oss-runtimes', 'claim-forecasting-projects', 'claim-tool-catalog', 'claim-credentials-redacted', 'claim-infra-stack', 'claim-sandbox-limits'], topicIds: ['topic-tool-catalog', 'topic-infrastructure', 'topic-architecture-workflows'], weight: 0.65 },
      { id: 'd-beat-agreement', title: 'Points of agreement', purpose: 'Jointly state the uncontested core.', brief: 'What both sides accept on the evidence.', claimIds: ['claim-audits', 'claim-provider-integrations'], topicIds: ['topic-architecture-workflows'], weight: 0.2 },
    ],
    turns: [
      { id: 'd-turn-1', speakerRole: 'host-a', purpose: 'framing', brief: 'State the motion from the purpose claim. Anchors: The stated purpose of the note is to test semantic organization, source-grounded planning.', claimIds: ['claim-purpose'], beatId: 'd-beat-motion', targetDurationSeconds: 18 },
      { id: 'd-turn-2', speakerRole: 'host-b', purpose: 'framing', brief: 'Opening position, con: argue against the motion — the catalog is a mixed bag. Anchors: The source contains a mixed catalog of AI tools covering video, image, voice and music generation.', claimIds: conClaims, beatId: 'd-beat-motion', targetDurationSeconds: 25 },
      { id: 'd-turn-3', speakerRole: 'host-a', purpose: 'framing', brief: 'Opening position, pro: argue in favor of the motion — the plan leans open and forward-looking. Anchors: The catalog also includes open-source media projects, local model runtimes and model catalogs.', claimIds: proClaims, beatId: 'd-beat-motion', targetDurationSeconds: 25 },
      { id: 'd-turn-4', speakerRole: 'host-b', purpose: 'clarification', brief: 'Rebut the pro position with different evidence: the operational side is under-specified. Anchors: The infrastructure notes name Cloudflare/object storage, Postgres/Neon, LLM providers.', claimIds: restates ? proClaims : rebuttalClaims.slice(0, 1), beatId: 'd-beat-argue', targetDurationSeconds: 22 },
      { id: 'd-turn-5', speakerRole: 'host-a', purpose: 'question', brief: 'Cross-examine the con position: press on the credentials constraint. Anchors: All credentials in the source are redacted.', claimIds: ['claim-credentials-redacted'], beatId: 'd-beat-argue', targetDurationSeconds: 15 },
      { id: 'd-turn-6', speakerRole: 'host-b', purpose: 'clarification', brief: 'Concede the redaction limits verification, but hold the position. Anchors: All credentials in the source are redacted.', claimIds: ['claim-credentials-redacted'], beatId: 'd-beat-argue', targetDurationSeconds: 15 },
      { id: 'd-turn-7', speakerRole: 'host-a', purpose: 'clarification', brief: 'Rebut the con framing: guardrails exist. Anchors: Sandbox and resource limits are discussed as architectural guardrails.', claimIds: restates ? proClaims : rebuttalClaims.slice(1, 2), beatId: 'd-beat-argue', targetDurationSeconds: 20 },
      { id: 'd-turn-8', speakerRole: 'host-b', purpose: 'question', brief: 'Cross-examine the pro side on deployment reality. Anchors: The source covers deployment pipelines, operational loops and execution workflows.', claimIds: ['claim-deployment-pipelines'], beatId: 'd-beat-argue', targetDurationSeconds: 15 },
      { id: 'd-turn-9', speakerRole: 'host-a', purpose: 'clarification', brief: 'Respond to the cross-examination with the pipelines evidence. Anchors: The source covers deployment pipelines, operational loops and execution workflows.', claimIds: ['claim-deployment-pipelines'], beatId: 'd-beat-argue', targetDurationSeconds: 20 },
      { id: 'd-turn-10', speakerRole: 'host-b', purpose: 'synthesis', brief: 'Points of agreement: both sides accept the audits are real. Anchors: The workflows include security/integrity audits.', claimIds: ['claim-audits'], beatId: 'd-beat-agreement', targetDurationSeconds: 20 },
      { id: 'd-turn-11', speakerRole: 'host-a', purpose: 'synthesis', brief: 'Points of agreement: provider integrations are part of the plan. Anchors: Provider integrations are part of the discussed architecture and workflows.', claimIds: ['claim-provider-integrations'], beatId: 'd-beat-agreement', targetDurationSeconds: 20 },
      { id: 'd-turn-12', speakerRole: 'host-b', purpose: 'conclusion', brief: 'Judged synthesis: weigh the evidence, no artificial winner. Anchors: The stated purpose of the note is to test semantic organization, source-grounded planning.', claimIds: ['claim-purpose'], beatId: 'd-beat-agreement', targetDurationSeconds: 25 },
    ],
  });
}

// ---------------------------------------------------------------------------
// Short benchmark plan (audio-local; committed benchmark artifact input)
// ---------------------------------------------------------------------------

export function buildShortBenchmarkPlan(): OverviewPlan {
  return buildStandinPlan({
    id: 'plan-messy-note-audio-deep-dive-42s-benchmark',
    mode: 'deep-dive',
    objective: 'A short, fully deterministic deep-dive benchmark over the messy note.',
    targetDurationSeconds: 42,
    tone: 'curious, expert, conversational',
    beats: [
      { id: 's-beat-open', title: 'Why this note exists', purpose: 'Opening.', brief: 'Frame and explain the purpose claim.', claimIds: ['claim-purpose'], topicIds: ['topic-purpose'], weight: 0.35 },
      { id: 's-beat-core', title: 'The tool catalog', purpose: 'Core exchange.', brief: 'Explain the catalog with a question and an example.', claimIds: ['claim-tool-catalog', 'claim-oss-runtimes'], topicIds: ['topic-tool-catalog'], weight: 0.45 },
      { id: 's-beat-close', title: 'Takeaway', purpose: 'Closing takeaway.', brief: 'One grounded takeaway.', claimIds: ['claim-purpose'], topicIds: ['topic-purpose'], weight: 0.2 },
    ],
    turns: [
      { id: 's-turn-1', speakerRole: 'host-a', purpose: 'framing', brief: 'Open the segment and orient the listener. Anchors: The stated purpose of the note is to test semantic organization, source-grounded planning.', claimIds: ['claim-purpose'], beatId: 's-beat-open', targetDurationSeconds: 8 },
      { id: 's-turn-2', speakerRole: 'host-b', purpose: 'explanation', brief: 'Explain, grounded in the source. Anchors: The source contains a mixed catalog of AI tools covering video, image, voice and music generation.', claimIds: ['claim-tool-catalog'], beatId: 's-beat-core', targetDurationSeconds: 10 },
      { id: 's-turn-3', speakerRole: 'host-a', purpose: 'question', brief: "Put the listener's question. Anchors: The catalog also includes open-source media projects, local model runtimes and model catalogs.", claimIds: ['claim-oss-runtimes'], beatId: 's-beat-core', targetDurationSeconds: 8 },
      { id: 's-turn-4', speakerRole: 'host-b', purpose: 'example', brief: 'Give a grounded example. Anchors: The catalog also includes open-source media projects, local model runtimes and model catalogs.', claimIds: ['claim-oss-runtimes'], beatId: 's-beat-core', targetDurationSeconds: 8 },
      { id: 's-turn-5', speakerRole: 'host-a', purpose: 'conclusion', brief: 'Takeaway. Anchors: The stated purpose of the note is to test semantic organization, source-grounded planning.', claimIds: ['claim-purpose'], beatId: 's-beat-close', targetDurationSeconds: 8 },
    ],
  });
}

// ---------------------------------------------------------------------------
// Mutants (one violated rule each — red tests)
// ---------------------------------------------------------------------------

function clonePlan(plan: OverviewPlan): OverviewPlan {
  return JSON.parse(JSON.stringify(plan)) as OverviewPlan;
}

/** Escape hatch for one-rule-at-a-time mutants (tests only). */
function asWritable(turn: AudioTurn): Record<string, unknown> {
  return turn as unknown as Record<string, unknown>;
}

/** RED: a turn cites a claim id that does not exist in the graph. */
export function mutantDanglingClaimRef(): OverviewPlan {
  const plan = clonePlan(CANONICAL_PLAN);
  const turn = plan.audioTurns[3];
  if (turn === undefined) throw new Error('mutant: missing turn');
  asWritable(turn).claimIds = ['claim-does-not-exist'];
  // Keep W1 deep validation blind to the audio layer? No — deep validation
  // catches this too (s08). To exercise the W2 boundary in isolation the
  // mutant is passed straight to buildValidatedDialogueGraph; callers that
  // run the full compiler hit W1 validation first. Both are red paths.
  return plan;
}

/** RED: a factual turn (explanation) with zero claim ids. */
export function mutantUngroundedFactualTurn(): OverviewPlan {
  const plan = clonePlan(CANONICAL_PLAN);
  const turn = plan.audioTurns[1];
  if (turn === undefined) throw new Error('mutant: missing turn');
  asWritable(turn).claimIds = [];
  asWritable(turn).evidence = [];
  // claim-purpose stays covered by sibling turns, so W1 deep validation
  // passes and the W2 grounding rule is the violated layer.
  return plan;
}

/** RED: rebuttal restates the position (debate). */
export function mutantDebateRebuttalRestatement(): OverviewPlan {
  return buildDebatePlan({ rebuttalRestates: true });
}

/**
 * RED: parity-rigid speaker pattern (strict ABAB) — surfaces as QA
 * `alternation-run-long`, feeding back to the Director (plan authority).
 */
export function mutantParityRigid(): OverviewPlan {
  const plan = clonePlan(CANONICAL_PLAN);
  plan.audioTurns.forEach((turn, i) => {
    const role: SpeakerRole = i % 2 === 0 ? 'host-a' : 'host-b';
    asWritable(turn).speakerRole = role;
    asWritable(turn).speaker = role === 'host-a' ? 'Host A' : 'Host B';
  });
  return plan;
}

/** RED: a turn whose mandatory anchors cannot fit its budget (over-budget). */
export function mutantOverBudgetTurn(): OverviewPlan {
  const plan = clonePlan(CANONICAL_PLAN);
  const turn = plan.audioTurns[5];
  if (turn === undefined) throw new Error('mutant: missing turn');
  // Many claims, tiny duration: anchors cannot fit the mode rate ceiling.
  asWritable(turn).claimIds = [
    'claim-tool-catalog',
    'claim-oss-runtimes',
    'claim-forecasting-projects',
    'claim-infra-stack',
    'claim-multi-agent-orchestration',
    'claim-audits',
    'claim-provider-integrations',
  ];
  asWritable(turn).targetDurationSeconds = 3;
  // Re-balance the duration sum inside W1 tolerance by trimming a neighbor.
  const neighbor = plan.audioTurns[6];
  if (neighbor !== undefined) {
    asWritable(neighbor).targetDurationSeconds = neighbor.targetDurationSeconds + 15.75;
  }
  return plan;
}

/** RED: plan covers a claim that no turn grounds (coverage-gap). */
export function mutantCoverageGap(): OverviewPlan {
  const plan = clonePlan(CANONICAL_PLAN);
  // Strip claim-forecasting-projects from every turn but keep it covered.
  for (const turn of plan.audioTurns) {
    asWritable(turn).claimIds = turn.claimIds.filter((id) => id !== 'claim-forecasting-projects');
  }
  return plan;
}
