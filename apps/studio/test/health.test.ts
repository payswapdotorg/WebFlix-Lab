/**
 * WebFlix-Lab Operator Studio (WFLX-UI1) — GET /api/health contract.
 *
 * {ok, version, provider}: active provider reported honestly (the offline
 * deterministic adapter the studio pins); env-gated live providers report
 * STATE only and are never switchable from the UI.
 */

import { describe, expect, test } from 'bun:test';
import { createStudioServer } from '../server';
import { bootStudio } from './helpers';
import type { HealthResponse } from '../api/types';

describe('GET /api/health', () => {
  test('reports ok, version, and the pinned offline provider', async () => {
    const studio = bootStudio();
    try {
      const response = await fetch(`${studio.baseUrl}/api/health`);
      expect(response.status).toBe(200);
      const body = (await response.json()) as HealthResponse;
      expect(body.ok).toBe(true);
      expect(body.version).toBe('wflx-studio@0.1.0');
      expect(body.provider.active).toBe('deterministic-offline-tts');
      expect(body.provider.choice).toBe('offline');
    } finally {
      await studio.stop();
    }
  });

  test('gated live providers report state only (off with a clean env)', async () => {
    const studio = bootStudio();
    try {
      const response = await fetch(`${studio.baseUrl}/api/health`);
      const body = (await response.json()) as HealthResponse;
      const gated = body.provider.gated;
      expect(gated.length).toBe(2);
      const gemini = gated.find((g) => g.id === 'gemini-multi-speaker-tts');
      const zai = gated.find((g) => g.id === 'zai-live-tts');
      expect(gemini?.state).toBe('off');
      expect(gemini?.activation).toContain('WFLX_AUDIO_SPEECH_PROVIDER=gemini');
      expect(zai?.state).toBe('off');
      expect(zai?.activation).toContain('WFLX_TTS_PROVIDER=live-zai');
    } finally {
      await studio.stop();
    }
  });

  test('env-requested gated state is reported honestly (studio still offline)', async () => {
    // The studio PINS offline; an env flag may only change the REPORTED state,
    // never the active provider (no live-provider activation from the UI).
    const server = createStudioServer({
      port: 0,
      env: { WFLX_AUDIO_SPEECH_PROVIDER: 'gemini', WFLX_TTS_PROVIDER: 'live-zai' },
    });
    try {
      const response = await fetch(`http://localhost:${server.port}/api/health`);
      const body = (await response.json()) as HealthResponse;
      expect(body.provider.active).toBe('deterministic-offline-tts');
      expect(body.provider.gated.map((g) => g.state)).toEqual(['env-requested', 'env-requested']);
    } finally {
      await server.stop(true);
    }
  });
});
