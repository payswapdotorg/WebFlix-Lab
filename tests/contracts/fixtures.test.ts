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
import { compileOverviewPlan } from '../../src/director/compiler';
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
      'plan-audio-brief-2min.json',
      'plan-audio-critique-5min.json',
      'plan-audio-debate-5min.json',
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

describe('canonical per-mode plan fixtures (Director-emitted, H-2)', () => {
  const graph = loadJson(`${FIXTURE_DIR}/reference-messy-note.semantic-graph.json`) as SemanticGraph;
  const source = loadJson(`${FIXTURE_DIR}/reference-messy-note.source-artifact.json`) as SourceArtifact;
  const deepDive = loadJson(`${FIXTURE_DIR}/plan-audio-deep-dive-5min.json`) as OverviewPlan;
  const brief = loadJson(`${FIXTURE_DIR}/plan-audio-brief-2min.json`) as OverviewPlan;
  const critique = loadJson(`${FIXTURE_DIR}/plan-audio-critique-5min.json`) as OverviewPlan;
  const debate = loadJson(`${FIXTURE_DIR}/plan-audio-debate-5min.json`) as OverviewPlan;

  /**
   * Pinned content fingerprints (tamper-evidence; also EV-005 -> EV-008).
   * WFLX-P3A transition (turn-budget allocation fix, 2026-09-28):
   *   brief    fb2f6133a032589f894ba7116b1a0ff5d4ad0fba164f08637e4541ab530ba462 -> 2ccf7f2e892f8fcfff37aa7429e9e0fed59d8bf9260f8b858a5dcad6985b3b58
   *   critique 1c450ae50ce80d834bbc22fd4cb31e75c94c1b00739fac6d304188fff692763e -> 59b37965895b7618f0362ce2a9a778f143a505b97fc5ba8b5c81243ddfc6cda1
   *   debate   c2b22eb1b37b84198f65cdff1ae9e9bf988e3448b5ebaaf5b085489afb82eecb -> e2fab2a77778fa22f348dd2bd8d194a9da8c616372079cd9db39e878e2b5e4bc
   * (same seeds / FIXED_TS / planIds; only the Director-emitted plans and
   * their s15/s16/s17 mutants changed — the Stage-2 hand-built fixtures are
   * byte-frozen and untouched.)
   *
   * v2 CONTRACT WAVE transition (CONTRACTS_VERSION 1.0.0 -> 2.0.0,
   * 2026-09-30): every fixture's per-record contractVersion field re-stamps
   * to 2.0.0 (the ONLY field that changes — plan structure is untouched;
   * re-keying lands later in the same wave and does not reach plan compile):
   *   brief    2ccf7f2e892f8fcfff37aa7429e9e0fed59d8bf9260f8b858a5dcad6985b3b58 -> 148049532bda00117dfc9ed482f4b8fef111069286f3fe10e46a2185de88458d
   *   critique 59b37965895b7618f0362ce2a9a778f143a505b97fc5ba8b5c81243ddfc6cda1 -> f74e09e4eefb98e97c434c91423436ee0883555cd593889c22519f04a1790af9
   *   debate   e2fab2a77778fa22f348dd2bd8d194a9da8c616372079cd9db39e878e2b5e4bc -> 258e96bd8b9a18bc55c2e465a5c43041c08d71ee1cb989274a32e3928085b25a
   * Old values preserved as git history (never silently re-pinned).
   */
  const FINGERPRINTS: Record<string, string> = {
    'plan-audio-brief-2min.json': '148049532bda00117dfc9ed482f4b8fef111069286f3fe10e46a2185de88458d',
    'plan-audio-critique-5min.json': 'f74e09e4eefb98e97c434c91423436ee0883555cd593889c22519f04a1790af9',
    'plan-audio-debate-5min.json': '258e96bd8b9a18bc55c2e465a5c43041c08d71ee1cb989274a32e3928085b25a',
  };

  test('pinned fingerprints match the checked-in fixtures', async () => {
    for (const [file, expected] of Object.entries(FINGERPRINTS)) {
      const content = await Bun.file(`${FIXTURE_DIR}/${file}`).text();
      expect(sha256Hex(content)).toBe(expected);
    }
  });

  test('Director parity: recompiling each plan reproduces the fixture byte-identically', async () => {
    const specs = [
      { file: 'plan-audio-brief-2min.json', mode: 'brief' as const, dur: 120 },
      { file: 'plan-audio-critique-5min.json', mode: 'critique' as const, dur: 300 },
      { file: 'plan-audio-debate-5min.json', mode: 'debate' as const, dur: 300 },
    ];
    for (const spec of specs) {
      const compiled = compileOverviewPlan({
        sources: [source],
        graph,
        modality: 'audio',
        mode: spec.mode,
        audience: 'technical',
        language: 'en',
        targetDurationSeconds: spec.dur,
        seed: `wflx-canonical-audio-${spec.mode}-${Math.round(spec.dur / 60)}min`,
        now: '2026-09-26T00:00:00Z',
        planId: `plan-messy-note-audio-${spec.mode}-${Math.round(spec.dur / 60)}min`,
      });
      const onDisk = await Bun.file(`${FIXTURE_DIR}/${spec.file}`).text();
      expect(`${JSON.stringify(compiled, null, 2)}\n`).toBe(onDisk);
    }
  });

  test('all three Director-emitted plans pass guard and deep validation', () => {
    for (const plan of [brief, critique, debate]) {
      expect(OverviewPlanSchema.safeParse(plan).success).toBe(true);
      expect(validateOverviewPlan(plan, graph, source).valid).toBe(true);
      expect(plan.generator.name).toBe('OverviewDirector@0.1.0');
      expect(plan.generator.deterministic).toBe(true);
    }
  });

  test('H-A-01 (plan level): brief compresses coverage and the turn skeleton', () => {
    // Turn skeleton: brief uses only framing/explanation/conclusion purposes.
    const briefPurposes = new Set(brief.audioTurns.map((t) => t.purpose));
    for (const p of briefPurposes) {
      expect(['framing', 'explanation', 'conclusion']).toContain(p);
    }
    // Deep dive carries the exploration purposes brief drops.
    const deepPurposes = new Set(deepDive.audioTurns.map((t) => t.purpose));
    for (const p of ['example', 'connection', 'question'] as const) {
      expect(deepPurposes.has(p)).toBe(true);
      expect(briefPurposes.has(p)).toBe(false);
    }
    // Turn count: deep dive > brief for the same source graph.
    expect(deepDive.audioTurns.length).toBeGreaterThan(brief.audioTurns.length);
    // Coverage: brief is a strict subset; dropped claims carry reasons.
    const deepCovered = new Set(deepDive.coverage.covered.map((c) => c.claimId));
    const briefCovered = new Set(brief.coverage.covered.map((c) => c.claimId));
    expect(briefCovered.size).toBeLessThan(deepCovered.size);
    for (const claimId of briefCovered) {
      expect(deepCovered.has(claimId)).toBe(true);
    }
    expect(brief.coverage.omitted.length).toBe(deepCovered.size - briefCovered.size);
    for (const omitted of brief.coverage.omitted) {
      expect(omitted.reason.length).toBeGreaterThan(0);
      expect(briefCovered.has(omitted.claimId)).toBe(false);
    }
  });

  test('H-A-02/03 (plan level): critique and debate keep full coverage with distinct skeletons', () => {
    for (const plan of [critique, debate]) {
      const covered = new Set(plan.coverage.covered.map((c) => c.claimId));
      expect(covered.size).toBe(11);
      expect(plan.coverage.omitted.length).toBe(0);
    }
    // Critique and debate share the purpose multiset but invert the
    // speaker-purpose pairing: critique's questions come from host-a with
    // host-b clarifying; debate mirrors it (host-b interrogates, host-a
    // clarifies). This is the structural mode difference the Director encodes.
    const signature = (plan: OverviewPlan): string =>
      plan.audioTurns.map((t) => `${t.speakerRole}:${t.purpose}`).join(' ');
    expect(signature(critique)).not.toBe(signature(debate));
    const questionSpeakers = (plan: OverviewPlan): Set<string> =>
      new Set(plan.audioTurns.filter((t) => t.purpose === 'question').map((t) => t.speakerRole));
    expect(questionSpeakers(critique)).toEqual(new Set(['host-a']));
    expect(questionSpeakers(debate)).toEqual(new Set(['host-b']));
    const clarificationSpeakers = (plan: OverviewPlan): Set<string> =>
      new Set(plan.audioTurns.filter((t) => t.purpose === 'clarification').map((t) => t.speakerRole));
    expect(clarificationSpeakers(critique)).toEqual(new Set(['host-b']));
    expect(clarificationSpeakers(debate)).toEqual(new Set(['host-a']));
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