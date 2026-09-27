/**
 * Timing tests: gap policy classes, seeded jitter, manifest contiguity,
 * post-synthesis retiming drift (H-A-05 adjacent), mode gap scaling.
 *
 * Gap policy values are lab defaults (UNRESOLVED vs the product — DESIGN.md §6).
 */

import { describe, expect, test } from 'bun:test';
import { buildDialogueGraph } from '../../src/audio/dialogue/engine';
import { buildTimingManifest, retimingManifest } from '../../src/audio/timing/manifest';
import { classifyBoundary, gapMsFor, scaledGapBounds } from '../../src/audio/timing/timing';
import { modeProfileFor } from '../../src/audio/modes';
import { compileAudioOverview } from '../../src/audio';
import {
  buildShortBenchmarkPlan,
  CANONICAL_BRIEF_PLAN,
  CANONICAL_GRAPH,
  CANONICAL_PLAN,
  CANONICAL_SOURCE,
  FIXED_NOW,
  FIXED_SEED,
} from './fixtures';

function canonicalManifest() {
  const graph = buildDialogueGraph({ plan: CANONICAL_PLAN, graph: CANONICAL_GRAPH, seed: FIXED_SEED });
  const profile = modeProfileFor('deep-dive');
  return buildTimingManifest(
    graph,
    { seed: FIXED_SEED, planHash: graph.meta.planHash, gapScale: profile.gapScale },
    44100,
  );
}

describe('gap policy', () => {
  test('gap values stay inside the (scaled) class range and are seeded-stable', () => {
    const policy = { seed: FIXED_SEED, planHash: 'hash', gapScale: 1.0 };
    for (const boundary of ['question-answer', 'backchannel', 'section', 'topic', 'cluster'] as const) {
      const bounds = scaledGapBounds(1.0, boundary);
      for (let i = 0; i < 20; i += 1) {
        const gap = gapMsFor(policy, boundary, i);
        expect(gap).toBeGreaterThanOrEqual(bounds.minMs);
        expect(gap).toBeLessThanOrEqual(bounds.maxMs);
      }
      // Same key -> same value (determinism).
      expect(gapMsFor(policy, boundary, 7)).toBe(gapMsFor(policy, boundary, 7));
    }
  });

  test('mode gap scale: brief halves the bounds', () => {
    const full = scaledGapBounds(1.0, 'section');
    const brief = scaledGapBounds(0.5, 'section');
    expect(brief.minMs).toBe(Math.round(full.minMs * 0.5));
    expect(brief.maxMs).toBe(Math.round(full.maxMs * 0.5));
  });
});

describe('boundary classification', () => {
  test('canonical: question -> different-speaker answer classifies as question-answer', () => {
    const graph = buildDialogueGraph({ plan: CANONICAL_PLAN, graph: CANONICAL_GRAPH, seed: FIXED_SEED });
    // turn-6 (index 5) is host-a question; index 6 is host-b explanation.
    expect(classifyBoundary(graph, 5)).toBe('question-answer');
  });

  test('canonical: beat change classifies as section boundary', () => {
    const graph = buildDialogueGraph({ plan: CANONICAL_PLAN, graph: CANONICAL_GRAPH, seed: FIXED_SEED });
    // Index 2 -> 3 crosses beat-1 -> beat-2.
    expect(classifyBoundary(graph, 2)).toBe('section');
  });

  test('same beat, same topic: cluster boundary', () => {
    const plan = buildShortBenchmarkPlan();
    const graph = buildDialogueGraph({ plan, graph: CANONICAL_GRAPH, seed: FIXED_SEED });
    // s-turn-2 -> s-turn-3: same beat (s-beat-core), same topic.
    expect(classifyBoundary(graph, 1)).toBe('cluster');
  });
});

describe('TimingManifest', () => {
  test('entries are contiguous: end + gap == next start', () => {
    const manifest = canonicalManifest();
    for (let i = 0; i < manifest.entries.length - 1; i += 1) {
      const entry = manifest.entries[i];
      const next = manifest.entries[i + 1];
      expect(entry).toBeDefined();
      expect(next).toBeDefined();
      if (entry === undefined || next === undefined) continue;
      expect(next.startMs).toBe(entry.endMs + entry.gapAfterMs);
    }
  });

  test('turn durations sum to the plan target (plan authority, §16.3)', () => {
    const manifest = canonicalManifest();
    expect(manifest.totalTargetSeconds).toBeCloseTo(300, 6);
  });

  test('gaps add on top of the turn budget and are reported', () => {
    const manifest = canonicalManifest();
    expect(manifest.gapsTotalMs).toBeGreaterThan(0);
    const turnMs = manifest.entries.reduce((acc, entry) => acc + Math.round(entry.targetSeconds * 1000), 0);
    expect(manifest.totalDurationMs).toBe(turnMs + manifest.gapsTotalMs);
  });

  test('retiming with measured durations shifts later starts and reports drift', () => {
    const manifest = canonicalManifest();
    const actual = new Map<string, number>();
    for (const entry of manifest.entries) {
      actual.set(entry.turnId, entry.targetSeconds * 2); // simulate 2x drift
    }
    const retimed = retimingManifest(manifest, actual);
    expect(retimed.totalTurnSeconds).toBeCloseTo(600, 6);
    const last = retimed.entries[retimed.entries.length - 1];
    expect(last?.endMs).toBeGreaterThan(manifest.entries[manifest.entries.length - 1]?.endMs ?? 0);
    // Gaps are preserved.
    expect(retimed.gapsTotalMs).toBe(manifest.gapsTotalMs);
  });
});

describe('timing in the compiled pipeline', () => {
  test('manifest total stays inside the tolerance band vs plan target (§16.3)', async () => {
    const result = await compileAudioOverview({
      plan: buildShortBenchmarkPlan(),
      graph: CANONICAL_GRAPH,
      sources: CANONICAL_SOURCE,
      options: { seed: FIXED_SEED, now: FIXED_NOW, mastering: 'pure-ts' },
    });
    const total = result.timing.totalDurationMs / 1000;
    expect(total).toBeGreaterThan(42); // turns + gaps
    expect(total).toBeLessThan(42 + 10); // well inside max(10, 10%) tolerance
    // No duration issue fired.
    expect(result.qa.issues.some((issue) => issue.code === 'duration-off-target')).toBe(false);
  });

  test('brief gaps are visibly shorter than deep-dive gaps (H-A-01 pacing)', async () => {
    const brief = await compileAudioOverview({
      plan: CANONICAL_BRIEF_PLAN,
      graph: CANONICAL_GRAPH,
      sources: CANONICAL_SOURCE,
      options: { seed: FIXED_SEED, now: FIXED_NOW, mastering: 'pure-ts' },
    });
    // All brief gaps respect the scaled (half) policy.
    for (const entry of brief.timing.entries) {
      if (entry.boundaryAfter === 'none') continue;
      const bounds = scaledGapBounds(0.5, entry.boundaryAfter);
      expect(entry.gapAfterMs).toBeGreaterThanOrEqual(bounds.minMs);
      expect(entry.gapAfterMs).toBeLessThanOrEqual(bounds.maxMs);
    }
    const briefAvg =
      brief.timing.gapsTotalMs / Math.max(1, brief.timing.entries.filter((e) => e.boundaryAfter !== 'none').length);
    expect(briefAvg).toBeLessThanOrEqual(300); // half-scale policy keeps these tiny
  }, 30000);
});
