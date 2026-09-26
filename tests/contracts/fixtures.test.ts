/**
 * Canonical fixture tests: every checked-in fixture validates against the
 * frozen contracts (zod guard + JSON Schema + deep validators), the builder
 * is idempotent (byte-identical regeneration), and fixture ground truth
 * matches the hand-authored expectations.
 *
 * Fixture-only success is NOT product parity evidence (AGENTS.md); these
 * tests establish contract conformance only.
 */

import { describe, expect, test } from 'bun:test';
import { readdirSync } from 'node:fs';
import { buildAllFixtures } from './genfixtures';
import { loadJson, validateWithJsonSchema } from './helpers';
import {
  countWords,
  hasEvidenceLabel,
  OverviewPlanSchema,
  SemanticGraphSchema,
  sha256Hex,
  SourceArtifactSchema,
  validateOverviewPlan,
  validateSemanticGraph,
  validateSourceArtifact,
  type AudioTurnPurpose,
  type GeneratedArtifact,
  type OverviewPlan,
  type SemanticGraph,
  type SourceArtifact,
} from '../../src/contracts';

const FIXTURE_DIR = 'fixtures/contracts';

function fixtureFiles(): string[] {
  return readdirSync(FIXTURE_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort();
}

describe('canonical fixtures', () => {
  test('the expected fixture set exists', () => {
    expect(fixtureFiles()).toEqual([
      'experiment-record.example.json',
      'generated-artifact.example.json',
      'minimal.semantic-graph.json',
      'minimal.source-artifact.json',
      'plan-audio-deep-dive-5min.json',
      'plan-video-explainer-7min.json',
      'reference-messy-note.semantic-graph.json',
      'reference-messy-note.source-artifact.json',
    ]);
  });

  test('regenerating fixtures is byte-identical to the checked-in files', async () => {
    const built = buildAllFixtures();
    for (const [name, content] of Object.entries(built)) {
      const onDisk = Bun.file(`${FIXTURE_DIR}/${name}`);
      expect(content).toBe(await onDisk.text());
    }
  });

  test('every fixture passes its zod guard and JSON Schema', () => {
    for (const file of fixtureFiles()) {
      const record = loadJson(`${FIXTURE_DIR}/${file}`);
      const guard =
        (record as { recordType: string }).recordType === 'OverviewPlan'
          ? OverviewPlanSchema.safeParse(record).success
          : (record as { recordType: string }).recordType === 'SemanticGraph'
            ? SemanticGraphSchema.safeParse(record).success
            : (record as { recordType: string }).recordType === 'SourceArtifact'
              ? SourceArtifactSchema.safeParse(record).success
              : true; // examples validated below
      expect(guard).toBe(true);
      expect(validateWithJsonSchema(record)).toBe(true);
    }
  });

  test('source artifacts pass deep validation', () => {
    const messy = loadJson(`${FIXTURE_DIR}/reference-messy-note.source-artifact.json`) as SourceArtifact;
    const minimal = loadJson(`${FIXTURE_DIR}/minimal.source-artifact.json`) as SourceArtifact;
    expect(validateSourceArtifact(messy).valid).toBe(true);
    expect(validateSourceArtifact(minimal).valid).toBe(true);
  });

  test('semantic graphs pass deep validation against their sources', () => {
    const messy = loadJson(`${FIXTURE_DIR}/reference-messy-note.semantic-graph.json`) as SemanticGraph;
    const minimal = loadJson(`${FIXTURE_DIR}/minimal.semantic-graph.json`) as SemanticGraph;
    const messySource = loadJson(`${FIXTURE_DIR}/reference-messy-note.source-artifact.json`) as SourceArtifact;
    const minimalSource = loadJson(`${FIXTURE_DIR}/minimal.source-artifact.json`) as SourceArtifact;
    expect(validateSemanticGraph(messy, messySource).valid).toBe(true);
    expect(validateSemanticGraph(minimal, minimalSource).valid).toBe(true);
  });

  test('overview plans pass deep validation against graph and source', () => {
    const graph = loadJson(`${FIXTURE_DIR}/reference-messy-note.semantic-graph.json`) as SemanticGraph;
    const source = loadJson(`${FIXTURE_DIR}/reference-messy-note.source-artifact.json`) as SourceArtifact;
    const audio = loadJson(`${FIXTURE_DIR}/plan-audio-deep-dive-5min.json`) as OverviewPlan;
    const video = loadJson(`${FIXTURE_DIR}/plan-video-explainer-7min.json`) as OverviewPlan;
    expect(validateOverviewPlan(audio, graph, source).valid).toBe(true);
    expect(validateOverviewPlan(video, graph, source).valid).toBe(true);
  });
});

describe('messy-note fixture ground truth', () => {
  const source = loadJson(`${FIXTURE_DIR}/reference-messy-note.source-artifact.json`) as SourceArtifact;
  const graph = loadJson(`${FIXTURE_DIR}/reference-messy-note.semantic-graph.json`) as SemanticGraph;

  test('block structure matches the redacted markdown', () => {
    expect(source.blocks.filter((b) => b.kind === 'heading').length).toBe(5);
    expect(source.blocks.filter((b) => b.kind === 'list-item').length).toBe(29);
    expect(source.blocks.filter((b) => b.kind === 'paragraph').length).toBe(7);
    expect(source.text.startsWith('# Reference Fixture')).toBe(true);
    expect(source.fingerprint.contentSha256).toBe(sha256Hex(source.text));
    expect(source.wordCount).toBe(countWords(source.text));
  });

  test('list items are anchored with markers included', () => {
    for (const block of source.blocks.filter((b) => b.kind === 'list-item')) {
      expect(block.text.startsWith('- ')).toBe(true);
      expect(source.text.slice(block.start, block.end)).toBe(block.text);
    }
  });

  test('graph ground truth counts and key records', () => {
    expect(graph.claims.length).toBe(11);
    expect(graph.entities.length).toBe(21);
    expect(graph.topics.length).toBe(4);
    expect(graph.relationships.length).toBe(5);
    const redacted = graph.claims.find((c) => c.id === 'claim-credentials-redacted');
    expect(redacted?.evidence[0]?.quote).toBe('All credentials are `[REDACTED]`.');
    const postgres = graph.entities.find((e) => e.id === 'entity-postgres');
    expect(postgres?.kind).toBe('technology');
    expect(postgres?.aliases).toContain('PostgreSQL');
    // Every entity mention resolves to an exact source slice (deep-validated
    // above; here spot-check one).
    const mention = postgres?.mentions[0];
    expect(source.text.slice(mention?.start, mention?.end)).toBe('Postgres');
  });

  test('every claim has evidence inside the source text', () => {
    for (const claim of graph.claims) {
      expect(claim.evidence.length).toBeGreaterThanOrEqual(1);
      for (const span of claim.evidence) {
        expect(source.text.slice(span.start, span.end)).toBe(span.quote);
      }
    }
  });
});

describe('canonical plan fixtures', () => {
  const graph = loadJson(`${FIXTURE_DIR}/reference-messy-note.semantic-graph.json`) as SemanticGraph;
  const audio = loadJson(`${FIXTURE_DIR}/plan-audio-deep-dive-5min.json`) as OverviewPlan;
  const video = loadJson(`${FIXTURE_DIR}/plan-video-explainer-7min.json`) as OverviewPlan;

  test('audio deep-dive plan shape (DOCUMENTED two-host format)', () => {
    expect(audio.modality).toBe('audio');
    expect(audio.mode).toBe('deep-dive');
    expect(audio.targetDurationSeconds).toBe(300);
    expect(audio.beats.length).toBe(6);
    expect(audio.audioTurns.length).toBe(22);
    expect(audio.videoScenes.length).toBe(0);
    expect(new Set(audio.audioTurns.map((t) => t.speaker))).toEqual(new Set(['Host A', 'Host B']));
    const purposes = new Set(audio.audioTurns.map((t) => t.purpose));
    const expectedPurposes: AudioTurnPurpose[] = [
      'framing',
      'question',
      'explanation',
      'example',
      'clarification',
      'connection',
      'transition',
      'synthesis',
      'conclusion',
    ];
    for (const expected of expectedPurposes) {
      expect(purposes.has(expected)).toBe(true);
    }
    const durationSum = audio.audioTurns.reduce((acc, t) => acc + t.targetDurationSeconds, 0);
    expect(durationSum).toBe(300);
    const weightSum = audio.beats.reduce((acc, b) => acc + b.weight, 0);
    expect(Math.abs(weightSum - 1)).toBeLessThan(0.005);
  });

  test('video explainer plan shape (atlas visual grammar)', () => {
    expect(video.modality).toBe('video');
    expect(video.mode).toBe('explainer');
    expect(video.targetDurationSeconds).toBe(420);
    expect(video.beats.length).toBe(6);
    expect(video.videoScenes.length).toBe(15);
    expect(video.audioTurns.length).toBe(0);
    const byClass = {
      deterministic: video.videoScenes.filter((s) => s.renderingClass === 'deterministic').length,
      generative: video.videoScenes.filter((s) => s.renderingClass === 'generative').length,
      hybrid: video.videoScenes.filter((s) => s.renderingClass === 'hybrid').length,
    };
    expect(byClass.deterministic).toBe(10);
    expect(byClass.generative).toBe(3);
    expect(byClass.hybrid).toBe(2);
    const durationSum = video.videoScenes.reduce((acc, s) => acc + s.targetDurationSeconds, 0);
    expect(durationSum).toBe(420);
    for (const scene of video.videoScenes) {
      if (scene.renderingClass !== 'generative') {
        expect(scene.exactTexts.some((t) => t.exact)).toBe(true);
      }
      expect(scene.styleBibleId).toBe('style-bible--reference-ink');
    }
  });

  test('both plans account for every graph claim', () => {
    for (const plan of [audio, video]) {
      const covered = new Set(plan.coverage.covered.map((c) => c.claimId));
      const omitted = new Set(plan.coverage.omitted.map((o) => o.claimId));
      expect(plan.coverage.omitted.length).toBe(0); // at 5/7 minutes everything fits
      for (const claim of graph.claims) {
        expect(covered.has(claim.id) || omitted.has(claim.id)).toBe(true);
      }
    }
  });
});

describe('example fixtures', () => {
  test('generated artifact example is clearly synthetic but well-formed', () => {
    const artifact = loadJson(`${FIXTURE_DIR}/generated-artifact.example.json`) as GeneratedArtifact;
    expect(artifact.kind).toBe('audio-overview');
    expect(artifact.media.audio).toBeDefined();
    expect(artifact.providers.length).toBeGreaterThanOrEqual(1);
    expect(artifact.notes).toContain('Synthetic');
  });

  test('experiment record example carries evidence labels on observations', () => {
    const record = loadJson(`${FIXTURE_DIR}/experiment-record.example.json`) as {
      observations: string[];
    };
    for (const observation of record.observations) {
      expect(hasEvidenceLabel(observation)).toBe(true);
    }
  });
});