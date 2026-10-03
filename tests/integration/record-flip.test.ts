/**
 * WFLX-V3A record-flip asserts (work order 34-WFLX-V3A — the EXP-V-05/06
 * re-run after the W1 multi-source unblock).
 *
 * Per the established regeneration pattern (comparison-schema.test.ts: the
 * in-memory builders reproduce the committed records byte-identically), this
 * suite re-executes the EXP-V-05/06 arms through the REAL runner machinery
 * (executeArms -> buildExperimentResult -> assembleRecord ->
 * renderRecordYaml — the exact path the committed estate was produced with)
 * and asserts:
 *
 *   1. REGENERATION — both flipped records regenerate byte-identically from
 *      the committed docs/experiments/records/ files (determinism spine);
 *   2. THE FLIP ITSELF — the records carry real results (status supported,
 *      superseded-blocker notes pointing at the fix commit, measured
 *      observations), NOT blocked-era content;
 *   3. THE HANDOFF LAW — the experiment CONFIGS are unchanged: the EXP-V-05/06
 *      arm specs are still the original 'video-blocked' definitions (the flip
 *      came from runner code, never from a config redesign);
 *   4. THE REMOVAL CONTROL — EXP-V-06's single-source control ran as its own
 *      arm and participates as the diff variant.
 *
 * Lab reproduction evidence only — NOT product parity evidence (AGENTS.md).
 */

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EXPERIMENT_CONFIGS } from '../../tools/experiments/configs';
import { executeArms, buildExperimentResult } from '../../tools/experiments/runner';
import { renderRecordYaml, W1_FIX_COMMIT } from '../../tools/experiments/records';

const FLIP_IDS = ['EXP-V-05', 'EXP-V-06'] as const;

describe('WFLX-V3A record flip (EXP-V-05/06 re-run after the W1 unblock)', () => {
  test('the experiment configs are UNCHANGED — the arm specs are still the original video-blocked definitions', () => {
    for (const id of FLIP_IDS) {
      const config = EXPERIMENT_CONFIGS.find((c) => c.id === id);
      if (config === undefined) throw new Error(`${id} config missing`);
      // The HANDOFF law: re-run UNCHANGED. The flip lives in the runner code
      // (pipeline/records/runner), never in a config redesign.
      expect(config.arms.length).toBeGreaterThan(0);
      for (const spec of config.arms) {
        // The HANDOFF law: the arm specs are the ORIGINAL blocked-era
        // definitions (kind, runIds, expectedBlocker) — byte-unchanged.
        expect(spec.kind).toBe('video-blocked');
        expect(spec.experiment).toBe(
          config.id === 'EXP-V-05'
            ? spec.runId === 'multisource-order-ab'
              ? 'exp-v-05-baseline'
              : 'exp-v-05'
            : 'exp-v-06-baseline',
        );
        if (spec.kind !== 'video-blocked') throw new Error(`${config.id}: arm kind drifted`);
        expect(spec.expectedBlocker).toBe('DeterministicExtractor produced an inconsistent graph');
      }
      expect(config.mutation).toBe(
        id === 'EXP-V-05'
          ? 'source ordering: [A, B] -> [B, A] (same two sources, order swapped)'
          : 'one source removed: [A, B] -> [A]',
      );
      expect(config.selected_sources).toEqual([
        'source-note-a',
        'source-note-b (raw fixture split at the Section 2 marker)',
      ]);
      // The blocked-era authored status stays in configs (byte-unchanged);
      // the record overlay supplies the re-run verdict.
      expect(config.authored.status).toBe('blocked');
    }
  });

  test('the flipped records regenerate byte-identically through the real runner machinery', async () => {
    const configs = EXPERIMENT_CONFIGS.filter((c) => FLIP_IDS.includes(c.id as (typeof FLIP_IDS)[number]));
    expect(configs.length).toBe(2);
    const cache = await executeArms(configs, true);
    for (const config of configs) {
      const { record } = buildExperimentResult(config, cache);
      const committed = readFileSync(join('docs/experiments/records', `${config.id}.yaml`), 'utf8');
      expect(renderRecordYaml(record)).toBe(committed);
    }
  }, 240_000);

  test('the records carry REAL results, not blocked-era content', async () => {
    const configs = EXPERIMENT_CONFIGS.filter((c) => FLIP_IDS.includes(c.id as (typeof FLIP_IDS)[number]));
    const cache = await executeArms(configs, true);
    for (const config of configs) {
      const { result, record } = buildExperimentResult(config, cache);
      // The flip: computed verdicts, superseded-blocker provenance.
      expect(record.status).toBe('supported');
      expect(record.hypothesis.startsWith('UNTESTED (blocked)')).toBe(false);
      expect(record.observations.some((o) => o.includes('SUPERSEDED-BLOCKER'))).toBe(true);
      expect(record.observations.some((o) => o.includes(W1_FIX_COMMIT))).toBe(true);
      // Real measured observations flowed through the standard machinery.
      expect(record.observations.some((o) => o.startsWith('BASELINE (REPRODUCED)'))).toBe(true);
      expect(record.observations.some((o) => o.startsWith('VARIANT '))).toBe(true);
      expect(record.observations.some((o) => o.startsWith('STRUCTURE vs BASELINE'))).toBe(true);
      expect(record.differences.length).toBeGreaterThan(0);
      // Blocked-era emptiness is gone.
      expect(record.baseline_artifact).not.toBe('');
      expect(record.artifact_under_test).not.toBe('');
      expect(record.artifact_hash).not.toBe('');
      expect(record.observations.some((o) => o.startsWith('BLOCKED ARM EVIDENCE'))).toBe(false);
      // The summary-facing status follows the record (post-flip), not the
      // config's blocked-era field.
      expect(result.status).toBe('supported');
    }
  }, 240_000);

  test('EXP-V-06: the single-source removal control ran as its own arm and is the diff variant', async () => {
    const config = EXPERIMENT_CONFIGS.find((c) => c.id === 'EXP-V-06');
    if (config === undefined) throw new Error('EXP-V-06 config missing');
    const cache = await executeArms([config], true);
    const { result, record } = buildExperimentResult(config, cache);
    const control = result.arms.find((arm) => arm.runId === 'multisource-removed-b');
    if (control === undefined) throw new Error('removal control arm missing from the result');
    expect(control.kind).toBe('video');
    expect(result.videoDiffs[0]?.variant).toBe('multisource-removed-b');
    // The honest removal evidence: graph-level drops + recombination.
    expect(result.graphDiff?.topicsRemoved).toEqual([
      'Infrastructure',
      'Architecture and workflows',
      'Purpose',
    ]);
    expect(record.observations.some((o) => o.includes('SOURCE REMOVAL (REPRODUCED)'))).toBe(true);
    expect(record.observations.some((o) => o.includes('ID-RENAME TRUTH (REPRODUCED)'))).toBe(true);
    expect(record.evidence_paths).toContain('artifacts/video/exp-v/multisource-removed-b');
  }, 240_000);

  test('EXP-V-05: the order-swap verdict is computed from the measured diff', async () => {
    const config = EXPERIMENT_CONFIGS.find((c) => c.id === 'EXP-V-05');
    if (config === undefined) throw new Error('EXP-V-05 config missing');
    const cache = await executeArms([config], true);
    const { result, record } = buildExperimentResult(config, cache);
    const diff = result.videoDiffs[0];
    if (diff === undefined) throw new Error('EXP-V-05 order diff missing');
    expect(diff.variant).toBe('multisource-order-ba');
    expect(diff.baselineRunId).toBe('multisource-order-ab');
    // The verdict line carries the measured numbers.
    expect(record.observations.some((o) => o.startsWith('SOURCE ORDER (REPRODUCED)'))).toBe(true);
    expect(record.observations.some((o) => o.startsWith('ORDER CHANNELS (REPRODUCED)'))).toBe(true);
    // The graph content is order-invariant (id/name-keyed diff all empty).
    expect(result.graphDiff?.claimsAdded).toEqual([]);
    expect(result.graphDiff?.claimsRemoved).toEqual([]);
  }, 240_000);
});
