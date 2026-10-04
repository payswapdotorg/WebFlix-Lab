/**
 * WebFlix-Lab Operator Studio (WFLX-UI1) — GET /audio/:id/master.wav.
 *
 * Serves the compiled master WAV from the per-instance in-memory store with
 * proper HTTP Range support (audio elements need `Accept-Ranges: bytes` to
 * seek reliably and to stream progressively instead of re-fetching the whole
 * body). Nothing is ever written to artifacts/ (determinism spine: the
 * studio adds no committed artifacts). Byte-identity across boots is
 * asserted in apps/studio/test/determinism.test.ts.
 */

import type { StudioContext } from '../pipeline';
import { errorResponse } from './errors';

const WAV_ROUTE = /^\/audio\/([A-Za-z0-9_-]+)\/master\.wav$/;

export function audioRouteMatch(pathname: string): string | null {
  const match = WAV_ROUTE.exec(pathname);
  return match === null ? null : match[1] ?? '';
}

function wavHeaders(extra: Record<string, string>): Record<string, string> {
  return {
    'content-type': 'audio/wav',
    'accept-ranges': 'bytes',
    'cache-control': 'no-store',
    ...extra,
  };
}

export function handleAudio(ctx: StudioContext, artifactId: string, req: Request): Response {
  const stored = ctx.store.get(artifactId);
  if (stored === undefined) {
    return errorResponse(
      404,
      'unknown-artifact',
      `no compiled overview for artifact id '${artifactId}' on this server instance — compile first via POST /api/overview`,
    );
  }

  const wav = stored.wav;
  const total = wav.byteLength;

  // Single-range requests only (what audio elements issue).
  const rangeHeader = req.headers.get('range');
  const range = rangeHeader === null ? null : /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
  if (range !== null) {
    const startRaw = range[1] ?? '';
    const endRaw = range[2] ?? '';
    const start = startRaw === '' ? 0 : Number.parseInt(startRaw, 10);
    const end = endRaw === '' ? total - 1 : Math.min(Number.parseInt(endRaw, 10), total - 1);
    if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= total) {
      return new Response(null, {
        status: 416,
        headers: wavHeaders({ 'content-range': `bytes */${total}` }),
      });
    }
    const slice = wav.slice(start, end + 1);
    return new Response(slice, {
      status: 206,
      headers: wavHeaders({
        'content-length': String(slice.byteLength),
        'content-range': `bytes ${start}-${end}/${total}`,
      }),
    });
  }

  return new Response(wav, {
    status: 200,
    headers: wavHeaders({ 'content-length': String(total) }),
  });
}
