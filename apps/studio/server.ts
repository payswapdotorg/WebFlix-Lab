/**
 * WebFlix-Lab Operator Studio (WFLX-UI1) — the HTTP server.
 *
 * PORT LAW: `bun run apps/studio/server.ts` (alias: `bun run studio`)
 * serves http://localhost:4313 — fixed, no PORT env override. The station
 * gateway only exposes :3000 (the replay console); the TL verifies this UI
 * with agent-browser at :4313 and the operator views it through the replay
 * browser (see apps/studio/README.md).
 *
 * `createStudioServer()` is exported for the test battery: tests boot
 * ephemeral instances on port 0 to prove CROSS-BOOT byte-determinism of the
 * compile path without fighting the fixed port. Each instance owns a fresh
 * in-memory overview store; nothing is ever written to artifacts/.
 */

import { handleStudioRequest } from './api/router';
import { createStudioContext, providerStateFor } from './pipeline';
import { STUDIO_PORT, STUDIO_VERSION } from './api/types';

export interface StudioServerOptions {
  /** Default: 4313 (the port law). Tests may pass 0 for an ephemeral port. */
  readonly port?: number;
  /** Env source for provider-state reporting; default process.env. */
  readonly env?: NodeJS.ProcessEnv;
}

export function createStudioServer(options: StudioServerOptions = {}): Bun.Server<undefined> {
  const ctx = createStudioContext(options.env ?? process.env);
  return Bun.serve({
    port: options.port ?? STUDIO_PORT,
    // 255 s (the Bun max): audio elements stream the multi-MB master WAV
    // progressively and may stall between range reads — the 10 s default
    // idle timeout kills those connections mid-transfer.
    idleTimeout: 255,
    async fetch(req: Request): Promise<Response> {
      return handleStudioRequest(ctx, req);
    },
  });
}

if (import.meta.main) {
  const server = createStudioServer();
  const provider = providerStateFor(process.env);
  console.log(`[wflx-studio] ${STUDIO_VERSION} listening on http://localhost:${server.port}`);
  console.log(
    `[wflx-studio] speech provider: ${provider.active} (offline, pinned); ` +
      `gated live providers: ${provider.gated.map((g) => `${g.id}=${g.state}`).join(', ')}`,
  );
  console.log('[wflx-studio] overview store is in-memory only; artifacts/ is never written.');
}
