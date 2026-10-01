/**
 * ZAI live generative provider tests (WFLX-P2, EV-022): pure helpers, env
 * factory gating, and the transport paths against INJECTED fake clients (no
 * network in tests — the LIVE service paths are exercised for real by
 * experiments/run-exp-v-cin-live-01.ts, whose artifacts carry the real-run
 * evidence). Mirrors the P1 zai-live-tts test discipline.
 */

import { describe, expect, test } from 'bun:test';
import {
  ZaiLiveVisualGenerative,
  detectRasterFormat,
  nearestSdkSize,
  rasterDimensions,
} from '../../src/providers/visual/zai-live';
import { selectVisualGenerativeProvider } from '../../src/providers/visual/generative-factory';
import {
  ZaiLiveVideoGenerative,
  isMp4,
} from '../../src/providers/video/zai-live';
import { selectVideoGenerativeProvider } from '../../src/providers/video/generative-factory';

/** Minimal 1x1 PNG (IHDR width=1, height=1). */
function tinyPng(): Uint8Array {
  const header = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
    0x00, 0x00, 0x00, 0x01, // width = 1
    0x00, 0x00, 0x00, 0x01, // height = 1
    0x08, 0x06, 0x00, 0x00, 0x00, // bit depth 8, color type 6
  ]);
  return new Uint8Array(header);
}

/** Minimal JPEG with SOF0 2x3. */
function tinyJpeg(): Uint8Array {
  const bytes = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x41, 0x42, // SOI + APP0
    0xff, 0xc0, 0x00, 0x0b, 0x08, // SOF0 marker, length, precision
    0x00, 0x03, // height = 3
    0x00, 0x02, // width = 2
    0x01, // components
    0xff, 0xd9, // EOI
  ]);
  return new Uint8Array(bytes);
}

function fakeMp4(): Uint8Array {
  const bytes = new Uint8Array(64);
  const prefix = Buffer.from([0x00, 0x00, 0x00, 0x20]);
  bytes.set(prefix, 0);
  const ftyp = Buffer.from('ftypisom');
  bytes.set(ftyp, 4);
  return bytes;
}

describe('zai-live visual: pure helpers', () => {
  test('nearestSdkSize maps canvas ratios onto SDK sizes', () => {
    expect(nearestSdkSize(1280, 720)).toBe('1344x768');
    expect(nearestSdkSize(1024, 1024)).toBe('1024x1024');
    expect(nearestSdkSize(768, 1344)).toBe('768x1344');
  });

  test('raster format + dimension parsing is exact for PNG and JPEG magic bytes', () => {
    expect(detectRasterFormat(tinyPng())).toBe('png');
    expect(detectRasterFormat(tinyJpeg())).toBe('jpeg');
    expect(detectRasterFormat(fakeMp4())).toBeNull();
    expect(rasterDimensions(tinyPng())).toEqual({ widthPx: 1, heightPx: 1 });
    expect(rasterDimensions(tinyJpeg())).toEqual({ widthPx: 2, heightPx: 3 });
  });
});

describe('zai-live visual: transport against an injected fake client', () => {
  const request = {
    jobId: 'job-test-ill',
    sceneId: 'scene-2',
    assetClass: 'illustration' as const,
    brief: 'an ink-style network diagram',
    palette: { background: '#3e4346', ink: '#f2f4f5', emphasis: '#53dfcd', warning: '#9f3b61' },
    widthPx: 1280,
    heightPx: 720,
    seed: 'seed-x',
  };

  test('returns the real payload bytes with honest stochastic provenance', async () => {
    const provider = new ZaiLiveVisualGenerative({
      clientFactory: async () => ({
        images: {
          generations: {
            create: async () => ({
              data: [{ base64: Buffer.from(tinyPng()).toString('base64') }],
            }),
          },
        },
      }),
    });
    const result = await provider.generateAsset(request);
    expect(result.format).toBe('png');
    expect(result.bytes.byteLength).toBe(tinyPng().byteLength);
    expect(result.deterministic).toBe(false); // honest: live output is stochastic
    expect(result.providerId).toBe('zai-live-generative');
    expect(result.modelId).toBeTruthy();
  });

  test('typed failures: empty payload, non-raster payload, transport errors after retries', async () => {
    let mode = 'empty';
    const provider = new ZaiLiveVisualGenerative({
      clientFactory: async () => ({
        images: {
          generations: {
            create: async () => {
              if (mode === 'empty') return { data: [] };
              if (mode === 'garbage') return { data: [{ base64: Buffer.from('not an image').toString('base64') }] };
              throw new Error('network down');
            },
          },
        },
      }),
      maxRetries: 1,
      timeoutMs: 1000,
    });
    await expect(provider.generateAsset(request)).rejects.toThrow(/no image payload/);
    mode = 'garbage';
    await expect(provider.generateAsset(request)).rejects.toThrow(/neither PNG nor JPEG/);
    mode = 'transport';
    await expect(provider.generateAsset(request)).rejects.toThrow(/network down/);
  });

  test('empty briefs are rejected before any transport', async () => {
    const provider = new ZaiLiveVisualGenerative({
      clientFactory: async () => {
        throw new Error('must not be called');
      },
    });
    await expect(
      provider.generateAsset({ ...request, brief: '   ' }),
    ).rejects.toThrow(/empty-brief/);
  });
});

describe('zai-live video: transport against an injected fake client', () => {
  const request = {
    jobId: 'job-test-vid',
    sceneId: 'scene-4',
    brief: 'slow cinematic pan across a schematic',
    widthPx: 1280,
    heightPx: 720,
    durationSeconds: 5,
    seed: 'seed-y',
  };

  test('full task lifecycle: create -> poll -> download real bytes', async () => {
    const states = ['PROCESSING', 'PROCESSING', 'SUCCESS'];
    let poll = 0;
    const provider = new ZaiLiveVideoGenerative({
      clientFactory: async () => ({
        video: {
          generations: {
            create: async () => ({ id: 'task-123', task_status: 'PROCESSING' }),
          },
        },
        async: {
          result: {
            query: async () => {
              const status = states[Math.min(poll, states.length - 1)] ?? 'SUCCESS';
              poll += 1;
              if (status === 'SUCCESS') return { task_status: 'SUCCESS', video_result: [{ url: 'https://example.test/clip.mp4' }] };
              return { task_status: 'PROCESSING' };
            },
          },
        },
      }),
      pollBudgetMs: 60_000,
      pollIntervalMs: 5,
    });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response(fakeMp4(), { status: 200 })) as unknown as typeof fetch;
    try {
      const result = await provider.generateClip(request);
      expect(result.format).toBe('mp4');
      expect(isMp4(result.bytes)).toBe(true);
      expect(result.deterministic).toBe(false);
      expect(result.providerId).toBe('zai-live-video');
    } finally {
      globalThis.fetch = originalFetch;
    }
  }, 30_000);

  test('typed failures: no task id, task FAIL, timeout, non-mp4 download', async () => {
    let mode = 'no-id';
    const provider = new ZaiLiveVideoGenerative({
      clientFactory: async () => ({
        video: {
          generations: {
            create: async () => (mode === 'no-id' ? {} : { id: 'task-1', task_status: 'PROCESSING' }),
          },
        },
        async: {
          result: {
            query: async () => {
              if (mode === 'fail') return { task_status: 'FAIL' };
              if (mode === 'timeout') return { task_status: 'PROCESSING' };
              return { task_status: 'SUCCESS', video_result: [{ url: 'https://example.test/clip' }] };
            },
          },
        },
      }),
      pollBudgetMs: 10,
      pollIntervalMs: 2,
      timeoutMs: 500,
    });
    await expect(provider.generateClip(request)).rejects.toThrow(/no task id/);
    mode = 'fail';
    await expect(provider.generateClip(request)).rejects.toThrow(/FAILED/);
    mode = 'timeout';
    await expect(provider.generateClip(request)).rejects.toThrow(/task-timeout|task-failed/);
    mode = 'bad-download';
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response(new Uint8Array([1, 2, 3]), { status: 200 })) as unknown as typeof fetch;
    try {
      await expect(provider.generateClip(request)).rejects.toThrow(/not an MP4/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  }, 30_000);
});

describe('env gating (defaults stay offline)', () => {
  test('WFLX_VISUAL_PROVIDER / WFLX_VIDEO_PROVIDER select live-zai only when set', () => {
    const clean = {} as NodeJS.ProcessEnv;
    expect(selectVisualGenerativeProvider({ env: clean }).provider.id).toBe(
      'offline-generative-standin',
    );
    expect(selectVideoGenerativeProvider({ env: clean }).provider.id).toBe(
      'offline-video-standin',
    );
    const live = { WFLX_VISUAL_PROVIDER: 'live-zai', WFLX_VIDEO_PROVIDER: 'live-zai' } as NodeJS.ProcessEnv;
    expect(selectVisualGenerativeProvider({ env: live }).provider.id).toBe('zai-live-generative');
    expect(selectVideoGenerativeProvider({ env: live }).provider.id).toBe('zai-live-video');
  });
});
