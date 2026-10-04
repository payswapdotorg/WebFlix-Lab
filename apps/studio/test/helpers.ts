/**
 * WebFlix-Lab Operator Studio (WFLX-UI1) — test boot helper.
 *
 * Boots ephemeral studio instances (port 0 — the fixed 4313 port law applies
 * to `bun run studio`; tests must not fight over it) with a CLEAN env so
 * provider-state assertions are deterministic. The double-boot determinism
 * proof lives in determinism.test.ts.
 */

import { createStudioServer } from '../server';

export interface BootedStudio {
  readonly server: Bun.Server<undefined>;
  readonly baseUrl: string;
  readonly port: number;
  stop(): Promise<void>;
}

export function bootStudio(): BootedStudio {
  const server = createStudioServer({ port: 0, env: {} });
  return {
    server,
    port: server.port ?? 0,
    baseUrl: `http://localhost:${server.port ?? 0}`,
    async stop(): Promise<void> {
      await server.stop(true);
    },
  };
}
