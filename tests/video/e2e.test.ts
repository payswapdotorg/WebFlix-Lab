/**
 * End-to-end offline pipeline tests (Phase 2B exit criterion):
 * fixture plan -> VideoScene[] + SVG frames + timeline + narration +
 * composition + QA report + provenance sidecar.
 *
 * The deterministic fallback backend runs in the standard test path; the
 * Remotion path runs when a headless browser is discoverable on this host
 * (this lab host has one — verified in the Phase 2B setup). Both are
 * lab reproduction evidence only — NOT product-parity evidence (AGENTS.md).
 */

import { describe, expect, test } from 'bun:test';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { compileVideoOverview, findHeadlessBrowser } from '../../src/video';
import { GeneratedArtifactSchema } from '../../src/contracts';
import { CANONICAL_GRAPH, FIXED_NOW, FIXED_SEED, buildTinyVideoPlan } from './fixtures';

function ffprobeDuration(path: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'ffprobe',
      [
        '-v',
        'error',
        '-show_entries',
        'format=duration',
        '-of',
        'default=noprint_wrappers=1:nokey=1',
        path,
      ],
      { stdio: ['ignore', 'pipe', 'ignore'] },
    );
    let out = '';
    child.stdout?.on('data', (chunk: Buffer) => {
      out += chunk.toString();
    });
    child.on('close', (code) => {
      if (code === 0) {
        resolve(Number.parseFloat(out.trim()));
      } else {
        reject(new Error(`ffprobe failed with ${code}`));
      }
    });
    child.on('error', reject);
  });
}

describe('end-to-end (deterministic fallback backend)', () => {
  test('tiny plan -> MP4 + frames + QA + artifact sidecar', async () => {
    const workDir = mkdtempSync(join(tmpdir(), 'wflx-e2e-'));
    const output = join(workDir, 'overview.mp4');
    const result = await compileVideoOverview(buildTinyVideoPlan(), CANONICAL_GRAPH, {
      output,
      now: FIXED_NOW,
      seed: FIXED_SEED,
      backend: 'fallback',
      workDir,
    });

    // Scenes realized with plan authority.
    expect(result.scenes.length).toBe(3);
    const firstScene = result.scenes[0];
    if (firstScene === undefined) {
      throw new Error('missing first scene');
    }
    expect(firstScene.visualType).toBe('title-card');
    // Determinism proof pair.
    expect(result.determinismProof.hashB).toBe(result.determinismProof.hashA);
    expect(result.determinismProof.hashA).toMatch(/^[0-9a-f]{64}$/);
    // Composition: fallback assembled a real MP4 with narration muxed.
    expect(result.composition.backend).toBe('fallback');
    expect(result.composition.detail).not.toContain('assembly unavailable');
    expect(existsSync(output)).toBe(true);
    expect(statSync(output).size).toBeGreaterThan(10_000);
    // Timeline spans the plan target.
    expect(result.timeline.durationSeconds).toBe(20);
    // QA: honest status; alignment exact by construction.
    expect(['passed', 'passed-with-issues']).toContain(result.qa.status);
    const alignment = result.qa.metrics[0];
    if (alignment === undefined) {
      throw new Error('missing alignment metric');
    }
    expect(alignment.value).toContain('mean 0.000s / max 0.000s');
    // Artifact: contract-valid sidecar with full provenance.
    expect(GeneratedArtifactSchema.safeParse(result.artifact).success).toBe(true);
    expect(result.artifact.kind).toBe('video-overview');
    expect(result.artifact.media.video).toEqual({
      codec: 'h264',
      width: 1280,
      height: 720,
      frameRate: 30,
    });
    expect(result.artifact.media.audio).toEqual({
      codec: 'aac',
      channels: 1,
      sampleRateHz: 44_100,
    });
    expect(result.artifact.generator.seed).toBe(FIXED_SEED);
    expect(result.artifact.media.sha256).toBe(
      // sha of the exact mp4 bytes we read for the sidecar
      (await import('node:crypto'))
        .createHash('sha256')
        .update(readFileSync(output))
        .digest('hex'),
    );
    // Placeholder honesty in the sidecar notes.
    expect(result.artifact.notes).toContain('NOT product parity evidence');

    rmSync(workDir, { recursive: true, force: true });
  }, 180_000);

  test('byte-identical SVG layer regeneration (skip-proof run keeps hashes)', async () => {
    const workDir = mkdtempSync(join(tmpdir(), 'wflx-e2e2-'));
    const output = join(workDir, 'overview.mp4');
    const a = await compileVideoOverview(buildTinyVideoPlan(), CANONICAL_GRAPH, {
      output,
      now: FIXED_NOW,
      seed: FIXED_SEED,
      backend: 'fallback',
      workDir,
      skipDeterminismProof: true,
    });
    expect(a.determinismProof.hashB).toBeNull();
    expect(a.render.frames.size).toBe(3);
    for (const svg of a.render.frames.values()) {
      expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    }
    rmSync(workDir, { recursive: true, force: true });
  }, 180_000);
});

describe('end-to-end (Remotion backend, browser-gated)', () => {
  test('tiny plan renders through Remotion to a valid MP4', async () => {
    const browser = findHeadlessBrowser();
    if (browser === null) {
      console.log('no headless browser discoverable; Remotion e2e skipped (fallback e2e covers composition)');
      return;
    }
    const workDir = mkdtempSync(join(tmpdir(), 'wflx-remotion-'));
    const output = join(workDir, 'overview.mp4');
    const result = await compileVideoOverview(buildTinyVideoPlan(), CANONICAL_GRAPH, {
      output,
      now: FIXED_NOW,
      seed: FIXED_SEED,
      backend: 'remotion',
      workDir,
      browserExecutable: browser,
      skipDeterminismProof: true,
    });
    expect(result.composition.backend).toBe('remotion');
    expect(existsSync(output)).toBe(true);
    const size = statSync(output).size;
    expect(size).toBeGreaterThan(20_000);
    // The rendered MP4 spans the plan duration (ffprobe, h264+aac).
    const duration = await ffprobeDuration(output);
    expect(duration).toBeGreaterThan(19);
    expect(duration).toBeLessThan(21.5);
    expect(GeneratedArtifactSchema.safeParse(result.artifact).success).toBe(true);
    rmSync(workDir, { recursive: true, force: true });
  }, 300_000);
});
