/**
 * WebFlix-Lab Operator Studio (WFLX-UI1) — GET /audio/:id/master.wav.
 *
 * Serves the compiled master WAV from the per-instance in-memory store.
 * Nothing is ever written to artifacts/ (determinism spine: the studio adds
 * no committed artifacts). Byte-identity across boots is asserted in
 * apps/studio/test/determinism.test.ts.
 */

import type { StudioContext } from '../pipeline';
import { errorResponse } from './errors';

const WAV_ROUTE = /^\/audio\/([A-Za-z0-9_-]+)\/master\.wav$/;

export function audioRouteMatch(pathname: string): string | null {
  const match = WAV_ROUTE.exec(pathname);
  return match === null ? null : match[1] ?? '';
}

export function handleAudio(ctx: StudioContext, artifactId: string): Response {
  const stored = ctx.store.get(artifactId);
  if (stored === undefined) {
    return errorResponse(
      404,
      'unknown-artifact',
      `no compiled overview for artifact id '${artifactId}' on this server instance — compile first via POST /api/overview`,
    );
  }
  const headers: Record<string, string> = {
    'content-type': 'audio/wav',
    'content-length': String(stored.wav.byteLength),
    'cache-control': 'no-store',
  };
  return new Response(stored.wav, { status: 200, headers });
}
