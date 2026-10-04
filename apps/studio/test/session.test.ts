/**
 * WebFlix-Lab Operator Studio (WFLX-UI2) — Interactive Audio session routes,
 * router-level against the REAL machinery (one ephemeral studio instance,
 * one real deep-dive compile, real InteractiveAudioSession.intervene() runs).
 *
 * Asserts the §7 session behavior guarantees END-TO-END through the HTTP
 * surface (docs/handoff/tl2-overview-studio-handoff.md §7 — BINDING):
 *
 *   1. payload reuse      — every original turn's WAV bytes are byte-identical
 *                           in the session master (locality rows, all green);
 *   2. turn order         — the session sequence is the baseline sequence with
 *                           the response turns inserted ONLY at the boundary;
 *   3. translation-only   — post-boundary startMs shift == the inserted
 *                           response total EXACTLY (and pre-boundary shift 0);
 *   4. C-5 locality       — per-turn byte-identity proof rows, machinery verdict;
 *   5. same-machinery     — the response compiles through the same audio
 *                           pipeline (provider + intervention plan id shape).
 *
 * Plus determinism (double-intervene -> identical session-master sha256, new
 * artifact id), the session-master WAV endpoint (own artifact id, never the
 * baseline's), fork history via GET /api/session/:id, and the typed error
 * surface (unknown-overview / unknown-session / invalid-boundary /
 * empty-listener-text / invalid-body).
 *
 * Evidence class: REPRODUCED (lab implementation; AGENTS.md).
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { bootStudio, type BootedStudio } from './helpers';
import type {
  ApiErrorBody,
  OverviewResponse,
  SessionEstablishResponse,
  SessionInterveneResponse,
  SessionStateResponse,
} from '../api/types';

const CANONICAL_SOURCE_ID = 'source-messy-note-redacted';
const QUESTION_OSS =
  'Can you say more about the open-source media projects and local model runtimes?';
const BOUNDARY = 5; // the EXP-L-03 session-01 canonical boundary

const sha256Hex = (bytes: Uint8Array): string =>
  createHash('sha256').update(bytes).digest('hex');

function postJson(
  studio: BootedStudio,
  path: string,
  body: unknown,
): Promise<Response> {
  return fetch(`${studio.baseUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

async function intervene(
  studio: BootedStudio,
  sessionId: string,
  afterTurnIndex: number,
  listenerText: string,
): Promise<SessionInterveneResponse> {
  const response = await postJson(studio, `/api/session/${sessionId}/intervene`, {
    afterTurnIndex,
    listenerText,
  });
  expect(response.status).toBe(200);
  return (await response.json()) as SessionInterveneResponse;
}

describe('Interactive Audio session routes (WFLX-UI2)', () => {
  let studio: BootedStudio;
  let overview: OverviewResponse;
  let established: SessionEstablishResponse;

  beforeAll(async () => {
    studio = bootStudio();
    const compile = await postJson(studio, '/api/overview', {
      sourceId: CANONICAL_SOURCE_ID,
    });
    expect(compile.status).toBe(200);
    overview = (await compile.json()) as OverviewResponse;
    const establish = await postJson(studio, '/api/session', {
      overviewId: overview.artifactId,
    });
    expect(establish.status).toBe(200);
    established = (await establish.json()) as SessionEstablishResponse;
  }, 30000);

  afterAll(async () => {
    await studio.stop();
  });

  test('establish returns the typed shape with ONLY interior boundaries', () => {
    expect(established.sessionId).toMatch(/^ix-session-\d+$/);
    expect(established.overviewId).toBe(overview.artifactId);
    expect(established.turnCount).toBe(overview.plan.turnCount);
    expect(established.turnCount).toBeGreaterThanOrEqual(BOUNDARY + 2);
    // §Semantics: interior boundaries only — 0..turnCount-2, never the last turn.
    const expected: number[] = [];
    for (let index = 0; index <= established.turnCount - 2; index += 1) {
      expected.push(index);
    }
    expect(established.validBoundaries).toEqual(expected);
    expect(established.validBoundaries).not.toContain(established.turnCount - 1);
    // The honest labels ride the response verbatim (work-order binding).
    expect(established.semantics).toBe(
      'each question re-forks the session from the baseline (lab semantics)',
    );
    expect(established.listenerInputMode).toBe(
      'typed listener question — voice capture UNRESOLVED (text stand-in)',
    );
    expect(established.persistenceNote).toContain('in-memory');
    expect(established.evidenceClass).toBe('REPRODUCED');
    expect(established.joins).toBe(1);
  });

  test('re-joining the same baseline is idempotent (joins increment, same session)', async () => {
    const rejoin = await postJson(studio, '/api/session', {
      overviewId: overview.artifactId,
    });
    expect(rejoin.status).toBe(200);
    const body = (await rejoin.json()) as SessionEstablishResponse;
    expect(body.sessionId).toBe(established.sessionId);
    expect(body.joins).toBe(2);
  });

  test('GET /api/session/:id returns baseline id, joins, and the (empty) history', async () => {
    const response = await fetch(`${studio.baseUrl}/api/session/${established.sessionId}`);
    expect(response.status).toBe(200);
    const state = (await response.json()) as SessionStateResponse;
    expect(state.sessionId).toBe(established.sessionId);
    expect(state.overviewId).toBe(overview.artifactId);
    expect(state.joins).toBe(2);
    expect(state.turnCount).toBe(established.turnCount);
    expect(state.validBoundaries).toEqual(established.validBoundaries);
    expect(state.interventions).toEqual([]);
    expect(state.semantics).toBe(established.semantics);
  });

  test(
    'intervene over the canonical path asserts the §7 guarantees END-TO-END',
    async () => {
      const record = await intervene(studio, established.sessionId, BOUNDARY, QUESTION_OSS);

      // --- request echo + honest labels ---
      expect(record.afterTurnIndex).toBe(BOUNDARY);
      expect(record.listenerText).toBe(QUESTION_OSS);
      expect(record.listenerInputMode).toBe(
        'typed listener question — voice capture UNRESOLVED (text stand-in)',
      );
      expect(record.semantics).toBe(
        'each question re-forks the session from the baseline (lab semantics)',
      );
      expect(record.evidenceClass).toBe('REPRODUCED');

      // --- the response block: ack + grounded answer, inserted at the boundary ---
      expect(record.insertedTurnIds).toEqual(['ix-turn-ack', 'ix-turn-response']);
      const timeline = record.timeline;
      expect(timeline.length).toBe(established.turnCount + 2);
      // Contiguous session indexes 0..n-1.
      timeline.forEach((row, index) => expect(row.sessionIndex).toBe(index));
      // §7.2 turn order: inserted turns appear ONLY at boundary+1..boundary+2.
      const insertedRows = timeline.filter((row) => row.inserted);
      expect(insertedRows.map((row) => row.sessionIndex)).toEqual([
        BOUNDARY + 1,
        BOUNDARY + 2,
      ]);
      for (const row of insertedRows) {
        expect(row.baselineIndex).toBeNull();
        expect(row.wordCount).toBeGreaterThan(0);
        expect(row.text.length).toBeGreaterThan(0);
        expect(row.durationMs).toBeGreaterThan(0);
      }
      // Original rows keep the baseline sequence and indexes (order preserved).
      const originalRows = timeline.filter((row) => !row.inserted);
      expect(originalRows.length).toBe(established.turnCount);
      originalRows.forEach((row, index) => expect(row.baselineIndex).toBe(index));
      const baselineTurnIds = overview.transcript.map((row) => row.turnId);
      expect(originalRows.map((row) => row.turnId)).toEqual(baselineTurnIds);
      expect(record.locality.originalOrderPreserved).toBe(true);

      // --- §7.1 + §7.4 locality: per-original-turn byte identity, all green ---
      const rows = record.locality.rows;
      expect(rows.length).toBe(established.turnCount);
      expect(record.locality.byteIdentityAllGreen).toBe(true);
      for (const row of rows) {
        expect(row.wavSha256Equal).toBe(true);
        expect(row.actualSecondsEqual).toBe(true);
        expect(row.gapAfterMsEqual).toBe(true);
        expect(row.sessionStartMs).toBe(row.baselineStartMs + row.startMsDelta);
      }

      // --- §7.3 translation-only shift: 0 pre-boundary, inserted total after ---
      for (const row of rows) {
        if (row.baselineIndex <= BOUNDARY) {
          expect(row.postBoundary).toBe(false);
          expect(row.startMsDelta).toBe(0);
        } else {
          expect(row.postBoundary).toBe(true);
          expect(row.startMsDelta).toBe(record.locality.postBoundaryShiftMs);
        }
      }
      // The invariant, recomputed independently from the serialized timeline:
      // inserted turns + their gaps == the machinery's post-boundary shift.
      expect(record.locality.insertedTotalMs).toBe(record.locality.postBoundaryShiftMs);
      expect(record.locality.shiftEqualsInsertedTotal).toBe(true);
      expect(record.locality.passed).toBe(true);
      // And at the manifest level: session total == baseline total + shift.
      expect(record.sessionMaster.totalDurationMs).toBe(
        record.sessionMaster.baselineTotalDurationMs + record.locality.postBoundaryShiftMs,
      );

      // --- grounding (F1): source-grounded, content-matched retrieval ---
      expect(record.grounding.passed).toBe(true);
      expect(record.grounding.w1Valid).toBe(true);
      expect(record.grounding.w2IssueCount).toBe(0);
      expect(record.grounding.claimsResolve).toBe(true);
      expect(record.grounding.responseTurnId).toBe('ix-turn-response');
      expect(record.grounding.matchedByContent).toBe(true);
      // Deterministic retrieval over the frozen graph + fixture (REPRODUCED).
      expect(record.grounding.retrievedClaimIds).toEqual(['claim-b13', 'claim-b14']);
      for (const claim of record.grounding.claims) {
        expect(claim.statement.length).toBeGreaterThan(0);
      }

      // --- §7.5 same machinery: response compiled through the standard pipeline ---
      expect(record.response.provider).toBe('deterministic-offline-tts');
      expect(record.response.planId).toMatch(/^plan-interactive-response-[0-9a-f]{10}$/);
      expect(record.response.turnCount).toBe(2);
      expect(record.response.realizedTexts.length).toBe(2);
      expect(record.provenance.sameMachineryNote).toContain('same machinery');
      expect(record.provenance.seed).toBe('wflx-studio-audio-seed');
      expect(record.provenance.mastering).toBe('pure-ts');

      // --- masters: session artifact id is its OWN (never the baseline's) ---
      expect(record.sessionMaster.artifactId).not.toBe(overview.artifactId);
      expect(record.sessionMaster.audioUrl).toBe(
        `/audio/${record.sessionMaster.artifactId}/master.wav`,
      );
      expect(record.baselineMaster.artifactId).toBe(overview.artifactId);
    },
    30000,
  );

  test(
    'the session master is served under its own artifact id; the baseline master stays untouched',
    async () => {
      const record = await intervene(studio, established.sessionId, BOUNDARY, QUESTION_OSS);

      const sessionResponse = await fetch(`${studio.baseUrl}${record.sessionMaster.audioUrl}`);
      expect(sessionResponse.status).toBe(200);
      expect(sessionResponse.headers.get('content-type')).toBe('audio/wav');
      expect(sessionResponse.headers.get('accept-ranges')).toBe('bytes');
      const sessionBytes = new Uint8Array(await sessionResponse.arrayBuffer());
      expect(sessionBytes.byteLength).toBe(record.sessionMaster.sizeBytes);
      expect(sha256Hex(sessionBytes)).toBe(record.sessionMaster.sha256);
      expect(new TextDecoder().decode(sessionBytes.slice(0, 4))).toBe('RIFF');
      expect(new TextDecoder().decode(sessionBytes.slice(8, 12))).toBe('WAVE');

      // Range requests work for session masters too (the audio-element contract).
      const rangeResponse = await fetch(`${studio.baseUrl}${record.sessionMaster.audioUrl}`, {
        headers: { range: 'bytes=100-199' },
      });
      expect(rangeResponse.status).toBe(206);
      expect(rangeResponse.headers.get('content-length')).toBe('100');

      // The baseline master still serves its ORIGINAL bytes (never overwritten).
      const baselineResponse = await fetch(`${studio.baseUrl}${overview.audioUrl}`);
      expect(baselineResponse.status).toBe(200);
      const baselineBytes = new Uint8Array(await baselineResponse.arrayBuffer());
      expect(sha256Hex(baselineBytes)).toBe(overview.artifact.media.sha256);
    },
    30000,
  );

  test(
    'determinism: double-intervene produces an identical session-master sha256 (fork semantics)',
    async () => {
      const first = await intervene(studio, established.sessionId, BOUNDARY, QUESTION_OSS);
      const second = await intervene(studio, established.sessionId, BOUNDARY, QUESTION_OSS);
      // Each fork registers its OWN artifact id...
      expect(second.sessionMaster.artifactId).not.toBe(first.sessionMaster.artifactId);
      // ...but the compiled session master is byte-identical (same baseline,
      // seed, now, intervention -> same audio; the id is sidecar-only).
      expect(second.sessionMaster.sha256).toBe(first.sessionMaster.sha256);
      // Served bytes agree too (not just the reported digest).
      const a = new Uint8Array(
        await (await fetch(`${studio.baseUrl}${first.sessionMaster.audioUrl}`)).arrayBuffer(),
      );
      const b = new Uint8Array(
        await (await fetch(`${studio.baseUrl}${second.sessionMaster.audioUrl}`)).arrayBuffer(),
      );
      expect(sha256Hex(a)).toBe(sha256Hex(b));
      // Both are forks of the SAME baseline with identical shift invariants.
      expect(second.locality.postBoundaryShiftMs).toBe(first.locality.postBoundaryShiftMs);
      expect(second.locality.passed).toBe(true);
    },
    30000,
  );

  test('GET /api/session/:id lists the fork history (multiple interventions)', async () => {
    const response = await fetch(`${studio.baseUrl}/api/session/${established.sessionId}`);
    expect(response.status).toBe(200);
    const state = (await response.json()) as SessionStateResponse;
    // canonical + master-endpoint + determinism x2 = 4 interventions so far.
    expect(state.interventions.length).toBeGreaterThanOrEqual(4);
    for (const summary of state.interventions) {
      expect(summary.afterTurnIndex).toBe(BOUNDARY);
      expect(summary.listenerText).toBe(QUESTION_OSS);
      expect(summary.insertedTurnIds).toEqual(['ix-turn-ack', 'ix-turn-response']);
      expect(summary.sessionArtifactId).toMatch(/^artifact-ix-session-\d+-fork-\d+$/);
      expect(summary.sessionMasterSha256).toMatch(/^[0-9a-f]{64}$/);
      expect(summary.groundingPassed).toBe(true);
      expect(summary.localityPassed).toBe(true);
      expect(summary.originalOrderPreserved).toBe(true);
    }
    // Fork sequence numbers are 1-based and dense.
    const seqs = state.interventions.map((summary) => summary.interventionSeq);
    expect(seqs).toEqual(seqs.map((_, index) => index + 1));
  });

  test(
    'WFLX-UI3 provenance completeness fills: sourceIds, response QA, response provider',
    async () => {
      const record = await intervene(studio, established.sessionId, BOUNDARY, QUESTION_OSS);

      // GeneratedArtifact.sourceIds convention (audit fill): the session
      // lineage's source ids equal the compiled baseline's sidecar sources.
      expect(record.provenance.sourceIds).toEqual(overview.artifact.sourceIds);

      // The response segment's QA summary rides the session artifact sidecar
      // (status + issue count; honest reporting, never hidden).
      expect(['passed', 'passed-with-issues', 'failed', 'not-evaluated']).toContain(
        record.provenance.responseQa.status,
      );
      expect(record.provenance.responseQa.issueCount).toBeGreaterThanOrEqual(0);

      // Handoff §4 law: the provider is never hidden — the response speech
      // provider is the honest offline speech-stage id.
      expect(record.response.provider).toBe('deterministic-offline-tts');

      // The serialized session artifact id IS the served master's id.
      expect(record.provenance.sessionArtifactId).toBe(record.sessionMaster.artifactId);

      // The session artifact's generator reproducible flag (offline path).
      expect(record.provenance.reproducible).toBe(true);
    },
    30000,
  );

  test('typed error paths (4xx bodies, never a 501 stub)', async () => {
    // Unknown baseline overview.
    const unknownOverview = await postJson(studio, '/api/session', {
      overviewId: 'audio-overview-does-not-exist',
    });
    expect(unknownOverview.status).toBe(404);
    expect(((await unknownOverview.json()) as ApiErrorBody).error).toBe('unknown-overview');

    // Missing / malformed body.
    const noBody = await postJson(studio, '/api/session', {});
    expect(noBody.status).toBe(400);
    expect(((await noBody.json()) as ApiErrorBody).error).toBe('invalid-body');
    const malformed = await postJson(studio, '/api/session', 'not-json');
    expect(malformed.status).toBe(400);
    expect(((await malformed.json()) as ApiErrorBody).error).toBe('invalid-body');

    // Unknown session (intervene + state).
    const unknownSession = await postJson(studio, '/api/session/ix-session-999/intervene', {
      afterTurnIndex: 0,
      listenerText: 'hello there',
    });
    expect(unknownSession.status).toBe(404);
    expect(((await unknownSession.json()) as ApiErrorBody).error).toBe('unknown-session');
    const unknownState = await fetch(`${studio.baseUrl}/api/session/ix-session-999`);
    expect(unknownState.status).toBe(404);
    expect(((await unknownState.json()) as ApiErrorBody).error).toBe('unknown-session');

    // Out-of-range / non-integer boundaries (the last turn is NOT a boundary).
    for (const afterTurnIndex of [
      established.turnCount - 1,
      established.turnCount,
      -1,
      999,
      1.5,
      '5',
    ]) {
      const response = await postJson(studio, `/api/session/${established.sessionId}/intervene`, {
        afterTurnIndex,
        listenerText: 'a reasonable question',
      });
      expect(response.status).toBe(400);
      const body = (await response.json()) as ApiErrorBody;
      expect(body.error).toBe('invalid-boundary');
      expect(body.message).toContain('interior turn boundary');
    }

    // Empty / whitespace / non-string listener text.
    for (const listenerText of ['', '   ', 42]) {
      const response = await postJson(studio, `/api/session/${established.sessionId}/intervene`, {
        afterTurnIndex: 0,
        listenerText,
      });
      expect(response.status).toBe(400);
      const body = (await response.json()) as ApiErrorBody;
      expect(body.error).toBe('empty-listener-text');
      expect(body.message).toContain('voice capture UNRESOLVED');
    }
  });
});
