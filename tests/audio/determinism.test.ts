/**
 * THE determinism proof (DESIGN.md §10; work-order §3).
 *
 * Run the compiler twice with the same seed + inputs: turns, manifest,
 * artifact sidecar and media hash must be identical. A different seed changes
 * surface text (and therefore audio) but never the structure. The printed
 * hash pair is the deliverable evidence (regenerate with:
 *   bun test tests/audio/determinism.test.ts
 * ).
 */

import { describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { compileAudioOverview } from '../../src/audio';
import {
  CANONICAL_GRAPH,
  CANONICAL_PLAN,
  CANONICAL_SOURCE,
  FIXED_NOW,
  FIXED_SEED,
  FIXED_SEED_ALT,
} from './fixtures';

const sha = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

async function compileWith(seed: string) {
  return compileAudioOverview({
    plan: CANONICAL_PLAN,
    graph: CANONICAL_GRAPH,
    sources: CANONICAL_SOURCE,
    options: { seed, now: FIXED_NOW, mastering: 'pure-ts' },
  });
}

describe('same-seed determinism (the proof)', () => {
  test('two runs produce identical turns, manifest, artifact and WAV bytes', async () => {
    const runA = await compileWith(FIXED_SEED);
    const runB = await compileWith(FIXED_SEED);

    const turnsJsonA = JSON.stringify(runA.turns);
    const turnsJsonB = JSON.stringify(runB.turns);
    const manifestJsonA = JSON.stringify(runA.timing);
    const manifestJsonB = JSON.stringify(runB.timing);
    const artifactJsonA = JSON.stringify(runA.artifact);
    const artifactJsonB = JSON.stringify(runB.artifact);
    const wavShaA = sha(runA.wav);
    const wavShaB = sha(runB.wav);

    expect(turnsJsonA).toBe(turnsJsonB);
    expect(manifestJsonA).toBe(manifestJsonB);
    expect(artifactJsonA).toBe(artifactJsonB);
    expect(wavShaA).toBe(wavShaB);

    // Determinism evidence pair (also reported in the completion report).
    console.log(`[determinism] turns+manifest+artifact JSON equal: true`);
    console.log(`[determinism] wav sha256 run A: ${wavShaA}`);
    console.log(`[determinism] wav sha256 run B: ${wavShaB}`);
    console.log(`[determinism] artifact media sha256: ${runA.artifact.media.sha256}`);
    console.log(`[determinism] artifact id: ${runA.artifact.id}`);
    expect(runA.artifact.media.sha256).toBe(wavShaA);
  }, 120000);
});

describe('different seed: structure invariant, surface varies', () => {
  test('same skeleton and coverage, different surface text and audio', async () => {
    const runA = await compileWith(FIXED_SEED);
    const runC = await compileWith(FIXED_SEED_ALT);

    // Structure invariant: same turn ids, speakers, purposes, claims, links.
    expect(runC.graph.turns.map((t) => [t.id, t.speakerRole, t.purpose, [...t.claimIds]])).toEqual(
      runA.graph.turns.map((t) => [t.id, t.speakerRole, t.purpose, [...t.claimIds]]),
    );
    expect(runC.graph.turns.map((t) => t.links)).toEqual(runA.graph.turns.map((t) => t.links));

    // Coverage identical (claims are the anchors).
    expect(runC.plan.coverage).toEqual(runA.plan.coverage);

    // Surface differs somewhere.
    const sameTexts = runC.realized.filter((r, i) => r.text === runA.realized[i]?.text).length;
    expect(sameTexts).toBeLessThan(runC.realized.length);

    // Audio differs accordingly.
    expect(sha(runC.wav)).not.toBe(sha(runA.wav));
  }, 120000);
});
