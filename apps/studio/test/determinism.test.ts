/**
 * WebFlix-Lab Operator Studio (WFLX-UI1) — the cross-boot byte-identity
 * proof (work order §E, determinism spine).
 *
 * Two SEPARATE server boots (fresh in-memory stores, nothing shared) fed
 * IDENTICAL compile requests must produce byte-identical master WAVs — the
 * studio pins fixed seed/now constants, the offline deterministic speech
 * provider, and the pure-TS mastering backend, so the compile path carries
 * zero per-boot nondeterminism. This is the test-restatement of the work
 * order's "two `bun run apps/studio/server.ts` boots" clause (the test
 * factory boots ephemeral port-0 instances of the SAME server module
 * because the port law fixes 4313 for the dev command).
 */

import { describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { createStudioServer } from '../server';
import type { OverviewResponse } from '../api/types';

const REQUEST_BODY = JSON.stringify({
  sourceId: 'source-messy-note-redacted',
  mode: 'deep-dive',
  durationSeconds: 300,
});

interface BootResult {
  readonly artifactId: string;
  readonly planHash: string;
  readonly wavSha256: string;
  readonly wavBytes: number;
  readonly totalDurationMs: number;
}

async function compileOnFreshBoot(): Promise<BootResult> {
  const server = createStudioServer({ port: 0, env: {} });
  try {
    const response = await fetch(`http://localhost:${server.port}/api/overview`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: REQUEST_BODY,
    });
    expect(response.status).toBe(200);
    const overview = (await response.json()) as OverviewResponse;

    const audioResponse = await fetch(`http://localhost:${server.port}${overview.audioUrl}`);
    expect(audioResponse.status).toBe(200);
    const wav = new Uint8Array(await audioResponse.arrayBuffer());
    return {
      artifactId: overview.artifactId,
      planHash: overview.plan.planHash,
      wavSha256: createHash('sha256').update(wav).digest('hex'),
      wavBytes: wav.byteLength,
      totalDurationMs: overview.timing.totalDurationMs,
    };
  } finally {
    await server.stop(true);
  }
}

describe('cross-boot byte-identity (determinism spine)', () => {
  test(
    'two independent server boots produce byte-identical master WAVs',
    async () => {
      const bootA = await compileOnFreshBoot();
      const bootB = await compileOnFreshBoot();

      // Same deterministic artifact identity (deriveArtifactId convention).
      expect(bootB.artifactId).toBe(bootA.artifactId);
      expect(bootB.planHash).toBe(bootA.planHash);

      // BYTE-IDENTICAL media: same length, same sha256.
      expect(bootB.wavBytes).toBe(bootA.wavBytes);
      expect(bootB.wavSha256).toBe(bootA.wavSha256);
      expect(bootA.wavSha256).toMatch(/^[0-9a-f]{64}$/);

      // The compiled overview is real (not a degenerate empty artifact).
      expect(bootA.wavBytes).toBeGreaterThan(1024 * 1024);
      expect(bootA.totalDurationMs).toBeGreaterThan(250_000);
    },
    60000,
  );
});
