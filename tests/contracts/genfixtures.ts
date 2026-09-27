/**
 * Canonical contract fixture generator (WFLX-W1, Stage 1).
 *
 * Usage: bun run fixtures:gen
 *
 * Deterministic by construction: fixed timestamps, fixed ids, hashes computed
 * from content. Regenerating must be byte-identical to the checked-in files
 * (enforced by tests/contracts/fixtures.test.ts).
 *
 * The messy-note SourceArtifact is parsed from
 * fixtures/reference-messy-note-redacted.md with a minimal, builder-internal
 * markdown block parser. The Stage-2 MarkdownNoteAdapter must reproduce this
 * fixture byte-identically (adapter-parity test lives in tests/source/).
 *
 * The semantic graph is hand-grounded in the fixture text (claims, entities,
 * topics, relationships with exact evidence spans). It is the Stage-2
 * DeterministicExtractor ground truth.
 *
 * Credential hygiene: no credential-shaped strings appear here or in any
 * generated fixture; the redacted note only contains `[REDACTED]` markers.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { z } from 'zod';
import { compileOverviewPlan } from '../../src/director/compiler';
import {
  CONTRACTS_VERSION,
  countWords,
  ExperimentRecordSchema,
  GeneratedArtifactSchema,
  OverviewPlanSchema,
  SemanticGraphSchema,
  sha256Hex,
  SourceArtifactSchema,
  validateOverviewPlan,
  validateSemanticGraph,
  validateSourceArtifact,
  type AudioTurn,
  type AudioTurnPurpose,
  type ClaimRecord,
  type EntityKind,
  type EntityRecord,
  type EvidenceSpan,
  type ExperimentRecord,
  type GeneratedArtifact,
  type NarrativeBeat,
  type OverviewPlan,
  type RelationshipRecord,
  type SceneMotion,
  type SceneTextItem,
  type SceneTransition,
  type SemanticGraph,
  type SpeakerRole,
  type SourceArtifact,
  type SourceBlock,
  type TopicRecord,
  type VideoScene,
  type VisualType,
} from '../../src/contracts';

const FIXED_TS = '2026-09-26T00:00:00Z';
const OUT_DIR = 'fixtures/contracts';
const RAW_FIXTURE_PATH = 'fixtures/reference-messy-note-redacted.md';
const MESSY_SOURCE_ID = 'source-messy-note-redacted';
const MINIMAL_SOURCE_ID = 'source-minimal';

// ---------------------------------------------------------------------------
// Minimal markdown block parser (builder-internal; Stage-2 adapter must match)
// ---------------------------------------------------------------------------

function normalizeRaw(raw: string): string {
  return raw
    .normalize('NFC')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+$/gm, '')
    .trimEnd();
}

interface ParsedBlock {
  kind: 'heading' | 'paragraph' | 'list-item';
  text: string;
  start: number;
  end: number;
  level?: number;
}

/** Line-based parse: each non-blank line is one block; spans include markers. */
function parseBlocks(text: string): ParsedBlock[] {
  const blocks: ParsedBlock[] = [];
  let offset = 0;
  for (const line of text.split('\n')) {
    const lineStart = offset;
    offset += line.length + 1; // +1 for the newline
    if (line.trim().length === 0) continue;
    const start = lineStart + (line.length - line.trimStart().length);
    const content = line.trim();
    const end = start + content.length;
    const heading = /^#{1,6}\s/.exec(content);
    if (heading) {
      const level = heading[0].trim().length;
      blocks.push({ kind: 'heading', text: content, start, end, level });
    } else if (/^[-*+]\s/.test(content)) {
      blocks.push({ kind: 'list-item', text: content, start, end });
    } else {
      blocks.push({ kind: 'paragraph', text: content, start, end });
    }
  }
  return blocks;
}

function makeSourceArtifact(params: {
  id: string;
  title: string;
  kind: SourceArtifact['provenance']['kind'];
  label: string;
  raw: string;
}): SourceArtifact {
  const text = normalizeRaw(params.raw);
  const parsed = parseBlocks(text);
  const blocks: SourceBlock[] = parsed.map((b, i) => ({
    id: `b${i + 1}`,
    kind: b.kind,
    text: b.text,
    start: b.start,
    end: b.end,
    ...(b.level !== undefined ? { level: b.level } : {}),
  }));
  return {
    recordType: 'SourceArtifact',
    contractVersion: CONTRACTS_VERSION,
    id: params.id,
    title: params.title,
    provenance: {
      kind: params.kind,
      label: params.label,
      authorization: 'user-provided',
    },
    fingerprint: {
      contentSha256: sha256Hex(text),
      rawSha256: sha256Hex(params.raw),
      textLength: text.length,
    },
    text,
    blocks,
    language: 'en',
    wordCount: countWords(text),
    createdAt: FIXED_TS,
    normalizer: 'fixture-builder@1.0.0',
  };
}

// ---------------------------------------------------------------------------
// Messy-note source fixture
// ---------------------------------------------------------------------------

const messyRaw = readFileSync(RAW_FIXTURE_PATH, 'utf8');
const messySource = makeSourceArtifact({
  id: MESSY_SOURCE_ID,
  title: 'Reference Fixture — Redacted Messy Note',
  kind: 'markdown-note',
  label: 'fixtures/reference-messy-note-redacted.md',
  raw: messyRaw,
});

/** Find the single block containing needle; throws on zero or multiple hits. */
function blockWith(needle: string): SourceBlock {
  const hits = messySource.blocks.filter((b) => b.text.includes(needle));
  if (hits.length !== 1) {
    throw new Error(`expected exactly one block containing ${JSON.stringify(needle)}, got ${hits.length}`);
  }
  return hits[0] as SourceBlock;
}

/** Evidence span for an exact surface inside its (unique) block. */
function spanFor(needle: string): EvidenceSpan {
  const block = blockWith(needle);
  const at = block.text.indexOf(needle);
  if (at < 0) throw new Error(`needle not found: ${needle}`);
  const start = block.start + at;
  return {
    sourceId: MESSY_SOURCE_ID,
    blockId: block.id,
    start,
    end: start + needle.length,
    quote: needle,
  };
}

/** Evidence span covering an entire block. */
function blockSpan(needle: string): EvidenceSpan {
  const block = blockWith(needle);
  return {
    sourceId: MESSY_SOURCE_ID,
    blockId: block.id,
    start: block.start,
    end: block.end,
    quote: block.text,
  };
}

function blockRefsBetween(startNeedle: string, endNeedle: string): { sourceId: string; blockId: string }[] {
  const start = messySource.blocks.findIndex((b) => b.text.includes(startNeedle));
  const end = messySource.blocks.findIndex((b) => b.text.includes(endNeedle));
  if (start < 0 || end < 0 || end < start) throw new Error('bad block range');
  return messySource.blocks.slice(start, end + 1).map((b) => ({ sourceId: MESSY_SOURCE_ID, blockId: b.id }));
}

// ---------------------------------------------------------------------------
// Messy-note semantic graph (hand-grounded ground truth)
// ---------------------------------------------------------------------------

interface EntitySpec {
  id: string;
  name: string;
  kind: EntityKind;
  surface: string;
  aliases?: string[];
}

const ENTITY_SPECS: EntitySpec[] = [
  { id: 'entity-ai-video-tools', name: 'AI video tools', kind: 'tool', surface: 'AI video tools' },
  { id: 'entity-voice-generation', name: 'voice generation', kind: 'technology', surface: 'voice generation' },
  { id: 'entity-agent-tool-systems', name: 'agent tool systems', kind: 'technology', surface: 'agent tool systems' },
  { id: 'entity-local-model-runtimes', name: 'local model runtimes', kind: 'technology', surface: 'local model runtimes' },
  { id: 'entity-model-catalogs', name: 'model catalogs', kind: 'concept', surface: 'model catalogs' },
  { id: 'entity-forecasting', name: 'forecasting', kind: 'concept', surface: 'forecasting' },
  { id: 'entity-digital-twin-projects', name: 'digital-twin/world-monitoring projects', kind: 'project', surface: 'digital-twin/world-monitoring projects' },
  { id: 'entity-cloudflare', name: 'Cloudflare', kind: 'infrastructure', surface: 'Cloudflare' },
  { id: 'entity-postgres', name: 'Postgres', kind: 'technology', surface: 'Postgres', aliases: ['PostgreSQL'] },
  { id: 'entity-neon', name: 'Neon', kind: 'service', surface: 'Neon' },
  { id: 'entity-llm-providers', name: 'LLM providers', kind: 'service', surface: 'LLM providers' },
  { id: 'entity-vercel', name: 'Vercel', kind: 'service', surface: 'Vercel' },
  { id: 'entity-github', name: 'GitHub', kind: 'service', surface: 'GitHub' },
  { id: 'entity-redis', name: 'Redis', kind: 'technology', surface: 'Redis' },
  { id: 'entity-browser-automation', name: 'browser automation', kind: 'technology', surface: 'browser automation' },
  { id: 'entity-realtime-infrastructure', name: 'realtime infrastructure', kind: 'infrastructure', surface: 'realtime infrastructure' },
  { id: 'entity-multi-agent-orchestration', name: 'multi-agent orchestration', kind: 'workflow', surface: 'multi-agent orchestration' },
  { id: 'entity-security-integrity-audits', name: 'security/integrity audits', kind: 'process', surface: 'security/integrity audits' },
  { id: 'entity-provider-integrations', name: 'provider integrations', kind: 'process', surface: 'provider integrations' },
  { id: 'entity-sandbox-resource-limits', name: 'sandbox/resource limits', kind: 'concept', surface: 'sandbox/resource limits' },
  { id: 'entity-deployment-pipelines', name: 'deployment pipelines', kind: 'process', surface: 'deployment pipelines' },
];

const entityById = new Map(ENTITY_SPECS.map((e) => [e.id, e] as const));

function mentionOf(spec: EntitySpec): EntityRecord['mentions'][number] {
  const block = blockWith(spec.surface);
  const at = block.text.indexOf(spec.surface);
  if (at < 0) throw new Error(`surface not found: ${spec.surface}`);
  const start = block.start + at;
  return {
    sourceId: MESSY_SOURCE_ID,
    blockId: block.id,
    start,
    end: start + spec.surface.length,
    text: spec.surface,
  };
}

const entities: EntityRecord[] = ENTITY_SPECS.map((spec) => ({
  recordType: 'EntityRecord',
  contractVersion: CONTRACTS_VERSION,
  id: spec.id,
  name: spec.name,
  kind: spec.kind,
  aliases: spec.aliases ?? [],
  mentions: [mentionOf(spec)],
}));

interface ClaimSpec {
  id: string;
  statement: string;
  kind: ClaimRecord['kind'];
  salience: number;
  evidenceNeedles: string[];
  /** true = needles are full blocks (paragraphs); false = exact surfaces. */
  wholeBlock?: boolean;
  entityIds: string[];
  topicIds: string[];
}

const CLAIM_SPECS: ClaimSpec[] = [
  {
    id: 'claim-tool-catalog',
    statement:
      'The source contains a mixed catalog of AI tools covering video, image, voice and music generation, editing, scraping/API access and agent tool systems.',
    kind: 'fact',
    salience: 1.0,
    evidenceNeedles: ['The source contains a mixed catalog of:', 'AI video tools', 'voice generation', 'agent tool systems'],
    wholeBlock: false,
    entityIds: ['entity-ai-video-tools', 'entity-voice-generation', 'entity-agent-tool-systems'],
    topicIds: ['topic-tool-catalog'],
  },
  {
    id: 'claim-oss-runtimes',
    statement: 'The catalog also includes open-source media projects, local model runtimes and model catalogs.',
    kind: 'fact',
    salience: 0.7,
    evidenceNeedles: ['open-source media projects', 'local model runtimes', 'model catalogs'],
    wholeBlock: false,
    entityIds: ['entity-local-model-runtimes', 'entity-model-catalogs'],
    topicIds: ['topic-tool-catalog'],
  },
  {
    id: 'claim-forecasting-projects',
    statement: 'The catalog extends to forecasting and digital-twin/world-monitoring projects.',
    kind: 'fact',
    salience: 0.6,
    evidenceNeedles: ['forecasting', 'digital-twin/world-monitoring projects'],
    wholeBlock: false,
    entityIds: ['entity-forecasting', 'entity-digital-twin-projects'],
    topicIds: ['topic-tool-catalog'],
  },
  {
    id: 'claim-infra-stack',
    statement:
      'The infrastructure notes name Cloudflare/object storage, Postgres/Neon, LLM providers, Vercel/GitHub, messaging, payments, Redis, compliance, browser automation and realtime infrastructure.',
    kind: 'fact',
    salience: 0.9,
    evidenceNeedles: [
      'Cloudflare/object storage',
      'Postgres/Neon',
      'LLM providers',
      'Vercel/GitHub',
      'Redis',
      'browser automation',
      'realtime infrastructure',
    ],
    wholeBlock: false,
    entityIds: [
      'entity-cloudflare',
      'entity-postgres',
      'entity-neon',
      'entity-llm-providers',
      'entity-vercel',
      'entity-github',
      'entity-redis',
      'entity-browser-automation',
      'entity-realtime-infrastructure',
    ],
    topicIds: ['topic-infrastructure'],
  },
  {
    id: 'claim-credentials-redacted',
    statement: 'All credentials in the source are redacted.',
    kind: 'constraint',
    salience: 0.3,
    evidenceNeedles: ['All credentials are `[REDACTED]`.'],
    wholeBlock: true,
    entityIds: [],
    topicIds: ['topic-infrastructure'],
  },
  {
    id: 'claim-multi-agent-orchestration',
    statement: 'The architecture section discusses multi-agent orchestration.',
    kind: 'fact',
    salience: 0.8,
    evidenceNeedles: ['multi-agent orchestration'],
    wholeBlock: false,
    entityIds: ['entity-multi-agent-orchestration'],
    topicIds: ['topic-architecture-workflows'],
  },
  {
    id: 'claim-audits',
    statement: 'The workflows include security/integrity audits.',
    kind: 'fact',
    salience: 0.5,
    evidenceNeedles: ['security/integrity audits'],
    wholeBlock: false,
    entityIds: ['entity-security-integrity-audits'],
    topicIds: ['topic-architecture-workflows'],
  },
  {
    id: 'claim-provider-integrations',
    statement: 'Provider integrations are part of the discussed architecture and workflows.',
    kind: 'process',
    salience: 0.5,
    evidenceNeedles: ['provider integrations'],
    wholeBlock: false,
    entityIds: ['entity-provider-integrations'],
    topicIds: ['topic-architecture-workflows'],
  },
  {
    id: 'claim-sandbox-limits',
    statement: 'Sandbox and resource limits are discussed as architectural guardrails.',
    kind: 'fact',
    salience: 0.4,
    evidenceNeedles: ['sandbox/resource limits'],
    wholeBlock: false,
    entityIds: ['entity-sandbox-resource-limits'],
    topicIds: ['topic-architecture-workflows'],
  },
  {
    id: 'claim-deployment-pipelines',
    statement: 'The source covers deployment pipelines, operational loops and execution workflows.',
    kind: 'process',
    salience: 0.5,
    evidenceNeedles: ['deployment pipelines', 'operational loops', 'execution workflows'],
    wholeBlock: false,
    entityIds: ['entity-deployment-pipelines'],
    topicIds: ['topic-architecture-workflows'],
  },
  {
    id: 'claim-purpose',
    statement:
      'The stated purpose of the note is to test semantic organization, source-grounded planning, visual metaphors, technical diagrams, multi-speaker explanation and video composition.',
    kind: 'goal',
    salience: 0.9,
    evidenceNeedles: ['Test semantic organization, source-grounded planning, visual metaphors, technical diagrams, multi-speaker explanation and video composition.'],
    wholeBlock: true,
    entityIds: [],
    topicIds: ['topic-purpose'],
  },
];

const claims: ClaimRecord[] = CLAIM_SPECS.map((spec) => ({
  recordType: 'ClaimRecord',
  contractVersion: CONTRACTS_VERSION,
  id: spec.id,
  statement: spec.statement,
  kind: spec.kind,
  evidence: spec.evidenceNeedles.map((needle) => (spec.wholeBlock ? blockSpan(needle) : spanFor(needle))),
  entityIds: spec.entityIds,
  topicIds: spec.topicIds,
  salience: spec.salience,
}));

const claimById = new Map(claims.map((c) => [c.id, c] as const));

const relationships: RelationshipRecord[] = [
  {
    recordType: 'RelationshipRecord',
    contractVersion: CONTRACTS_VERSION,
    id: 'rel-postgres-neon',
    kind: 'alternative-to',
    subjectId: 'entity-postgres',
    objectId: 'entity-neon',
    predicate: 'alternative hosted form of',
    evidence: [spanFor('Postgres/Neon')],
    claimIds: ['claim-infra-stack'],
  },
  {
    recordType: 'RelationshipRecord',
    contractVersion: CONTRACTS_VERSION,
    id: 'rel-vercel-github',
    kind: 'integrates-with',
    subjectId: 'entity-vercel',
    objectId: 'entity-github',
    predicate: 'deploys from',
    evidence: [spanFor('Vercel/GitHub')],
    claimIds: ['claim-infra-stack'],
  },
  {
    recordType: 'RelationshipRecord',
    contractVersion: CONTRACTS_VERSION,
    id: 'rel-provider-integrations-llm',
    kind: 'uses',
    subjectId: 'entity-provider-integrations',
    objectId: 'entity-llm-providers',
    predicate: 'integrates',
    evidence: [spanFor('LLM providers'), spanFor('provider integrations')],
    claimIds: ['claim-provider-integrations', 'claim-infra-stack'],
  },
  {
    recordType: 'RelationshipRecord',
    contractVersion: CONTRACTS_VERSION,
    id: 'rel-orchestration-audits',
    kind: 'related-to',
    subjectId: 'entity-multi-agent-orchestration',
    objectId: 'entity-security-integrity-audits',
    predicate: 'operates under',
    evidence: [spanFor('multi-agent orchestration'), spanFor('security/integrity audits')],
    claimIds: ['claim-multi-agent-orchestration', 'claim-audits'],
  },
  {
    recordType: 'RelationshipRecord',
    contractVersion: CONTRACTS_VERSION,
    id: 'rel-orchestration-agent-tools',
    kind: 'uses',
    subjectId: 'entity-multi-agent-orchestration',
    objectId: 'entity-agent-tool-systems',
    predicate: 'orchestrated with',
    evidence: [spanFor('agent tool systems'), spanFor('multi-agent orchestration')],
    claimIds: ['claim-tool-catalog', 'claim-multi-agent-orchestration'],
  },
];

const topics: TopicRecord[] = [
  {
    recordType: 'TopicRecord',
    contractVersion: CONTRACTS_VERSION,
    id: 'topic-tool-catalog',
    title: 'AI tools, models and repositories',
    summary:
      'A mixed catalog of AI tooling spanning generation, editing, scraping/API access, agent systems, open-source media, local runtimes, catalogs and monitoring projects.',
    keywords: ['tools', 'models', 'repositories', 'catalog'],
    claimIds: ['claim-tool-catalog', 'claim-oss-runtimes', 'claim-forecasting-projects'],
    entityIds: [
      'entity-ai-video-tools',
      'entity-voice-generation',
      'entity-agent-tool-systems',
      'entity-local-model-runtimes',
      'entity-model-catalogs',
      'entity-forecasting',
      'entity-digital-twin-projects',
    ],
    blockRefs: blockRefsBetween('## Section 1', 'digital-twin/world-monitoring projects'),
    salience: 0.9,
  },
  {
    recordType: 'TopicRecord',
    contractVersion: CONTRACTS_VERSION,
    id: 'topic-infrastructure',
    title: 'Infrastructure',
    summary:
      'The infrastructure short list spans storage, databases, providers, hosting, messaging, payments, caching, compliance, automation and realtime services, with credentials redacted.',
    keywords: ['infrastructure', 'storage', 'providers', 'realtime'],
    claimIds: ['claim-infra-stack', 'claim-credentials-redacted'],
    entityIds: [
      'entity-cloudflare',
      'entity-postgres',
      'entity-neon',
      'entity-llm-providers',
      'entity-vercel',
      'entity-github',
      'entity-redis',
      'entity-browser-automation',
      'entity-realtime-infrastructure',
    ],
    blockRefs: blockRefsBetween('## Section 2', 'All credentials are'),
    salience: 0.85,
  },
  {
    recordType: 'TopicRecord',
    contractVersion: CONTRACTS_VERSION,
    id: 'topic-architecture-workflows',
    title: 'Architecture and workflows',
    summary:
      'Architecture and workflow concerns: multi-agent orchestration, security/integrity audits, provider integrations, sandbox limits, deployment pipelines and operational loops.',
    keywords: ['architecture', 'workflows', 'orchestration', 'audits', 'pipelines'],
    claimIds: [
      'claim-multi-agent-orchestration',
      'claim-audits',
      'claim-provider-integrations',
      'claim-sandbox-limits',
      'claim-deployment-pipelines',
    ],
    entityIds: [
      'entity-multi-agent-orchestration',
      'entity-security-integrity-audits',
      'entity-provider-integrations',
      'entity-sandbox-resource-limits',
      'entity-deployment-pipelines',
    ],
    blockRefs: blockRefsBetween('## Section 3', 'execution workflows'),
    salience: 0.8,
  },
  {
    recordType: 'TopicRecord',
    contractVersion: CONTRACTS_VERSION,
    id: 'topic-purpose',
    title: 'Purpose of the note',
    summary:
      'The note exists to test semantic organization, source-grounded planning, visual metaphors, technical diagrams, multi-speaker explanation and video composition.',
    keywords: ['purpose', 'testing'],
    claimIds: ['claim-purpose'],
    entityIds: [],
    blockRefs: blockRefsBetween('## Purpose', 'video composition.'),
    salience: 0.7,
  },
];

const messyGraph: SemanticGraph = {
  recordType: 'SemanticGraph',
  contractVersion: CONTRACTS_VERSION,
  id: 'graph-messy-note-redacted',
  sourceIds: [MESSY_SOURCE_ID],
  claims,
  entities,
  topics,
  relationships,
  extractor: 'hand-grounded-fixture@1.0.0',
  createdAt: FIXED_TS,
};

// ---------------------------------------------------------------------------
// Minimal fixtures
// ---------------------------------------------------------------------------

const MINIMAL_TEXT = 'Alpha tools need scheduled audits.';
const minimalSource = makeSourceArtifact({
  id: MINIMAL_SOURCE_ID,
  title: 'Minimal note',
  kind: 'plain-text',
  label: 'minimal.txt',
  raw: MINIMAL_TEXT,
});

const minimalGraph: SemanticGraph = {
  recordType: 'SemanticGraph',
  contractVersion: CONTRACTS_VERSION,
  id: 'graph-minimal',
  sourceIds: [MINIMAL_SOURCE_ID],
  claims: [
    {
      recordType: 'ClaimRecord',
      contractVersion: CONTRACTS_VERSION,
      id: 'claim-alpha-audits',
      statement: 'Alpha tools require scheduled audits.',
      kind: 'constraint',
      evidence: [
        {
          sourceId: MINIMAL_SOURCE_ID,
          blockId: 'b1',
          start: 0,
          end: MINIMAL_TEXT.length,
          quote: MINIMAL_TEXT,
        },
      ],
      entityIds: ['entity-alpha-tools'],
      topicIds: ['topic-minimal'],
      salience: 1.0,
    },
  ],
  entities: [
    {
      recordType: 'EntityRecord',
      contractVersion: CONTRACTS_VERSION,
      id: 'entity-alpha-tools',
      name: 'Alpha tools',
      kind: 'tool',
      aliases: [],
      mentions: [
        {
          sourceId: MINIMAL_SOURCE_ID,
          blockId: 'b1',
          start: 0,
          end: 'Alpha tools'.length,
          text: 'Alpha tools',
        },
      ],
    },
  ],
  topics: [
    {
      recordType: 'TopicRecord',
      contractVersion: CONTRACTS_VERSION,
      id: 'topic-minimal',
      title: 'Minimal operations note',
      summary: 'A single-sentence note about scheduled audits.',
      keywords: ['audits'],
      claimIds: ['claim-alpha-audits'],
      entityIds: ['entity-alpha-tools'],
      blockRefs: [{ sourceId: MINIMAL_SOURCE_ID, blockId: 'b1' }],
      salience: 1.0,
    },
  ],
  relationships: [],
  extractor: 'hand-grounded-fixture@1.0.0',
  createdAt: FIXED_TS,
};

// Two-block artifact only used as the base of the overlapping-blocks mutant.
const twoBlockSource = makeSourceArtifact({
  id: 'source-two-blocks',
  title: 'Two-block note',
  kind: 'plain-text',
  label: 'two-blocks.txt',
  raw: 'Alpha tools need scheduled audits.\nBeta tools ship weekly.',
});

// ---------------------------------------------------------------------------
// Plan construction helpers
// ---------------------------------------------------------------------------

const PURPOSE_DELIVERY: Record<AudioTurnPurpose, string> = {
  framing: 'warm, orienting',
  question: 'curious, conversational',
  explanation: 'clear, expert, unhurried',
  example: 'energetic, concrete',
  connection: 'recollected, linking',
  clarification: 'patient, precise',
  interjection: 'light, engaged',
  transition: 'light, forward-moving',
  synthesis: 'reflective, tying together',
  conclusion: 'resolved, landing',
};

const PURPOSE_LEAD: Record<AudioTurnPurpose, string> = {
  framing: 'Open the segment and orient the listener.',
  question: "Put the listener's question.",
  explanation: 'Explain, grounded in the source.',
  example: 'Give a concrete example from the source.',
  connection: 'Connect back to the earlier segments.',
  clarification: 'Clarify the likely confusion precisely.',
  interjection: 'React briefly.',
  transition: 'Bridge to the next segment.',
  synthesis: 'Synthesize the thread so far.',
  conclusion: 'Land the closing takeaway.',
};

function statementsOf(claimIds: readonly string[]): string {
  const picked = claimIds
    .map((id) => claimById.get(id)?.statement)
    .filter((s): s is string => s !== undefined);
  return picked.length > 0 ? picked.join(' ') : 'the note as a whole.';
}

function entityNamesOf(claimIds: readonly string[], cap = 3): string {
  const names: string[] = [];
  for (const claimId of claimIds) {
    for (const entityId of claimById.get(claimId)?.entityIds ?? []) {
      const name = entityById.get(entityId)?.name;
      if (name !== undefined && !names.includes(name)) names.push(name);
    }
  }
  return names.slice(0, cap).join(', ');
}

function roleOf(salience: number): 'primary' | 'supporting' | 'mention' {
  if (salience >= 0.8) return 'primary';
  if (salience >= 0.5) return 'supporting';
  return 'mention';
}

interface BeatSpec {
  title: string;
  purpose: string;
  claims: string[];
  topicIds: string[];
  budget: number;
}

function beatBrief(spec: BeatSpec): string {
  return `${spec.purpose} Stay grounded on: ${statementsOf(spec.claims)}`;
}

// ---------------------------------------------------------------------------
// Audio Deep Dive plan (~5 min, two hosts; DOCUMENTED format)
// ---------------------------------------------------------------------------

interface TurnSpec {
  role: SpeakerRole;
  purpose: AudioTurnPurpose;
}

const AUDIO_BEATS: (BeatSpec & { turns: TurnSpec[] })[] = [
  {
    title: 'Why this note exists',
    purpose: 'Frame the note as a deliberately messy operational snapshot and state why it is worth mapping.',
    claims: ['claim-purpose'],
    topicIds: ['topic-purpose'],
    budget: 30,
    turns: [
      { role: 'host-a', purpose: 'framing' },
      { role: 'host-b', purpose: 'explanation' },
      { role: 'host-a', purpose: 'transition' },
    ],
  },
  {
    title: 'A mixed catalog of AI tooling',
    purpose: 'Tour the breadth of the tool catalog without drowning in item-by-item detail.',
    claims: ['claim-tool-catalog', 'claim-oss-runtimes', 'claim-forecasting-projects'],
    topicIds: ['topic-tool-catalog'],
    budget: 75,
    turns: [
      { role: 'host-a', purpose: 'framing' },
      { role: 'host-b', purpose: 'explanation' },
      { role: 'host-a', purpose: 'question' },
      { role: 'host-b', purpose: 'example' },
    ],
  },
  {
    title: 'The infrastructure short list',
    purpose: 'Walk the infrastructure short list and the redaction discipline around it.',
    claims: ['claim-infra-stack', 'claim-credentials-redacted'],
    topicIds: ['topic-infrastructure'],
    budget: 75,
    turns: [
      { role: 'host-a', purpose: 'framing' },
      { role: 'host-b', purpose: 'explanation' },
      { role: 'host-a', purpose: 'question' },
      { role: 'host-b', purpose: 'clarification' },
    ],
  },
  {
    title: 'Multi-agent architecture and audits',
    purpose: 'Explain the multi-agent architecture concerns and the audits that keep them honest.',
    claims: ['claim-multi-agent-orchestration', 'claim-audits', 'claim-sandbox-limits'],
    topicIds: ['topic-architecture-workflows'],
    budget: 60,
    turns: [
      { role: 'host-a', purpose: 'framing' },
      { role: 'host-b', purpose: 'explanation' },
      { role: 'host-a', purpose: 'question' },
      { role: 'host-b', purpose: 'example' },
    ],
  },
  {
    title: 'Integration and deployment workflows',
    purpose: 'Show how provider integrations flow into deployment pipelines and operational loops.',
    claims: ['claim-provider-integrations', 'claim-deployment-pipelines'],
    topicIds: ['topic-architecture-workflows'],
    budget: 36,
    turns: [
      { role: 'host-a', purpose: 'framing' },
      { role: 'host-b', purpose: 'explanation' },
      { role: 'host-a', purpose: 'connection' },
      { role: 'host-b', purpose: 'explanation' },
    ],
  },
  {
    title: 'What this note is for',
    purpose: 'Close the loop on why the note exists and what testing it exercises.',
    claims: ['claim-purpose'],
    topicIds: ['topic-purpose'],
    budget: 24,
    turns: [
      { role: 'host-a', purpose: 'synthesis' },
      { role: 'host-b', purpose: 'explanation' },
      { role: 'host-a', purpose: 'conclusion' },
    ],
  },
];

const AUDIO_TOTAL = AUDIO_BEATS.reduce((acc, b) => acc + b.budget, 0);

const audioBeats: NarrativeBeat[] = AUDIO_BEATS.map((spec, i) => ({
  id: `beat-${i + 1}`,
  index: i,
  title: spec.title,
  purpose: spec.purpose,
  brief: beatBrief(spec),
  claimIds: spec.claims,
  topicIds: spec.topicIds,
  weight: Math.round((spec.budget / AUDIO_TOTAL) * 10000) / 10000,
}));

const audioTurns: AudioTurn[] = [];
let turnNo = 0;
AUDIO_BEATS.forEach((spec, beatIndex) => {
  const beat = audioBeats[beatIndex];
  if (beat === undefined) throw new Error('missing beat');
  const carriers = spec.turns.filter((t) => t.purpose !== 'transition');
  const assignment = new Map<number, string[]>();
  spec.claims.forEach((claimId, i) => {
    const carrier = carriers[i % carriers.length] as TurnSpec;
    const turnIdx = spec.turns.indexOf(carrier);
    const list = assignment.get(turnIdx) ?? [];
    list.push(claimId);
    assignment.set(turnIdx, list);
  });
  const perTurn = spec.budget / spec.turns.length;
  spec.turns.forEach((turnSpec, localIdx) => {
    turnNo += 1;
    const assigned = assignment.get(localIdx) ?? [spec.claims[0] as string];
    const claimIds = turnSpec.purpose === 'framing' ? [spec.claims[0] as string] : assigned;
    const evidence = claimIds
      .map((id) => claimById.get(id)?.evidence[0])
      .filter((s): s is EvidenceSpan => s !== undefined)
      .slice(0, 2);
    const entitiesMentioned = entityNamesOf(claimIds);
    audioTurns.push({
      recordType: 'AudioTurn',
      contractVersion: CONTRACTS_VERSION,
      id: `turn-${turnNo}`,
      index: turnNo - 1,
      speaker: turnSpec.role === 'host-a' ? 'Host A' : 'Host B',
      speakerRole: turnSpec.role,
      purpose: turnSpec.purpose,
      brief:
        `${PURPOSE_LEAD[turnSpec.purpose]} ` +
        (turnSpec.purpose === 'question' ? `Focus on ${entitiesMentioned || 'the details'}. ` : '') +
        `Anchors: ${statementsOf(claimIds)}`,
      claimIds,
      evidence,
      beatId: beat.id,
      style: {
        delivery: PURPOSE_DELIVERY[turnSpec.purpose],
        ...(turnSpec.purpose === 'explanation' && entitiesMentioned !== ''
          ? { emphasis: `say entity names crisply: ${entitiesMentioned}` }
          : {}),
      },
      targetDurationSeconds: perTurn,
    });
  });
});

function coverageUnitsFor(
  claimId: string,
  beats: NarrativeBeat[],
  units: { id: string; claimIds: readonly string[] }[],
): string[] {
  const unitIds = new Set<string>();
  for (const beat of beats) {
    if (beat.claimIds.includes(claimId)) unitIds.add(beat.id);
  }
  for (const unit of units) {
    if (unit.claimIds.includes(claimId)) unitIds.add(unit.id);
  }
  if (unitIds.size === 0) throw new Error(`claim ${claimId} has no covering unit`);
  return [...unitIds];
}

const audioPlan: OverviewPlan = {
  recordType: 'OverviewPlan',
  contractVersion: CONTRACTS_VERSION,
  id: 'plan-messy-note-audio-deep-dive-5min',
  sourceIds: [MESSY_SOURCE_ID],
  modality: 'audio',
  mode: 'deep-dive',
  objective:
    'Two hosts take a curious, expert listener through the note\u2019s tool catalog, infrastructure short list and multi-agent architecture concerns, closing on why the note exists.',
  audience: 'technical',
  language: 'en',
  targetDurationSeconds: AUDIO_TOTAL,
  style: {
    tone: 'curious, expert, conversational',
    register: 'plain-technical',
    pacing: 'measured',
    speakerCount: 2,
  },
  coverage: {
    covered: claims.map((claim) => ({
      claimId: claim.id,
      role: roleOf(claim.salience),
      unitIds: coverageUnitsFor(
        claim.id,
        audioBeats,
        audioTurns.map((t) => ({ id: t.id, claimIds: t.claimIds })),
      ),
    })),
    omitted: [],
  },
  beats: audioBeats,
  audioTurns,
  videoScenes: [],
  generator: {
    name: 'fixture-builder',
    version: '1.0.0',
    seed: 'wflx-canonical-audio-deep-dive-5min',
    deterministic: true,
  },
  createdAt: FIXED_TS,
  notes: 'Canonical Deep Dive plan fixture (~5 min). Deep Dive is a DOCUMENTED two-host Gemini Notebook audio format.',
};

// ---------------------------------------------------------------------------
// Video Explainer plan (~7 min, matching the reference family duration)
// ---------------------------------------------------------------------------

const STYLE_BIBLE_ID = 'style-bible--reference-ink';

const VIDEO_BEATS: BeatSpec[] = [
  {
    title: 'What this note is',
    purpose: 'Open on the note as a messy operational snapshot worth mapping end to end.',
    claims: ['claim-purpose'],
    topicIds: ['topic-purpose'],
    budget: 36,
  },
  {
    title: 'A mixed catalog of AI tooling',
    purpose: 'Survey the breadth of the tool catalog with exact labels before diving deeper.',
    claims: ['claim-tool-catalog', 'claim-forecasting-projects', 'claim-oss-runtimes'],
    topicIds: ['topic-tool-catalog'],
    budget: 96,
  },
  {
    title: 'The infrastructure short list',
    purpose: 'Lay out the infrastructure stack as an exact-labeled diagram and honor the redaction discipline.',
    claims: ['claim-infra-stack', 'claim-credentials-redacted'],
    topicIds: ['topic-infrastructure'],
    budget: 96,
  },
  {
    title: 'Multi-agent architecture and audits',
    purpose: 'Explain orchestration topology, audit gates and sandbox guardrails as diagrams.',
    claims: ['claim-multi-agent-orchestration', 'claim-audits', 'claim-sandbox-limits'],
    topicIds: ['topic-architecture-workflows'],
    budget: 72,
  },
  {
    title: 'Integration and deployment workflows',
    purpose: 'Trace provider integrations flowing into deployment pipelines and operational loops.',
    claims: ['claim-provider-integrations', 'claim-deployment-pipelines'],
    topicIds: ['topic-architecture-workflows'],
    budget: 60,
  },
  {
    title: 'Why it matters',
    purpose: 'Close on what testing this note exercises: semantic organization through video composition.',
    claims: ['claim-purpose'],
    topicIds: ['topic-purpose'],
    budget: 60,
  },
];

const VIDEO_TOTAL = VIDEO_BEATS.reduce((acc, b) => acc + b.budget, 0);

const videoBeats: NarrativeBeat[] = VIDEO_BEATS.map((spec, i) => ({
  id: `beat-${i + 1}`,
  index: i,
  title: spec.title,
  purpose: spec.purpose,
  brief: beatBrief(spec),
  claimIds: spec.claims,
  topicIds: spec.topicIds,
  weight: Math.round((spec.budget / VIDEO_TOTAL) * 10000) / 10000,
}));

interface SceneSpec {
  beat: number; // 1-based
  visualType: VisualType;
  renderingClass: VideoScene['renderingClass'];
  narrativePurpose: string;
  narrationBrief: string;
  visualBrief?: string;
  exactTexts: SceneTextItem[];
  claimIds: string[];
  motion: SceneMotion;
  transition: SceneTransition;
  duration: number;
}

const ATLAS_STYLE =
  'Hand-drawn ink linework on graphite paper with cyan/teal emphasis, per the reference scene atlas.';

const SCENE_SPECS: SceneSpec[] = [
  {
    beat: 1,
    visualType: 'title-card',
    renderingClass: 'deterministic',
    narrativePurpose: 'Establish the artifact: one messy note, about to be mapped.',
    narrationBrief: 'Welcome the viewer; state that the note is a messy operational snapshot worth mapping.',
    exactTexts: [
      { role: 'title', value: 'A Messy Note, Mapped', exact: true },
      { role: 'caption', value: 'AI tools, infrastructure and agentic workflows', exact: true },
    ],
    claimIds: ['claim-purpose'],
    motion: 'static',
    transition: 'cut',
    duration: 18,
  },
  {
    beat: 1,
    visualType: 'hero-illustration',
    renderingClass: 'generative',
    narrativePurpose: 'Set the visual tone: clutter resolving into a clean control surface.',
    narrationBrief: 'Preview the journey from clutter to a mapped system.',
    visualBrief: `${ATLAS_STYLE} A cluttered desk of tool cards resolving into one clean technical control-surface composition.`,
    exactTexts: [],
    claimIds: ['claim-purpose'],
    motion: 'zoom',
    transition: 'crossfade',
    duration: 18,
  },
  {
    beat: 2,
    visualType: 'table',
    renderingClass: 'deterministic',
    narrativePurpose: 'Show the catalog breadth with exact labels, not stock imagery.',
    narrationBrief: 'Walk the catalog categories as they are named in the source.',
    exactTexts: [
      { role: 'label', value: 'AI video tools', exact: true },
      { role: 'label', value: 'voice generation', exact: true },
      { role: 'label', value: 'agent tool systems', exact: true },
      { role: 'label', value: 'model catalogs', exact: true },
      { role: 'caption', value: 'the catalog, at a glance', exact: true },
    ],
    claimIds: ['claim-tool-catalog'],
    motion: 'pan',
    transition: 'crossfade',
    duration: 32,
  },
  {
    beat: 2,
    visualType: 'callout',
    renderingClass: 'deterministic',
    narrativePurpose: 'Call out the tail of the catalog: forecasting through digital twins.',
    narrationBrief: 'Note that the catalog reaches forecasting and world-monitoring projects.',
    exactTexts: [
      { role: 'label', value: 'forecasting', exact: true },
      { role: 'label', value: 'digital-twin/world-monitoring projects', exact: true },
      { role: 'caption', value: 'from forecasting to digital twins', exact: true },
    ],
    claimIds: ['claim-forecasting-projects'],
    motion: 'static',
    transition: 'cut',
    duration: 32,
  },
  {
    beat: 2,
    visualType: 'metaphor-illustration',
    renderingClass: 'generative',
    narrativePurpose: 'Metaphor for catalog breadth: pinned cards spreading into constellations.',
    narrationBrief: 'Reflect on how broad a "mixed catalog" really is.',
    visualBrief: `${ATLAS_STYLE} A workshop wall of pinned cards spreading into constellations of tools.`,
    exactTexts: [],
    claimIds: ['claim-oss-runtimes'],
    motion: 'pan',
    transition: 'crossfade',
    duration: 32,
  },
  {
    beat: 3,
    visualType: 'architecture-diagram',
    renderingClass: 'deterministic',
    narrativePurpose: 'Lay out the infrastructure short list as an exact-labeled diagram.',
    narrationBrief: 'Name each infrastructure piece exactly as the source lists it.',
    exactTexts: [
      { role: 'label', value: 'Cloudflare', exact: true },
      { role: 'label', value: 'Postgres', exact: true },
      { role: 'label', value: 'Neon', exact: true },
      { role: 'label', value: 'Vercel', exact: true },
      { role: 'label', value: 'GitHub', exact: true },
      { role: 'label', value: 'Redis', exact: true },
      { role: 'caption', value: 'the infrastructure short list', exact: true },
    ],
    claimIds: ['claim-infra-stack'],
    motion: 'animated-diagram',
    transition: 'morph',
    duration: 32,
  },
  {
    beat: 3,
    visualType: 'quote-panel',
    renderingClass: 'deterministic',
    narrativePurpose: 'Honor the redaction discipline with the source quote itself.',
    narrationBrief: 'Point out that the source keeps credentials out on purpose.',
    exactTexts: [
      { role: 'quote', value: 'All credentials are `[REDACTED]`.', exact: true },
      { role: 'caption', value: 'the source keeps secrets out', exact: true },
    ],
    claimIds: ['claim-credentials-redacted'],
    motion: 'static',
    transition: 'cut',
    duration: 32,
  },
  {
    beat: 3,
    visualType: 'workstation-scene',
    renderingClass: 'hybrid',
    narrativePurpose: 'Ground the realtime tooling in a workstation dashboard scene.',
    narrationBrief: 'Connect browser automation and realtime infrastructure to daily operations.',
    visualBrief: `${ATLAS_STYLE} Drafting-table workstation with a live operations dashboard sketch.`,
    exactTexts: [
      { role: 'label', value: 'realtime infrastructure', exact: true },
      { role: 'label', value: 'browser automation', exact: true },
    ],
    claimIds: ['claim-infra-stack'],
    motion: 'pan',
    transition: 'crossfade',
    duration: 32,
  },
  {
    beat: 4,
    visualType: 'architecture-diagram',
    renderingClass: 'deterministic',
    narrativePurpose: 'Show orchestration topology with audit gates.',
    narrationBrief: 'Explain how multi-agent orchestration operates under audits.',
    exactTexts: [
      { role: 'label', value: 'multi-agent orchestration', exact: true },
      { role: 'label', value: 'security/integrity audits', exact: true },
      { role: 'caption', value: 'orchestration under audit', exact: true },
    ],
    claimIds: ['claim-multi-agent-orchestration', 'claim-audits'],
    motion: 'animated-diagram',
    transition: 'morph',
    duration: 24,
  },
  {
    beat: 4,
    visualType: 'state-diagram',
    renderingClass: 'deterministic',
    narrativePurpose: 'Show guardrails: sandbox limits and operational loops as states.',
    narrationBrief: 'Walk the guardrails and loops that keep execution safe.',
    exactTexts: [
      { role: 'label', value: 'sandbox/resource limits', exact: true },
      { role: 'label', value: 'operational loops', exact: true },
      { role: 'caption', value: 'guardrails and loops', exact: true },
    ],
    claimIds: ['claim-sandbox-limits'],
    motion: 'animated-diagram',
    transition: 'crossfade',
    duration: 24,
  },
  {
    beat: 4,
    visualType: 'metaphor-illustration',
    renderingClass: 'generative',
    narrativePurpose: 'Metaphor for orchestration: agents as lantern-passing machines in a corridor.',
    narrationBrief: 'Give the architecture an intuitive image before moving on.',
    visualBrief: `${ATLAS_STYLE} A long technical corridor where small machines pass lanterns between stations.`,
    exactTexts: [],
    claimIds: ['claim-multi-agent-orchestration'],
    motion: 'pan',
    transition: 'crossfade',
    duration: 24,
  },
  {
    beat: 5,
    visualType: 'process-flow',
    renderingClass: 'deterministic',
    narrativePurpose: 'Trace integration into deployment as an exact-labeled flow.',
    narrationBrief: 'Follow provider integrations into deployment pipelines.',
    exactTexts: [
      { role: 'label', value: 'provider integrations', exact: true },
      { role: 'label', value: 'deployment pipelines', exact: true },
      { role: 'caption', value: 'integration to deployment', exact: true },
    ],
    claimIds: ['claim-provider-integrations'],
    motion: 'animated-diagram',
    transition: 'morph',
    duration: 30,
  },
  {
    beat: 5,
    visualType: 'process-flow',
    renderingClass: 'deterministic',
    narrativePurpose: 'Close the loop: execution workflows and operational loops.',
    narrationBrief: 'Show the operational loop that keeps the system running.',
    exactTexts: [
      { role: 'label', value: 'execution workflows', exact: true },
      { role: 'label', value: 'operational loops', exact: true },
      { role: 'caption', value: 'the operational loop', exact: true },
    ],
    claimIds: ['claim-deployment-pipelines'],
    motion: 'animated-diagram',
    transition: 'crossfade',
    duration: 30,
  },
  {
    beat: 6,
    visualType: 'hero-illustration',
    renderingClass: 'hybrid',
    narrativePurpose: 'Pay off the opening: the cluttered desk, now neatly mapped.',
    narrationBrief: 'Return to the opening image and show it resolved.',
    visualBrief: `${ATLAS_STYLE} The cluttered desk from the opening scene, now resolved into one clean diagram sheet.`,
    exactTexts: [
      { role: 'label', value: 'semantic organization', exact: true },
      { role: 'label', value: 'source-grounded planning', exact: true },
    ],
    claimIds: ['claim-purpose'],
    motion: 'zoom',
    transition: 'crossfade',
    duration: 30,
  },
  {
    beat: 6,
    visualType: 'title-card',
    renderingClass: 'deterministic',
    narrativePurpose: 'Close the artifact with the through-line.',
    narrationBrief: 'Land the closing thought: source-grounded, end to end.',
    exactTexts: [
      { role: 'title', value: 'Mapped, end to end', exact: true },
      { role: 'caption', value: 'source-grounded overview', exact: true },
    ],
    claimIds: ['claim-purpose'],
    motion: 'static',
    transition: 'crossfade',
    duration: 30,
  },
];

const videoScenes: VideoScene[] = SCENE_SPECS.map((spec, i) => ({
  recordType: 'VideoScene',
  contractVersion: CONTRACTS_VERSION,
  id: `scene-${i + 1}`,
  index: i,
  beatId: `beat-${spec.beat}`,
  narrativePurpose: spec.narrativePurpose,
  visualType: spec.visualType,
  renderingClass: spec.renderingClass,
  exactTexts: spec.exactTexts,
  claimIds: spec.claimIds,
  narrationRef: `narr-s${i + 1}`,
  narrationBrief: spec.narrationBrief,
  targetDurationSeconds: spec.duration,
  motion: spec.motion,
  transition: spec.transition,
  styleBibleId: STYLE_BIBLE_ID,
  ...(spec.visualBrief !== undefined ? { visualBrief: spec.visualBrief } : {}),
}));

const videoPlan: OverviewPlan = {
  recordType: 'OverviewPlan',
  contractVersion: CONTRACTS_VERSION,
  id: 'plan-messy-note-video-explainer-7min',
  sourceIds: [MESSY_SOURCE_ID],
  modality: 'video',
  mode: 'explainer',
  objective:
    'A narrated technical explainer maps the note\u2019s tool catalog, infrastructure stack and multi-agent architecture with exact labels and diagrams, closing on the note\u2019s purpose.',
  audience: 'technical',
  language: 'en',
  targetDurationSeconds: VIDEO_TOTAL,
  style: {
    tone: 'clear, technical, quietly enthusiastic',
    register: 'plain-technical',
    pacing: 'measured',
    styleBibleId: STYLE_BIBLE_ID,
  },
  coverage: {
    covered: claims.map((claim) => ({
      claimId: claim.id,
      role: roleOf(claim.salience),
      unitIds: coverageUnitsFor(
        claim.id,
        videoBeats,
        videoScenes.map((s) => ({ id: s.id, claimIds: s.claimIds })),
      ),
    })),
    omitted: [],
  },
  beats: videoBeats,
  audioTurns: [],
  videoScenes,
  generator: {
    name: 'fixture-builder',
    version: '1.0.0',
    seed: 'wflx-canonical-video-explainer-7min',
    deterministic: true,
  },
  createdAt: FIXED_TS,
  notes:
    'Canonical Explainer plan fixture (~7 min). The ~7 min family matches the reference artifact duration 415.66 s (DOCUMENTED, docs/reference/reference-artifact-manifest.json).',
};

// ---------------------------------------------------------------------------
// GeneratedArtifact + ExperimentRecord synthetic examples
// ---------------------------------------------------------------------------

const generatedArtifactExample: GeneratedArtifact = {
  recordType: 'GeneratedArtifact',
  contractVersion: CONTRACTS_VERSION,
  id: 'artifact-lab-audio-0001',
  kind: 'audio-overview',
  planId: audioPlan.id,
  sourceIds: [MESSY_SOURCE_ID],
  createdAt: FIXED_TS,
  media: {
    container: 'm4a',
    sha256: sha256Hex('webflix-lab synthetic artifact example — no media bytes exist'),
    sizeBytes: 0,
    durationSeconds: AUDIO_TOTAL,
    audio: { codec: 'aac', channels: 1, sampleRateHz: 44100 },
  },
  providers: [
    { stage: 'script', provider: 'fixture-builder' },
    { stage: 'speech', provider: 'fixture-builder' },
    { stage: 'evaluation', provider: 'fixture-builder' },
  ],
  generator: {
    name: 'fixture-builder',
    version: '1.0.0',
    seed: 'wflx-canonical-audio-deep-dive-5min',
    reproducible: true,
  },
  qa: { status: 'not-evaluated', issues: [] },
  notes:
    'Synthetic contract example demonstrating the GeneratedArtifact shape. No media bytes exist; media.sha256 hashes a fixed label string, not a real file.',
};

const experimentRecordExample: ExperimentRecord = {
  recordType: 'ExperimentRecord',
  contractVersion: CONTRACTS_VERSION,
  id: 'EXP-W1-FIXTURE-01',
  timestampUtc: FIXED_TS,
  operator: 'w1',
  surface: 'video',
  evidenceKind: 'lab-reproduction',
  sourceFingerprint: messySource.fingerprint.contentSha256,
  selectedSources: [MESSY_SOURCE_ID],
  format: 'explainer',
  language: 'en',
  length: 'about 7 minutes',
  visualStyle: 'reference-ink',
  otherConfig: {},
  observations: [
    'Canonical plan fixture validates against the frozen contracts (REPRODUCED).',
    'Reference Video Overview duration is 415.66 s at 1280x720 30fps h264 (DOCUMENTED, docs/reference/reference-artifact-manifest.json).',
    'Scene atlas visual types map one-to-one onto the fixture scene set (OBSERVED in fixture).',
  ],
  invariants: ['plan targetDurationSeconds 420 stays within 10 s of the reference duration 415.66 s'],
  differences: [],
  hypothesis:
    'A staged, source-grounded compiler can produce plan-level storyboards in the reference visual grammar without knowing product internals.',
  confidence: 'medium',
  falsifier: 'Plan scenes fail grounding or exact-label checks against the source artifact.',
  nextExperiment: 'EXP-V-01',
  status: 'unresolved',
  evidencePaths: [
    'fixtures/contracts/plan-messy-note-video-explainer-7min.json',
    'docs/reference/reference-video-scene-atlas.md',
  ],
};

// ---------------------------------------------------------------------------
// Director-emitted canonical per-mode plans (H-2, adjudication
// handoff-adjudications-001.md; DESIGN.md §16.4 item 2 resolved).
//
// Unlike the hand-built deep-dive/explainer fixtures above, these three are
// compiled by the REAL Overview Director (compileOverviewPlan) over the same
// canonical reference-messy-note source + graph, with fixed seed / now /
// planId so regeneration is byte-identical. Structural mode semantics
// (turn skeletons, purpose distributions, coverage compression, speaker
// pairing) are asserted against these in tests/contracts/fixtures.test.ts and
// tests/audio/canonical-modes.test.ts. W2's keyword-heuristic enriched-tag
// predicates stay on the labeled stand-ins until the v2 stance wave (H-1).
// ---------------------------------------------------------------------------

interface DirectorModeSpec {
  file: string;
  mode: 'brief' | 'critique' | 'debate';
  targetDurationSeconds: number;
}

const DIRECTOR_MODE_SPECS: DirectorModeSpec[] = [
  { file: 'plan-audio-brief-2min.json', mode: 'brief', targetDurationSeconds: 120 },
  { file: 'plan-audio-critique-5min.json', mode: 'critique', targetDurationSeconds: 300 },
  { file: 'plan-audio-debate-5min.json', mode: 'debate', targetDurationSeconds: 300 },
];

function compileDirectorModePlan(spec: DirectorModeSpec): OverviewPlan {
  const minutes = Math.round(spec.targetDurationSeconds / 60);
  return compileOverviewPlan({
    sources: [messySource],
    graph: messyGraph,
    modality: 'audio',
    mode: spec.mode,
    audience: 'technical',
    language: 'en',
    targetDurationSeconds: spec.targetDurationSeconds,
    seed: `wflx-canonical-audio-${spec.mode}-${minutes}min`,
    now: FIXED_TS,
    planId: `plan-messy-note-audio-${spec.mode}-${minutes}min`,
  });
}

const directorModePlans: OverviewPlan[] = DIRECTOR_MODE_SPECS.map(compileDirectorModePlan);
const briefPlan = directorModePlans[0] as OverviewPlan;
const critiquePlan = directorModePlans[1] as OverviewPlan;
const debatePlan = directorModePlans[2] as OverviewPlan;

// ---------------------------------------------------------------------------
// Mutants (exactly one mutation each; red/green contract tests)
// ---------------------------------------------------------------------------

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

function mutateAt(base: unknown, path: string, value?: Json, mode: 'set' | 'delete' = 'set'): Json {
  const clone = JSON.parse(JSON.stringify(base)) as Json;
  const segs = path.split('.');
  let node = clone as { [key: string]: Json };
  for (const seg of segs.slice(0, -1)) {
    const next = node[seg];
    if (next === null || typeof next !== 'object') {
      throw new Error(`bad mutation path ${path} at ${seg}`);
    }
    node = next as { [key: string]: Json };
  }
  const last = segs[segs.length - 1] as string;
  if (mode === 'set') {
    node[last] = value as Json;
  } else if (Array.isArray(node)) {
    // Deleting an array element removes it (splice), leaving no sparse hole.
    const idx = Number(last);
    if (!Number.isInteger(idx) || idx < 0 || idx >= node.length) {
      throw new Error(`bad array deletion path ${path}`);
    }
    node.splice(idx, 1);
  } else {
    delete node[last];
  }
  return clone;
}

interface MutantSpec {
  file: string;
  base: unknown;
  path: string;
  value?: Json;
  mode?: 'set' | 'delete';
  /** 'both' = zod guard + JSON Schema reject; 'guard' = only the zod guard rejects. */
  layer: 'both' | 'guard';
  description: string;
}

const STRUCTURAL_MUTANTS: MutantSpec[] = [
  { file: 'm01-bad-sha256.json', base: minimalSource, path: 'fingerprint.contentSha256', value: 'not-a-sha256', layer: 'both', description: 'contentSha256 is not 64 lowercase hex chars' },
  { file: 'm02-bad-record-type.json', base: minimalGraph, path: 'claims.0.recordType', value: 'Claim', layer: 'both', description: 'claim recordType is not the literal ClaimRecord' },
  { file: 'm03-bad-enum.json', base: minimalGraph, path: 'entities.0.kind', value: 'gizmo', layer: 'both', description: 'entity kind outside the EntityKind enum' },
  { file: 'm04-extra-property.json', base: minimalGraph, path: 'topics.0.extra', value: 'nope', layer: 'both', description: 'unknown property on a TopicRecord (strict objects)' },
  { file: 'm05-bad-contract-version.json', base: generatedArtifactExample, path: 'contractVersion', value: '2.0.0', layer: 'both', description: 'contractVersion major does not match the frozen bundle' },
  { file: 'm06-empty-evidence.json', base: minimalGraph, path: 'claims.0.evidence', value: [], layer: 'both', description: 'claim evidence is empty (minItems 1)' },
  { file: 'm07-bad-timestamp.json', base: experimentRecordExample, path: 'timestampUtc', value: '2026-09-26 19:26:00', layer: 'both', description: 'timestamp is not ISO-8601 UTC with Z' },
  { file: 'm08-negative-offset.json', base: minimalGraph, path: 'claims.0.evidence.0.start', value: -1, layer: 'both', description: 'evidence start offset is negative' },
  { file: 'm09-end-lte-start.json', base: minimalGraph, path: 'claims.0.evidence.0.end', value: 0, layer: 'guard', description: 'evidence end <= start (cross-field rule, not expressible in JSON Schema)' },
  { file: 'm10-bad-id-chars.json', base: minimalGraph, path: 'entities.0.id', value: 'bad id!', layer: 'both', description: 'id contains forbidden characters' },
  { file: 'm11-audio-mode-on-video.json', base: videoPlan, path: 'mode', value: 'deep-dive', layer: 'guard', description: 'video plan carries an audio mode (modality/mode correlation)' },
  { file: 'm12-missing-required.json', base: audioPlan, path: 'objective', mode: 'delete', layer: 'both', description: 'required field objective removed' },
  { file: 'm13-salience-out-of-range.json', base: minimalGraph, path: 'claims.0.salience', value: 1.5, layer: 'both', description: 'claim salience above 1' },
  { file: 'm14-unknown-visual-type.json', base: videoPlan, path: 'videoScenes.0.visualType', value: 'hologram', layer: 'both', description: 'visualType outside the atlas-derived enum' },
  { file: 'm15-self-relationship.json', base: messyGraph, path: 'relationships.0.objectId', value: 'entity-postgres', layer: 'guard', description: 'relationship subject equals object (cross-field rule)' },
  { file: 'm16-audio-plan-without-turns.json', base: audioPlan, path: 'audioTurns', value: [], layer: 'guard', description: 'audio plan with zero AudioTurns (cross-field rule)' },
  { file: 'm17-heading-without-level.json', base: minimalSource, path: 'blocks.0.kind', value: 'heading', layer: 'guard', description: 'heading block without level (cross-field rule)' },
  { file: 'm18-audio-artifact-without-audio-spec.json', base: generatedArtifactExample, path: 'media.audio', mode: 'delete', layer: 'guard', description: 'audio-overview without media.audio (cross-field rule)' },
];

interface DeepMutantSpec {
  file: string;
  base: unknown;
  path: string;
  value?: Json;
  mode?: 'set' | 'delete';
  /** Which deep validator must reject the mutant. */
  validator: 'source' | 'graph' | 'plan';
  description: string;
}

const DEEP_MUTANTS: DeepMutantSpec[] = [
  { file: 's01-quote-mismatch.json', base: messyGraph, path: 'claims.0.evidence.0.quote', value: 'a mixed catalog', validator: 'graph', description: 'evidence quote differs from text.slice(start, end)' },
  { file: 's02-span-outside-block.json', base: messyGraph, path: 'claims.3.evidence.0.start', value: Math.max(0, (claims[3]?.evidence[0]?.start ?? 10) - 10), validator: 'graph', description: 'span shifted outside its referenced block' },
  { file: 's03-overlapping-blocks.json', base: twoBlockSource, path: 'blocks.1.start', value: 25, validator: 'source', description: 'second block overlaps the first' },
  { file: 's04-wrong-content-hash.json', base: minimalSource, path: 'fingerprint.contentSha256', value: sha256Hex('wrong content'), validator: 'source', description: 'contentSha256 does not hash the text' },
  { file: 's05-bad-word-count.json', base: minimalSource, path: 'wordCount', value: 4, validator: 'source', description: 'wordCount off by one' },
  { file: 's06-beat-weights-not-summing.json', base: audioPlan, path: 'beats.1.weight', value: 0.05, validator: 'plan', description: 'beat weights sum to 0.8 instead of 1' },
  { file: 's07-turn-duration-sum-off.json', base: audioPlan, path: 'audioTurns.3.targetDurationSeconds', value: 100, validator: 'plan', description: 'one turn inflated so durations exceed the target tolerance' },
  { file: 's08-unknown-claim-ref.json', base: audioPlan, path: 'beats.1.claimIds', value: ['claim-tool-catalog', 'claim-oss-runtimes', 'claim-forecasting-projects', 'claim-nonexistent'], validator: 'plan', description: 'beat references a claim not in the graph' },
  { file: 's09-unaccounted-claims.json', base: videoPlan, path: 'coverage.covered.4', mode: 'delete', validator: 'plan', description: 'a graph claim is neither covered nor omitted' },
  { file: 's10-deterministic-scene-no-exact-text.json', base: videoPlan, path: 'videoScenes.6.exactTexts', value: [], validator: 'plan', description: 'deterministic scene without any exact text (atlas rule 2)' },
  { file: 's11-dangling-block-ref.json', base: minimalGraph, path: 'claims.0.evidence.0.blockId', value: 'b999', validator: 'graph', description: 'evidence references a block that does not exist' },
  { file: 's12-mention-text-mismatch.json', base: messyGraph, path: 'entities.13.mentions.0.text', value: 'redis', validator: 'graph', description: 'entity mention text differs from the source slice' },
  { file: 's13-dangling-beat-ref.json', base: audioPlan, path: 'audioTurns.5.beatId', value: 'beat-nonexistent', validator: 'plan', description: 'turn references a beat that does not exist' },
  { file: 's14-block-slice-mismatch.json', base: minimalSource, path: 'blocks.0.text', value: 'Alpha tools need scheduled audits', validator: 'source', description: 'block text differs from text.slice(start, end)' },
  // Per-mode canonical-plan mutants (H-2): one rule violation on each
  // Director-emitted plan — the guard+deep pair must reject on the
  // compiler-emitted shapes exactly as it does on the hand-built ones.
  { file: 's15-brief-unknown-claim-ref.json', base: briefPlan, path: 'audioTurns.3.claimIds', value: ['claim-nonexistent'], validator: 'plan', description: 'brief turn references a claim not in the graph' },
  { file: 's16-critique-beat-weights-not-summing.json', base: critiquePlan, path: 'beats.1.weight', value: 0.05, validator: 'plan', description: 'critique beat weights no longer sum to 1' },
  { file: 's17-debate-unaccounted-claims.json', base: debatePlan, path: 'coverage.covered.4', mode: 'delete', validator: 'plan', description: 'a graph claim is neither covered nor omitted (debate)' },
];

// ---------------------------------------------------------------------------
// Self-checks, assembly, output
// ---------------------------------------------------------------------------

function assertZod(name: string, schema: z.ZodType, record: unknown): void {
  const result = schema.safeParse(record);
  if (!result.success) {
    throw new Error(`${name} fails its zod guard: ${JSON.stringify(result.error.issues)}`);
  }
}

function assertZodFails(name: string, schema: z.ZodType, record: unknown): void {
  const result = schema.safeParse(record);
  if (result.success) {
    throw new Error(`${name} unexpectedly passes its guard`);
  }
}

function assertDeep(name: string, result: { valid: boolean; issues: unknown[] }): void {
  if (!result.valid) {
    throw new Error(`${name} fails deep validation: ${JSON.stringify(result.issues)}`);
  }
}

function assertDeepFails(name: string, result: { valid: boolean; issues: unknown[] }): void {
  if (result.valid) {
    throw new Error(`${name} unexpectedly passes deep validation`);
  }
}

function schemaForBase(base: unknown): z.ZodType {
  if (base === messyGraph || base === minimalGraph) return SemanticGraphSchema;
  if (base === audioPlan || base === videoPlan
    || base === briefPlan || base === critiquePlan || base === debatePlan) return OverviewPlanSchema;
  if (base === generatedArtifactExample) return GeneratedArtifactSchema;
  if (base === experimentRecordExample) return ExperimentRecordSchema;
  return SourceArtifactSchema;
}

// Fixtures must be green before writing anything.
assertZod('messySource', SourceArtifactSchema, messySource);
assertZod('minimalSource', SourceArtifactSchema, minimalSource);
assertZod('messyGraph', SemanticGraphSchema, messyGraph);
assertZod('minimalGraph', SemanticGraphSchema, minimalGraph);
assertZod('audioPlan', OverviewPlanSchema, audioPlan);
assertZod('videoPlan', OverviewPlanSchema, videoPlan);
for (const [i, spec] of DIRECTOR_MODE_SPECS.entries()) {
  assertZod(`directorModePlans[${i}] (${spec.mode})`, OverviewPlanSchema, directorModePlans[i]);
}
assertZod('generatedArtifactExample', GeneratedArtifactSchema, generatedArtifactExample);
assertZod('experimentRecordExample', ExperimentRecordSchema, experimentRecordExample);
assertDeep('messySource', validateSourceArtifact(messySource));
assertDeep('minimalSource', validateSourceArtifact(minimalSource));
assertDeep('messyGraph', validateSemanticGraph(messyGraph, messySource));
assertDeep('minimalGraph', validateSemanticGraph(minimalGraph, minimalSource));
assertDeep('audioPlan', validateOverviewPlan(audioPlan, messyGraph, messySource));
assertDeep('videoPlan', validateOverviewPlan(videoPlan, messyGraph, messySource));
for (const [i, spec] of DIRECTOR_MODE_SPECS.entries()) {
  assertDeep(
    `directorModePlans[${i}] (${spec.mode})`,
    validateOverviewPlan(directorModePlans[i] as OverviewPlan, messyGraph, messySource),
  );
}

// Mutants must be guard-invalid (structural) or deep-invalid (semantic).
for (const spec of STRUCTURAL_MUTANTS) {
  const mutant = mutateAt(spec.base, spec.path, spec.value, spec.mode ?? 'set');
  assertZodFails(spec.file, schemaForBase(spec.base), mutant);
}
for (const spec of DEEP_MUTANTS) {
  const mutant = mutateAt(spec.base, spec.path, spec.value, spec.mode ?? 'set');
  // Deep mutants must pass the guard (they are shape-valid).
  assertZod(spec.file, schemaForBase(spec.base), mutant);
  if (spec.validator === 'source') {
    assertDeepFails(spec.file, validateSourceArtifact(mutant as unknown as SourceArtifact));
  } else if (spec.validator === 'graph') {
    const source = spec.base === minimalGraph ? minimalSource : messySource;
    assertDeepFails(spec.file, validateSemanticGraph(mutant as unknown as SemanticGraph, source));
  } else {
    assertDeepFails(spec.file, validateOverviewPlan(mutant as unknown as OverviewPlan, messyGraph, messySource));
  }
}

export function buildAllFixtures(): Record<string, string> {
  const files: Record<string, unknown> = {
    'reference-messy-note.source-artifact.json': messySource,
    'reference-messy-note.semantic-graph.json': messyGraph,
    'plan-audio-deep-dive-5min.json': audioPlan,
    'plan-video-explainer-7min.json': videoPlan,
    'plan-audio-brief-2min.json': briefPlan,
    'plan-audio-critique-5min.json': critiquePlan,
    'plan-audio-debate-5min.json': debatePlan,
    'minimal.source-artifact.json': minimalSource,
    'minimal.semantic-graph.json': minimalGraph,
    'generated-artifact.example.json': generatedArtifactExample,
    'experiment-record.example.json': experimentRecordExample,
  };
  for (const spec of STRUCTURAL_MUTANTS) {
    files[`mutants/${spec.file}`] = mutateAt(spec.base, spec.path, spec.value, spec.mode ?? 'set');
  }
  for (const spec of DEEP_MUTANTS) {
    files[`mutants/${spec.file}`] = mutateAt(spec.base, spec.path, spec.value, spec.mode ?? 'set');
  }
  const serialized: Record<string, string> = {};
  for (const [name, data] of Object.entries(files)) {
    serialized[name] = `${JSON.stringify(data, null, 2)}\n`;
  }
  return serialized;
}

function main(): void {
  mkdirSync(join(OUT_DIR, 'mutants'), { recursive: true });
  for (const [name, content] of Object.entries(buildAllFixtures())) {
    writeFileSync(join(OUT_DIR, name), content, 'utf8');
    console.log(`wrote ${join(OUT_DIR, name)}`);
  }
}

if (import.meta.main) {
  main();
}
