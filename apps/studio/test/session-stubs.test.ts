/**
 * WebFlix-Lab Operator Studio (WFLX-UI1) — W2 session boundary stubs.
 *
 * POST /api/session and POST /api/session/:id/intervene are registered and
 * contract-ready for WFLX-UI2 (Interactive Audio UI). W1 returns the typed
 * 501 handoff body; the W1 client renders NOTHING for these routes.
 */

import { describe, expect, test } from 'bun:test';
import { bootStudio } from './helpers';
import type { SessionStubBody } from '../api/types';

describe('W2 session boundary stubs', () => {
  test('POST /api/session -> 501 with the typed W2 handoff body', async () => {
    const studio = bootStudio();
    try {
      const response = await fetch(`${studio.baseUrl}/api/session`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ overviewId: 'audio-overview-x' }),
      });
      expect(response.status).toBe(501);
      const body = (await response.json()) as SessionStubBody;
      expect(body.error).toBe('not-implemented-by-w1');
      expect(body.handoff).toBe('wflx-ui2');
    } finally {
      await studio.stop();
    }
  });

  test('POST /api/session/:id/intervene -> 501 with the same typed body', async () => {
    const studio = bootStudio();
    try {
      const response = await fetch(`${studio.baseUrl}/api/session/audio-overview-x/intervene`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ listenerText: 'hello' }),
      });
      expect(response.status).toBe(501);
      const body = (await response.json()) as SessionStubBody;
      expect(body.error).toBe('not-implemented-by-w1');
      expect(body.handoff).toBe('wflx-ui2');
    } finally {
      await studio.stop();
    }
  });
});
