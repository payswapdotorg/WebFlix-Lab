/**
 * WebFlix-Lab Operator Studio (WFLX-UI1) — session boundary stubs for W2.
 *
 * `POST /api/session {overviewId}` and `POST /api/session/:id/intervene`
 * are the Interactive Audio session boundary hooks (WFLX-UI2 will replace
 * these handlers with the real InteractiveAudioSession wiring — the routes
 * are registered and contract-ready NOW). W1 deliberately returns 501 with
 * the typed handoff body, and the W1 client renders NOTHING for them: W2
 * owns that UI.
 */

import { jsonResponse } from './errors';
import type { SessionStubBody } from './types';

const STUB_BODY: SessionStubBody = {
  error: 'not-implemented-by-w1',
  handoff: 'wflx-ui2',
};

export function handleSessionCreate(): Response {
  return jsonResponse(501, STUB_BODY);
}

export function handleSessionIntervene(): Response {
  return jsonResponse(501, STUB_BODY);
}
