/**
 * WebFlix-Lab Operator Studio — the W1 session-boundary stubs are SUPERSEDED
 * (WFLX-UI2 replaced the handlers with the real InteractiveAudioSession
 * wiring, per the handoff contract). These two tests pin the supersession:
 * the routes must answer with the REAL contract (200 establish / typed 4xx),
 * never the W1 501 handoff body.
 */

import { describe, expect, test } from 'bun:test';
import { bootStudio } from './helpers';
import type { ApiErrorBody, SessionEstablishResponse } from '../api/types';

const CANONICAL_SOURCE_ID = 'source-messy-note-redacted';

async function compileDefault(studio: ReturnType<typeof bootStudio>): Promise<SessionEstablishResponse['overviewId']> {
  const response = await fetch(`${studio.baseUrl}/api/overview`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sourceId: CANONICAL_SOURCE_ID }),
  });
  expect(response.status).toBe(200);
  const overview = (await response.json()) as { artifactId: string };
  return overview.artifactId;
}

describe('W2 session routes supersede the W1 stubs', () => {
  test(
    'POST /api/session establishes a REAL session (was the 501 not-implemented-by-w1 stub)',
    async () => {
      const studio = bootStudio();
      try {
        const overviewId = await compileDefault(studio);
        const response = await fetch(`${studio.baseUrl}/api/session`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ overviewId }),
        });
        expect(response.status).toBe(200);
        const body = (await response.json()) as SessionEstablishResponse;
        expect(body.sessionId.length).toBeGreaterThan(0);
        expect(body.overviewId).toBe(overviewId);
      } finally {
        await studio.stop();
      }
    },
    30000,
  );

  test(
    'POST /api/session/:id/intervene answers the real typed contract (never the 501 stub body)',
    async () => {
      const studio = bootStudio();
      try {
        // Unknown session -> the typed 404, not the W1 stub handoff.
        const response = await fetch(`${studio.baseUrl}/api/session/ix-session-404/intervene`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ afterTurnIndex: 0, listenerText: 'hello there' }),
        });
        expect(response.status).toBe(404);
        const body = (await response.json()) as ApiErrorBody;
        expect(body.error).toBe('unknown-session');
        expect(body.error).not.toBe('not-implemented-by-w1');
        expect((body as { handoff?: string }).handoff).toBeUndefined();
      } finally {
        await studio.stop();
      }
    },
    30000,
  );
});
