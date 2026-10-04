/**
 * Comparison harness end-to-end tests (WFLX-P3 Deliverable D / EV-026).
 *
 * Runs the comparison harness end-to-end on the canonical fixture:
 *   - the AUDIO suite compiles the LAB-canonical source through the offline
 *     deterministic lab pipeline (the EXP-A series constants — the full arm
 *     set incl. the b30 mutation chain and the determinism double-run) and
 *     emits the dimension records;
 *   - the VIDEO harness reads the committed runner outputs and emits the
 *     video dimension records.
 *
 * Asserts the record invariants (record count, required fields,
 * pending-discipline) plus the mechanical verdict rules:
 *   - record counts: 8 audio + 6 video;
 *   - the honest-boundary verdicts are the ones the records actually carry
 *     (DIVERGENT duration-class gaps recorded, never normalized);
 *   - every PENDING metric is the COMPARISON PENDING REFERENCE CAPTURE
 *     honest gap with a NULL product value;
 *   - lab measurements reproduce the committed exp-a-r2 store (turn counts)
 *     — the determinism spine;
 *   - the mutation-locality axis measures the C-5 turn-local behavior.
 *
 * Lab reproduction evidence only — NOT product parity evidence (AGENTS.md).
 */

import { describe, expect, test } from 'bun:test';
import { PENDING_REASON, type ComparisonRecord } from '../../tools/comparison/schema';
import { runAudioComparisonSuite } from '../../tools/comparison/audio-suite';
import { buildVideoComparisonRecordsFromCommittedStore } from '../../tools/comparison/video-hooks';

function metricOf(record: ComparisonRecord, name: string) {
  const metric = record.comparison.metrics.find((candidate) => candidate.metric === name);
  if (metric === undefined) throw new Error(`metric ${name} not found in ${record.id}`);
  return metric;
}

describe('comparison harness end-to-end (EV-026)', () => {
  test('audio suite: 8 records, required fields, verdict vocabulary, pending-discipline', async () => {
    const suite = await runAudioComparisonSuite();
    expect(suite.records.length).toBe(8);
    expect(suite.records.map((record) => record.id)).toEqual([
      'AUDIO-PARITY-01',
      'AUDIO-PARITY-02',
      'AUDIO-PARITY-03',
      'AUDIO-PARITY-04',
      'AUDIO-PARITY-05',
      'AUDIO-PARITY-06',
      'AUDIO-PARITY-07',
      'AUDIO-PARITY-08',
    ]);
    for (const record of suite.records) {
      expect(record.recordType).toBe('ComparisonRecord');
      expect(record.operator).toBe('wflx-p3');
      expect(record.comparison.metrics.length).toBeGreaterThan(0);
      for (const metric of record.comparison.metrics) {
        expect(['VERIFIED', 'DIVERGENT', 'PENDING']).toContain(metric.verdict);
        if (metric.verdict === 'PENDING') {
          expect(metric.pending_reason).toBe(PENDING_REASON);
          expect(metric.product.value).toBeNull();
        } else {
          expect(metric.product.value).not.toBeNull();
          expect(metric.lab.value).not.toBeNull();
        }
      }
    }
    // AUDIO-PARITY-08 was FILLED 2026-10-04 (LAB-13: the Interactive Audio
    // product capture — join -> typed question -> source-grounded response
    // -> original episode resumes). It is now a dimension-comparison record
    // with VERIFIED metrics; no audio pending-slot remains.
    for (const id of ['AUDIO-PARITY-08']) {
      const record = suite.records.find((candidate) => candidate.id === id);
      if (record === undefined) throw new Error(`${id} missing`);
      expect(record.kind).toBe('dimension-comparison');
      expect(record.tl_hooks.length).toBe(0);
      for (const metric of record.comparison.metrics) {
        expect(metric.verdict).toBe('VERIFIED');
        expect(metric.pending_reason).toBeNull();
      }
    }
  }, 120_000);

  test('audio suite: lab measurements reproduce the committed exp-a-r2 store', async () => {
    const suite = await runAudioComparisonSuite();
    // Determinism spine: the suite's EXP-A-constants compiles must reproduce
    // the committed exp-a-r2 arm structure (turn counts are plan-pinned).
    expect(suite.arms['deepdive-5min-baseline']?.turnCount).toBe(20);
    expect(suite.arms['brief-2min-canonical']?.turnCount).toBe(6);
    expect(suite.arms['critique-5min-canonical']?.turnCount).toBe(19);
    expect(suite.arms['debate-5min-canonical']?.turnCount).toBe(19);
    expect(suite.arms['deepdive-3min-duration']?.turnCount).toBe(18);
    expect(suite.arms['deepdive-5min-es']?.turnCount).toBe(20);
    expect(suite.arms['a04-control-deepdive-5min']?.turnCount).toBe(24);
    expect(suite.arms['a04-mut-b30-deepdive-5min']?.turnCount).toBe(24);
    expect(suite.determinism.byteIdentical).toBe(true);
  }, 120_000);

  test('audio suite: the declared mechanical verdict rules hold on the recorded numbers', async () => {
    const suite = await runAudioComparisonSuite();
    const byId = (id: string): ComparisonRecord => {
      const record = suite.records.find((candidate) => candidate.id === id);
      if (record === undefined) throw new Error(`${id} missing`);
      return record;
    };

    // Deep Dive: speaker parity VERIFIED; duration-class gap DIVERGENT.
    expect(metricOf(byId('AUDIO-PARITY-01'), 'deepdive.structure.speakerCount').verdict).toBe('VERIFIED');
    expect(metricOf(byId('AUDIO-PARITY-01'), 'deepdive.duration.seconds').verdict).toBe('DIVERGENT');
    expect(metricOf(byId('AUDIO-PARITY-01'), 'deepdive.duration.seconds').lab.value).toBe(300);
    expect(metricOf(byId('AUDIO-PARITY-01'), 'deepdive.duration.seconds').product.value).toBeCloseTo(
      1201.82,
      2,
    );

    // Mode family: voice counts VERIFIED; brief duration within the declared
    // ratio band; dialogic durations DIVERGENT (class gap recorded).
    expect(metricOf(byId('AUDIO-PARITY-02'), 'mode.brief.voiceCount').verdict).toBe('VERIFIED');
    expect(metricOf(byId('AUDIO-PARITY-02'), 'mode.brief.duration.seconds').verdict).toBe('VERIFIED');
    expect(metricOf(byId('AUDIO-PARITY-02'), 'mode.critique.duration.seconds').verdict).toBe('DIVERGENT');
    expect(metricOf(byId('AUDIO-PARITY-02'), 'mode.debate.duration.seconds').verdict).toBe('DIVERGENT');

    // Length control: compression magnitudes + philosophy DIVERGENT (recorded).
    expect(metricOf(byId('AUDIO-PARITY-03'), 'lengthControl.compressionRatio').verdict).toBe('DIVERGENT');
    expect(metricOf(byId('AUDIO-PARITY-03'), 'lengthControl.coverageBehavior').verdict).toBe('DIVERGENT');
    expect(metricOf(byId('AUDIO-PARITY-03'), 'lengthControl.speakerCountPreserved').verdict).toBe('VERIFIED');

    // Language: plan structure invariant both sides; surface + duration shift DIVERGENT.
    expect(metricOf(byId('AUDIO-PARITY-04'), 'language.planStructureInvariance').verdict).toBe('VERIFIED');
    expect(metricOf(byId('AUDIO-PARITY-04'), 'language.surfaceRegeneration').verdict).toBe('DIVERGENT');
    expect(metricOf(byId('AUDIO-PARITY-04'), 'language.durationShiftPercent').verdict).toBe('DIVERGENT');

    // Mutation locality: content voiced + macro preserved VERIFIED; locality class DIVERGENT.
    expect(metricOf(byId('AUDIO-PARITY-05'), 'mutation.mutatedContentVoiced').verdict).toBe('VERIFIED');
    expect(metricOf(byId('AUDIO-PARITY-05'), 'mutation.localityClass').verdict).toBe('DIVERGENT');
    expect(suite.mutationLocality.mutatedContentVoiced).toBe(true);
    expect(suite.mutationLocality.structureChangedTurns).toBe(0);
    // C-5 turn-local behavior: the large majority of realized texts stay
    // byte-identical across the b30 mutation (the EXP-X-02 family result).
    expect(suite.mutationLocality.textIdenticalTurns).toBeGreaterThanOrEqual(20);
    expect(suite.mutationLocality.textChangedTurns).toBeLessThanOrEqual(4);

    // Twin stochasticity: deterministic lab vs stochastic product, recorded.
    expect(metricOf(byId('AUDIO-PARITY-06'), 'stochasticity.runToRunByteIdentity').verdict).toBe('DIVERGENT');
    expect(metricOf(byId('AUDIO-PARITY-06'), 'stochasticity.macroPatternStability').verdict).toBe('VERIFIED');

    // Custom steering prompt (LAB-10, filled 2026-10-02): the product has an
    // episode-level audio custom-steering surface the lab lacks (DIVERGENT,
    // recorded); duration response -28.2% vs the same-lane era-control
    // (DIVERGENT vs the lab's 0-by-construction); macro structure preserved
    // under the focus on both sides (VERIFIED).
    expect(metricOf(byId('AUDIO-PARITY-07'), 'customPrompt.steeringEffect').verdict).toBe('DIVERGENT');
    expect(metricOf(byId('AUDIO-PARITY-07'), 'customPrompt.durationResponse').verdict).toBe('DIVERGENT');
    expect(metricOf(byId('AUDIO-PARITY-07'), 'customPrompt.durationResponse').product.value).toBe(-28.2);
    expect(metricOf(byId('AUDIO-PARITY-07'), 'customPrompt.structurePreservation').verdict).toBe('VERIFIED');
    expect(byId('AUDIO-PARITY-07').kind).toBe('dimension-comparison');
    expect(byId('AUDIO-PARITY-07').duration_seconds).toBeCloseTo(1015.803356, 4);
  }, 120_000);

  test('video harness: 6 records from the committed runner outputs, invariants + honest verdicts', () => {
    const records = buildVideoComparisonRecordsFromCommittedStore();
    expect(records.length).toBe(6);
    expect(records.map((record) => record.id)).toEqual([
      'VIDEO-PARITY-01',
      'VIDEO-PARITY-02',
      'VIDEO-PARITY-03',
      'VIDEO-PARITY-04',
      'VIDEO-PARITY-05',
      'VIDEO-PARITY-06',
    ]);

    // Short: product n=3 duration band above the lab target (DIVERGENT,
    // recorded); geometry gap DIVERGENT; audio stream parity VERIFIED;
    // hook prominence PENDING (structured annotation pending).
    const short = records.find((record) => record.id === 'VIDEO-PARITY-01');
    if (short === undefined) throw new Error('VIDEO-PARITY-01 missing');
    expect(metricOf(short, 'short.duration.seconds').verdict).toBe('DIVERGENT');
    expect(metricOf(short, 'short.duration.seconds').product.value).toBeCloseTo(84.822494, 4);
    expect(metricOf(short, 'short.geometry.aspect').verdict).toBe('DIVERGENT');
    expect(metricOf(short, 'short.audioStream').verdict).toBe('VERIFIED');
    // Hook prominence: FILLED 2026-10-02 from the structured annotation —
    // product ~4 s hook sentence (5.1% mean, n=3) vs the lab's full opening
    // beat (25%) — DIVERGENT, granularity-robust.
    expect(metricOf(short, 'short.hookProminence.share').verdict).toBe('DIVERGENT');
    expect(metricOf(short, 'short.hookProminence.share').product.value).toBe(5.1);
    expect(metricOf(short, 'short.hookProminence.share').lab.value).toBe(25);
    expect(metricOf(short, 'short.twinStochasticity').verdict).toBe('DIVERGENT');
    // The instrument-truth sceneDensity numbers live in observations, not metrics.
    expect(short.comparison.metrics.find((m) => m.metric.includes('sceneDensity'))).toBeUndefined();
    expect(
      short.observations.some((observation) => observation.text.includes('3 cuts (LAB-07) / 13 (LAB-08) / 1 (LAB-09)')),
    ).toBe(true);

    // Cinematic: scoping truth recorded, all metrics PENDING (no product format).
    const cinematic = records.find((record) => record.id === 'VIDEO-PARITY-02');
    if (cinematic === undefined) throw new Error('VIDEO-PARITY-02 missing');
    expect(cinematic.kind).toBe('pending-slot');
    expect(
      cinematic.unresolved_behavior.some((note) => note.includes('NO Cinematic product format exists')),
    ).toBe(true);

    // Explainer: golden-reference duration within band VERIFIED; geometry + audio VERIFIED.
    const explainer = records.find((record) => record.id === 'VIDEO-PARITY-03');
    if (explainer === undefined) throw new Error('VIDEO-PARITY-03 missing');
    expect(metricOf(explainer, 'explainer.duration.seconds').verdict).toBe('VERIFIED');
    expect(metricOf(explainer, 'explainer.geometry').verdict).toBe('VERIFIED');
    expect(metricOf(explainer, 'explainer.audioStream').verdict).toBe('VERIFIED');

    // Custom prompt: steering semantics DIVERGENT (recorded distinction).
    const custom = records.find((record) => record.id === 'VIDEO-PARITY-04');
    if (custom === undefined) throw new Error('VIDEO-PARITY-04 missing');
    expect(metricOf(custom, 'custom.steeringSemantics').verdict).toBe('DIVERGENT');
    expect(metricOf(custom, 'custom.formatInvariantPreservation').verdict).toBe('VERIFIED');

    // Language + mutation locality: FILLED 2026-10-02 (LAB-11 + LAB-12) —
    // language: structure VERIFIED (audio-surface analog), surface regeneration
    // DIVERGENT (no lab non-English video arm), duration shift -3.5% WITHIN
    // the ±5pp tolerance (vs the audio surface's -13.9%); mutation: locality
    // class DIVERGENT (lab C-5 scene-local vs product global re-plan), macro
    // structure preservation VERIFIED.
    const lang = records.find((record) => record.id === 'VIDEO-PARITY-05');
    if (lang === undefined) throw new Error('VIDEO-PARITY-05 missing');
    expect(lang.kind).toBe('dimension-comparison');
    expect(metricOf(lang, 'language.videoStructureInvariance').verdict).toBe('VERIFIED');
    expect(metricOf(lang, 'language.surfaceRegeneration').verdict).toBe('DIVERGENT');
    expect(metricOf(lang, 'language.videoDurationShiftPercent').verdict).toBe('VERIFIED');
    expect(metricOf(lang, 'language.videoDurationShiftPercent').product.value).toBe(-3.5);
    expect(lang.duration_seconds).toBeCloseTo(81.82712, 4);

    const mut = records.find((record) => record.id === 'VIDEO-PARITY-06');
    if (mut === undefined) throw new Error('VIDEO-PARITY-06 missing');
    expect(mut.kind).toBe('dimension-comparison');
    expect(metricOf(mut, 'videoMutation.localityClass').verdict).toBe('DIVERGENT');
    expect(metricOf(mut, 'videoMutation.macroStructurePreservation').verdict).toBe('VERIFIED');
  });

  test('video harness: lab values match the committed runner outputs verbatim', () => {
    const records = buildVideoComparisonRecordsFromCommittedStore();
    const short = records.find((record) => record.id === 'VIDEO-PARITY-01');
    if (short === undefined) throw new Error('VIDEO-PARITY-01 missing');
    // The lab measurement equals the committed EXP-V-S-01 timeline duration.
    expect(metricOf(short, 'short.duration.seconds').lab.value).toBe(60);
    const explainer = records.find((record) => record.id === 'VIDEO-PARITY-03');
    if (explainer === undefined) throw new Error('VIDEO-PARITY-03 missing');
    expect(metricOf(explainer, 'explainer.duration.seconds').lab.value).toBe(420);
    expect(metricOf(explainer, 'explainer.duration.seconds').product.value).toBeCloseTo(415.660408, 6);
  });
});
