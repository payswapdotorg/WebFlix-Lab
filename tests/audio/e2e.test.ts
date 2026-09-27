/**
 * End-to-end offline pipeline tests (Phase 2A exit criterion):
 * fixture plan => WAV + timing manifest + QA report + provenance sidecar.
 * Includes committed-benchmark parity (regeneration is byte-identical) and
 * the ffmpeg mastering path when available.
 *
 * Lab reproduction evidence only — NOT product-parity evidence (AGENTS.md).
 */

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { compileAudioOverview } from '../../src/audio';
import { stableStringify } from '../../src/audio/dialogue/engine';
import { decodeWav } from '../../src/audio/mixing/wav';
import { ffmpegAvailable } from '../../src/audio/mixing/ffmpeg';
import { GeneratedArtifactSchema } from '../../src/contracts';
import {
  buildShortBenchmarkPlan,
  CANONICAL_GRAPH,
  CANONICAL_PLAN,
  CANONICAL_SOURCE,
  FIXED_NOW,
  FIXED_SEED,
} from './fixtures';

const sha = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

describe('canonical deep-dive end-to-end (offline, pure-TS)', () => {
  test('plan -> WAV + manifest + QA + artifact sidecar', async () => {
    const result = await compileAudioOverview({
      plan: CANONICAL_PLAN,
      graph: CANONICAL_GRAPH,
      sources: CANONICAL_SOURCE,
      options: { seed: FIXED_SEED, now: FIXED_NOW, mastering: 'pure-ts' },
    });

    // WAV: correct format and duration (turns + gaps).
    const decoded = decodeWav(result.wav);
    expect(decoded.sampleRate).toBe(44100);
    expect(decoded.channels).toBe(1);
    expect(decoded.bitsPerSample).toBe(16);
    const durationSeconds = decoded.samples.length / decoded.sampleRate;
    expect(durationSeconds).toBeCloseTo(result.timing.totalDurationMs / 1000, 3);
    expect(durationSeconds).toBeGreaterThan(300); // turns + policy gaps
    expect(durationSeconds).toBeLessThan(300 + 30); // inside tolerance

    // Manifest: every turn timed, contiguous.
    expect(result.timing.entries.length).toBe(22);
    for (let i = 0; i < result.timing.entries.length - 1; i += 1) {
      const entry = result.timing.entries[i];
      const next = result.timing.entries[i + 1];
      if (entry === undefined || next === undefined) continue;
      expect(next.startMs).toBe(entry.endMs + entry.gapAfterMs);
    }

    // QA: honest status with the documented fixture findings.
    expect(['passed', 'passed-with-issues']).toContain(result.qa.status);
    expect(result.qa.issues.some((issue) => issue.code === 'alternation-run-long')).toBe(true);

    // Artifact: contract-valid sidecar with full provenance.
    expect(GeneratedArtifactSchema.safeParse(result.artifact).success).toBe(true);
    expect(result.artifact.kind).toBe('audio-overview');
    expect(result.artifact.media.sha256).toBe(sha(result.wav));
    expect(result.artifact.media.audio).toEqual({
      codec: 'pcm_s16le',
      channels: 1,
      sampleRateHz: 44100,
    });
    expect(result.artifact.generator.seed).toBe(FIXED_SEED);
    expect(result.artifact.generator.reproducible).toBe(true);
    const stages = result.artifact.providers.map((p) => p.stage);
    expect(stages).toEqual(['script', 'speech', 'composition', 'evaluation']);
    const speech = result.artifact.providers.find((p) => p.stage === 'speech');
    expect(speech?.provider).toBe('deterministic-offline-tts');
    expect(speech?.costUsd).toBe(0); // honest zero-cost offline path

    // Turns: every plan turn carries realized text (contract shape).
    expect(result.turns.every((turn) => (turn.text ?? '').length > 0)).toBe(true);
  }, 60000);
});

describe('committed benchmark parity (regeneration is byte-identical)', () => {
  test('short benchmark sidecars and media hash match the committed artifacts', async () => {
    const result = await compileAudioOverview({
      plan: buildShortBenchmarkPlan(),
      graph: CANONICAL_GRAPH,
      sources: CANONICAL_SOURCE,
      options: { seed: FIXED_SEED, now: FIXED_NOW, mastering: 'pure-ts' },
    });
    const dir = 'artifacts/audio/benchmark-deep-dive-42s';
    const committedArtifact = readFileSync(`${dir}/artifact.json`, 'utf8');
    const committedManifest = readFileSync(`${dir}/timing-manifest.json`, 'utf8');
    const committedQa = readFileSync(`${dir}/qa-report.json`, 'utf8');
    const committedWav = new Uint8Array(readFileSync(`${dir}/overview.wav`));

    expect(`${stableStringify(result.artifact)}\n`).toBe(committedArtifact);
    expect(`${stableStringify(result.timing)}\n`).toBe(committedManifest);
    expect(`${stableStringify(result.qa)}\n`).toBe(committedQa);
    expect(sha(result.wav)).toBe(sha(committedWav));
  });

  test('canonical sidecar fingerprints match the committed fingerprints', async () => {
    const result = await compileAudioOverview({
      plan: CANONICAL_PLAN,
      graph: CANONICAL_GRAPH,
      sources: CANONICAL_SOURCE,
      options: { seed: FIXED_SEED, now: FIXED_NOW, mastering: 'pure-ts' },
    });
    const committed = JSON.parse(
      readFileSync('artifacts/audio/canonical-deep-dive-5min/artifact.json', 'utf8'),
    ) as { media: { sha256: string } };
    expect(result.artifact.media.sha256).toBe(committed.media.sha256);
  }, 60000);
});

describe('ffmpeg mastering path (auto backend; skipped when absent)', () => {
  test('canonical plan masters through ffmpeg with optional MP3', async () => {
    if (!ffmpegAvailable()) {
      return;
    }
    const result = await compileAudioOverview({
      plan: buildShortBenchmarkPlan(),
      graph: CANONICAL_GRAPH,
      sources: CANONICAL_SOURCE,
      options: { seed: FIXED_SEED, now: FIXED_NOW, mastering: 'ffmpeg', mp3: true },
    });
    expect(result.master.backend).toBe('ffmpeg');
    const decoded = decodeWav(result.wav);
    expect(decoded.samples.length / decoded.sampleRate).toBeGreaterThan(42);
    expect(result.mp3).toBeDefined();
    expect((result.mp3?.byteLength ?? 0)).toBeGreaterThan(1000);
    const composition = result.artifact.providers.find((p) => p.stage === 'composition');
    expect(composition?.provider).toBe('ffmpeg');
    // QA loudness metric reads the final (ffmpeg-mastered) bytes.
    expect(result.qa.issues.some((issue) => issue.code === 'loudness-off-target')).toBe(false);
  });
});
