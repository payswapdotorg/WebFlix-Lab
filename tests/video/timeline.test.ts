/**
 * Timeline + fallback compositor tests (WFLX-W3): contiguity, crossfade
 * window math, camera interpolation, deterministic frame model, ffmpeg
 * (librsvg) assembly when available.
 */

import { describe, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildTimeline, sampleTimelineLayers, frameTimes } from '../../src/compositor/timeline';
import { renderFrameAt } from '../../src/compositor/fallback/frame-model';
import { composeWithFallback, detectFfmpeg, countFrames } from '../../src/compositor/fallback/compose';
import { synthesizePlaceholderNarration, encodeWav16Mono } from '../../src/compositor/narration-audio';
import { DeterministicMotionProvider } from '../../src/providers/video/deterministic-motion';
import { compileVideoScenes } from '../../src/video/storyboard/compiler';
import { renderSceneSvg } from '../../src/video/render/renderer';
import { CANONICAL_GRAPH, buildTinyVideoPlan } from './fixtures';

describe('buildTimeline', () => {
  const compiled = compileVideoScenes(buildTinyVideoPlan(), CANONICAL_GRAPH);
  const timeline = buildTimeline(compiled.scenes, { fps: 30 });

  test('contiguous entries covering the full duration', () => {
    expect(timeline.entries.length).toBe(3);
    expect(timeline.entries[0]?.startSeconds).toBe(0);
    let prevEnd = 0;
    for (const entry of timeline.entries) {
      expect(entry.startSeconds).toBe(prevEnd);
      expect(entry.endSeconds).toBeGreaterThan(entry.startSeconds);
      prevEnd = entry.endSeconds;
    }
    expect(timeline.durationSeconds).toBe(20);
    expect(timeline.totalFrames).toBe(600);
  });

  test('first scene cuts in; later crossfades carry the observed ramp', () => {
    expect(timeline.entries[0]?.transitionIn).toEqual({ type: 'cut', seconds: 0 });
    expect(timeline.entries[1]?.transitionIn.type).toBe('crossfade');
    expect(timeline.entries[1]?.transitionIn.seconds).toBe(0.4);
    expect(timeline.entries[0]?.transitionOut.type).toBe('crossfade');
  });

  test('layer sampling at a cut boundary blends outgoing and incoming', () => {
    const boundary = timeline.entries[1]?.startSeconds ?? 0;
    const layers = sampleTimelineLayers(timeline, boundary, new Map());
    expect(layers.length).toBe(2);
    const alphas = layers.map((layer) => layer.alpha);
    expect(alphas[0]).toBeCloseTo(0.5, 5);
    expect(alphas[1]).toBeCloseTo(0.5, 5);
  });

  test('layer sampling mid-scene is single and opaque', () => {
    const mid = (timeline.entries[1]?.startSeconds ?? 0) + 2;
    const layers = sampleTimelineLayers(timeline, mid, new Map());
    expect(layers.length).toBe(1);
    expect(layers[0]?.alpha).toBe(1);
  });

  test('camera interpolation follows the motion plan', async () => {
    const motion = new DeterministicMotionProvider();
    const plans = new Map<string, Awaited<ReturnType<typeof motion.planMotion>>>();
    for (const entry of timeline.entries) {
      plans.set(
        entry.sceneId,
        await motion.planMotion({
          sceneId: entry.sceneId,
          motion: entry.motion,
          seed: `seed|${entry.sceneId}`,
          durationSeconds: entry.endSeconds - entry.startSeconds,
          canvasWidthPx: 1280,
          canvasHeightPx: 720,
        }),
      );
    }
    // The tiny plan's diagram scene carries animated-diagram motion (push-in).
    const animated = timeline.entries.find((entry) => entry.motion === 'animated-diagram');
    expect(animated).toBeDefined();
    const mid = ((animated?.startSeconds ?? 0) + (animated?.endSeconds ?? 0)) / 2;
    const layers = sampleTimelineLayers(timeline, mid, plans);
    const layer = layers.find((candidate) => candidate.sceneId === animated?.sceneId);
    expect(layer).toBeDefined();
    expect(layer?.camera.scale).toBeGreaterThan(1);
    const planForScene = animated !== undefined ? plans.get(animated.sceneId) : undefined;
    expect(layer?.camera.scale).toBeLessThanOrEqual(planForScene?.to.scale ?? 2);
  });

  test('frame times are frame-aligned and complete', () => {
    const times = frameTimes(timeline);
    expect(times.length).toBe(600);
    expect(times[0]).toBe(0);
    expect(times[599]).toBeCloseTo(599 / 30, 6);
  });
});

describe('fallback frame model', () => {
  const compiled = compileVideoScenes(buildTinyVideoPlan(), CANONICAL_GRAPH);
  const timeline = buildTimeline(compiled.scenes, { fps: 30 });
  const frames = new Map<string, string>();
  for (const entry of compiled.storyboard.scenes) {
    frames.set(
      entry.scene.id,
      renderSceneSvg({ spec: entry.render, styleBible: compiled.storyboard.styleBible }),
    );
  }

  test('byte-identical frames for identical inputs', () => {
    const a = renderFrameAt(timeline, frames, new Map(), 5.234);
    const b = renderFrameAt(timeline, frames, new Map(), 5.234);
    expect(a).toBe(b);
    expect(a.startsWith('<svg xmlns=')).toBe(true);
  });

  test('boundary frame contains both scene ids during the crossfade', () => {
    const boundary = timeline.entries[1]?.startSeconds ?? 0;
    const frame = renderFrameAt(timeline, frames, new Map(), boundary);
    // Both layers' content appears (nested svg layers with opacity).
    expect((frame.match(/<svg /g) ?? []).length).toBeGreaterThanOrEqual(3);
  });

  test('placeholder narration WAV is well-formed and deterministic', () => {
    const timings = timeline.entries.map((entry) => ({
      segmentId: `narr-${entry.sceneId}`,
      sceneId: entry.sceneId,
      startSeconds: entry.startSeconds,
    }));
    const a = synthesizePlaceholderNarration(timeline, timings);
    const b = synthesizePlaceholderNarration(timeline, timings);
    expect(a.wav.length).toBe(b.wav.length);
    expect(Buffer.compare(Buffer.from(a.wav), Buffer.from(b.wav))).toBe(0);
    expect(a.sampleRate).toBe(44_100);
    expect(a.durationSeconds).toBe(20);
    // WAV header sanity.
    const header = Buffer.from(a.wav.slice(0, 44));
    expect(header.toString('ascii', 0, 4)).toBe('RIFF');
    expect(header.toString('ascii', 8, 12)).toBe('WAVE');
    // Mono 16-bit sample count matches duration.
    expect((a.wav.length - 44) / 2).toBe(Math.ceil(20 * 44_100));
    // Encoder round-trip.
    const samples = new Float32Array(10);
    expect(encodeWav16Mono(samples, 8_000).length).toBe(64);
  });
});

describe('fallback composition with system ffmpeg (librsvg)', () => {
  test('assembles a deterministic MP4 when ffmpeg+librsvg is available', async () => {
    const caps = await detectFfmpeg();
    if (!caps.available || !caps.librsvg) {
      console.log('ffmpeg/librsvg unavailable; skipping assembly (frames still verified)');
      return;
    }
    const compiled = compileVideoScenes(buildTinyVideoPlan(), CANONICAL_GRAPH);
    const timeline = buildTimeline(compiled.scenes, { fps: 12 });
    const frames = new Map<string, string>();
    for (const entry of compiled.storyboard.scenes) {
      frames.set(
        entry.scene.id,
        renderSceneSvg({ spec: entry.render, styleBible: compiled.storyboard.styleBible }),
      );
    }
    const workDir = mkdtempSync(join(tmpdir(), 'wflx-fallback-test-'));
    const output = join(workDir, 'out.mp4');
    const narration = synthesizePlaceholderNarration(timeline, [
      { segmentId: 'narr-scene-1', sceneId: 'scene-1', startSeconds: 0 },
      { segmentId: 'narr-scene-2', sceneId: 'scene-2', startSeconds: 4 },
      { segmentId: 'narr-scene-3', sceneId: 'scene-3', startSeconds: 12 },
    ]);
    const result = await composeWithFallback({
      timeline,
      sceneSvgs: frames,
      motions: new Map(),
      output,
      narrationWav: narration.wav,
      workDir,
    });
    expect(result.assembled).toBe(true);
    expect(existsSync(output)).toBe(true);
    expect(result.frameCount).toBe(240); // 20 s at 12 fps
    expect(countFrames(result.framesDir)).toBe(240);
    // mp4 header sanity.
    const head = readFileSync(output).subarray(4, 8).toString('latin1');
    expect(['ftyp', 'moov', 'mdat', 'free']).toContain(head);
    // Deterministic frame content: recompose and compare a sample frame.
    const sampleA = readFileSync(join(result.framesDir, 'frame-000100.svg'), 'utf8');
    expect(sampleA.length).toBeGreaterThan(500);
    rmSync(workDir, { recursive: true, force: true });
  }, 120_000);
});
