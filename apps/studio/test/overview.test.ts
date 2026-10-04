/**
 * WebFlix-Lab Operator Studio (WFLX-UI1) — POST /api/overview integration
 * against the REAL pipeline.
 *
 * The compile route must run the real chain (MarkdownNoteAdapter ->
 * DeterministicExtractor -> compileOverviewPlan -> compileAudioOverview) on
 * the selected fixture — no tests-fixture shortcut, no pre-baked plan JSON.
 * The proof: the returned plan id carries the DIRECTOR's derived id format
 * (`plan-<sourceId>-<mode>-<duration>s` with the STUDIO seed), which differs
 * from every checked-in fixture plan id (e.g. `plan-messy-note-audio-deep-dive-5min`).
 *
 * Also covers the manifest/URL contracts and the typed 4xx error surface.
 */

import { describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { bootStudio } from './helpers';
import type { ApiErrorBody, OverviewResponse } from '../api/types';

const CANONICAL_SOURCE_ID = 'source-messy-note-redacted';

async function compileDefault(studio: ReturnType<typeof bootStudio>): Promise<OverviewResponse> {
  const response = await fetch(`${studio.baseUrl}/api/overview`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sourceId: CANONICAL_SOURCE_ID }),
  });
  expect(response.status).toBe(200);
  return (await response.json()) as OverviewResponse;
}

describe('POST /api/overview — real pipeline integration', () => {
  test(
    'compiles the canonical deep-dive through the Director (not a fixture shortcut)',
    async () => {
    const studio = bootStudio();
    try {
      const overview = await compileDefault(studio);

      // Director-derived plan id (studio seed/now), NOT any checked-in fixture id.
      expect(overview.plan.planId).toBe('plan-source-messy-note-redacted-deep-dive-300s');
      expect(overview.plan.mode).toBe('deep-dive');
      expect(overview.plan.targetDurationSeconds).toBe(300);
      expect(overview.plan.language).toBe('en');
      expect(overview.plan.audience).toBe('technical');

      // Honest provider + mastering + evidence class.
      expect(overview.provider).toBe('deterministic-offline-tts');
      expect(overview.providerChoice).toBe('offline');
      expect(overview.mastering).toBe('pure-ts');
      expect(overview.evidenceClass).toBe('REPRODUCED');
      expect(overview.surfaceNote).toContain('not the Gemini Notebook product');

      // Structural metadata: deep-dive = 2 hosts, one turn per manifest entry.
      expect(overview.plan.speakerCount).toBe(2);
      expect(overview.speakers.map((s) => s.name).sort()).toEqual(['Ava', 'Ben']);
      expect(overview.plan.turnCount).toBe(overview.transcript.length);
      expect(overview.plan.turnCount).toBe(overview.timing.entries.length);
      expect(overview.plan.turnCount).toBeGreaterThan(0);

      // planHash: sha256 hex of the canonical plan serialization.
      expect(overview.plan.planHash).toMatch(/^[0-9a-f]{64}$/);
      expect(overview.timing.planHash).toBe(overview.plan.planHash);

      // The repo's artifact.json conventions (GeneratedArtifact sidecar).
      expect(overview.artifact.id).toBe(overview.artifactId);
      expect(overview.artifact.kind).toBe('audio-overview');
      expect(overview.artifact.planId).toBe(overview.plan.planId);
      expect(overview.artifact.generator.name).toBe('AudioOverviewCompiler@0.1.0');
      expect(overview.artifact.generator.reproducible).toBe(true);
      expect(overview.artifact.media.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(overview.artifact.createdAt).toBe('2026-10-04T00:00:00Z'); // fixed now, no wall clock
    } finally {
      await studio.stop();
    }
    },
    30000,
  );

  test(
    'serves the playable master WAV at /audio/:id/master.wav with sidecar-matching bytes',
    async () => {
    const studio = bootStudio();
    try {
      const overview = await compileDefault(studio);
      expect(overview.audioUrl).toBe(`/audio/${overview.artifactId}/master.wav`);

      const audioResponse = await fetch(`${studio.baseUrl}${overview.audioUrl}`);
      expect(audioResponse.status).toBe(200);
      expect(audioResponse.headers.get('content-type')).toBe('audio/wav');
      const bytes = new Uint8Array(await audioResponse.arrayBuffer());

      // WAV contract: RIFF header, byte count, and the sidecar's media sha256.
      expect(bytes.byteLength).toBe(overview.artifact.media.sizeBytes);
      const sha256 = createHash('sha256').update(bytes).digest('hex');
      expect(sha256).toBe(overview.artifact.media.sha256);
      expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe('RIFF');
      expect(new TextDecoder().decode(bytes.slice(8, 12))).toBe('WAVE');
    } finally {
      await studio.stop();
    }
    },
    30000,
  );

  test(
    'timing manifest entries are ordered, monotonic, and drive the transcript',
    async () => {
    const studio = bootStudio();
    try {
      const overview = await compileDefault(studio);
      const entries = overview.timing.entries;
      let cursor = 0;
      for (const entry of entries) {
        expect(entry.startMs).toBe(cursor);
        expect(entry.endMs).toBeGreaterThan(entry.startMs);
        cursor = entry.endMs + entry.gapAfterMs;
      }
      expect(overview.timing.totalDurationMs).toBe(cursor);

      // Transcript rows carry the timing (player highlight contract).
      const firstRow = overview.transcript[0];
      expect(firstRow).toBeDefined();
      expect((firstRow as { startMs: number }).startMs).toBe(0);
      for (const row of overview.transcript) {
        expect(row.text.length).toBeGreaterThan(0);
        expect(row.speakerName.length).toBeGreaterThan(0);
      }
    } finally {
      await studio.stop();
    }
    },
    30000,
  );

  test(
    'exposes the brief mode surface (monologic narrator at the canonical 120 s)',
    async () => {
    const studio = bootStudio();
    try {
      const response = await fetch(`${studio.baseUrl}/api/overview`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sourceId: CANONICAL_SOURCE_ID, mode: 'brief' }),
      });
      expect(response.status).toBe(200);
      const overview = (await response.json()) as OverviewResponse;
      expect(overview.plan.mode).toBe('brief');
      expect(overview.plan.targetDurationSeconds).toBe(120);
      expect(overview.plan.speakerCount).toBe(1); // C-10 monologic brief
      expect(overview.plan.planId).toBe('plan-source-messy-note-redacted-brief-120s');
    } finally {
      await studio.stop();
    }
    },
    30000,
  );

  test('typed 4xx error bodies for bad requests', async () => {
    const studio = bootStudio();
    try {
      const cases: { body: string; code: string }[] = [
        { body: JSON.stringify({ sourceId: 'does-not-exist' }), code: 'unknown-source' },
        { body: JSON.stringify({ sourceId: CANONICAL_SOURCE_ID, mode: 'explainer' }), code: 'invalid-mode' },
        {
          body: JSON.stringify({ sourceId: CANONICAL_SOURCE_ID, durationSeconds: 5 }),
          code: 'invalid-duration',
        },
      ];
      for (const testCase of cases) {
        const response = await fetch(`${studio.baseUrl}/api/overview`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: testCase.body,
        });
        expect(response.status).toBe(400);
        const body = (await response.json()) as ApiErrorBody;
        expect(body.error).toBe(testCase.code);
        expect(body.message.length).toBeGreaterThan(0);
      }

      // Non-JSON body.
      const malformed = await fetch(`${studio.baseUrl}/api/overview`, {
        method: 'POST',
        body: 'not-json',
      });
      expect(malformed.status).toBe(400);
      const malformedBody = (await malformed.json()) as ApiErrorBody;
      expect(malformedBody.error).toBe('invalid-body');
    } finally {
      await studio.stop();
    }
  });

  test('unknown artifact audio URLs return a typed 404', async () => {
    const studio = bootStudio();
    try {
      const response = await fetch(`${studio.baseUrl}/audio/audio-overview-does-not-exist/master.wav`);
      expect(response.status).toBe(404);
      const body = (await response.json()) as ApiErrorBody;
      expect(body.error).toBe('unknown-artifact');
    } finally {
      await studio.stop();
    }
  });
});
