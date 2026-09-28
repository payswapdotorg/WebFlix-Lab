/**
 * Committed annotation tests (WFLX-W3): the golden-reference annotation gate.
 *
 * The machine-readable annotation must cover the FULL duration with no gaps
 * or overlaps, carry the verified served-variant identity, flag sensitive
 * regions, and stay linked to the StyleBible that derives from it.
 */

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { REFERENCE_INK_STYLE_BIBLE } from '../../src/video/style-bible';

interface AnnotationScene {
  index: number;
  startSeconds: number;
  endSeconds: number;
  durationSeconds: number;
  transitionIn: { type: string };
  motion: { level: string };
  visualType: string;
  renderingClass: string;
  exactTexts: { value: string }[];
  narrationCue: string;
  narrationPauseDistanceSeconds: number | null;
  sensitive: boolean;
}

interface Annotation {
  recordType: string;
  annotationVersion: string;
  sha256: string;
  durationSeconds: number;
  coverage: { segments: number; firstStart: number; lastEnd: number; gaps: unknown[]; overlaps: unknown[]; fullDuration: boolean };
  scenes: AnnotationScene[];
  globalObservations: { label: string; finding: string }[];
}

const ANNOTATION: Annotation = JSON.parse(
  readFileSync('reference/annotations/reference-video-scenes.json', 'utf8'),
);

const SERVED_VARIANT_SHA = 'f1241c219a42906d35030eb01f51be490f5ec95ba0682d4b1c629ee88031768b';
const DURATION = 415.613968;

describe('committed reference annotation — coverage gate', () => {
  test('identity matches the verified served variant', () => {
    expect(ANNOTATION.recordType).toBe('ReferenceVideoAnnotation');
    expect(ANNOTATION.annotationVersion).toBe('1.0.0');
    expect(ANNOTATION.sha256).toBe(SERVED_VARIANT_SHA);
    expect(ANNOTATION.durationSeconds).toBe(DURATION);
  });

  test('full-duration segmentation with no gaps or overlaps', () => {
    expect(ANNOTATION.coverage.fullDuration).toBe(true);
    expect(ANNOTATION.coverage.gaps).toEqual([]);
    expect(ANNOTATION.coverage.overlaps).toEqual([]);
    expect(ANNOTATION.scenes.length).toBe(ANNOTATION.coverage.segments);
    expect(ANNOTATION.coverage.firstStart).toBe(0);
    expect(Math.abs(ANNOTATION.coverage.lastEnd - DURATION)).toBeLessThan(0.01);
    for (const scene of ANNOTATION.scenes) {
      expect(scene.endSeconds).toBeGreaterThan(scene.startSeconds);
      expect(scene.durationSeconds).toBeCloseTo(
        scene.endSeconds - scene.startSeconds,
        3,
      );
    }
    for (let i = 1; i < ANNOTATION.scenes.length; i += 1) {
      const prev = ANNOTATION.scenes[i - 1];
      const current = ANNOTATION.scenes[i];
      expect(prev?.endSeconds).toBe(current?.startSeconds);
    }
  });

  test('every scene carries OBSERVED grammar fields', () => {
    for (const scene of ANNOTATION.scenes) {
      expect(scene.visualType.length).toBeGreaterThan(0);
      expect(['deterministic', 'generative', 'hybrid']).toContain(scene.renderingClass);
      expect(typeof scene.narrationCue).toBe('string');
      expect(['hard-cut', 'crossfade', 'cut', 'soft-change', 'soft-fade', 'none (video start)']).toContain(
        scene.transitionIn.type,
      );
      expect(['static', 'subtle', 'moderate', 'high', 'unknown']).toContain(scene.motion.level);
    }
    // First scene starts the video; only the last ends it.
    expect(ANNOTATION.scenes[0]?.transitionIn.type).toBe('none (video start)');
  });

  test('observed transition and motion statistics are present in the grammar', () => {
    const transitions = ANNOTATION.scenes.slice(1).map((scene) => scene.transitionIn.type);
    const crossfades = transitions.filter((type) => type === 'crossfade').length;
    const hardCuts = transitions.filter((type) => type === 'hard-cut').length;
    expect(crossfades).toBe(25);
    expect(hardCuts).toBe(18);
    const staticScenes = ANNOTATION.scenes.filter((scene) => scene.motion.level === 'static').length;
    expect(staticScenes).toBe(37);
  });

  test('sensitive regions are flagged and carry no credential-like values', () => {
    const sensitive = ANNOTATION.scenes.filter((scene) => scene.sensitive);
    expect(sensitive.map((scene) => scene.index)).toEqual([11, 17]);
    const serialized = JSON.stringify(ANNOTATION);
    // Credential-shaped patterns must not appear in the committed annotation.
    expect(serialized).not.toMatch(/ghp_[A-Za-z0-9]{20,}/);
    expect(serialized).not.toMatch(/sk-[A-Za-z0-9]{20,}/);
    expect(serialized).not.toMatch(/AKIA[0-9A-Z]{16}/);
    expect(serialized).not.toMatch(/AIza[0-9A-Za-z_-]{30,}/);
    // The sensitive note never transcribes the in-video value.
    expect(sensitive.every((scene) => !scene.exactTexts.some((text) => /token/i.test(text.value) && /[A-Za-z0-9]{20,}/.test(text.value)))).toBe(true);
  });

  test('global observations are evidence-labeled and substantive', () => {
    expect(ANNOTATION.globalObservations.length).toBeGreaterThanOrEqual(14);
    for (const observation of ANNOTATION.globalObservations) {
      expect(observation.label).toBe('OBSERVED');
      expect(observation.finding.length).toBeGreaterThan(30);
    }
    const findings = ANNOTATION.globalObservations.map((observation) => observation.finding).join(' ');
    expect(findings).toContain('crossfade');
    expect(findings).toContain('narration');
    expect(findings).toContain('#3e4346');
  });

  test('StyleBible derives from this annotation identity', () => {
    expect(REFERENCE_INK_STYLE_BIBLE.evidence.servedVariantSha256).toBe(ANNOTATION.sha256);
    expect(REFERENCE_INK_STYLE_BIBLE.evidence.annotationVersion).toBe(ANNOTATION.annotationVersion);
    // Pacing grammar matches the annotation's observed statistics.
    const durations = ANNOTATION.scenes.map((scene) => scene.durationSeconds).sort((a, b) => a - b);
    const median = durations[Math.floor(durations.length / 2)] ?? 0;
    expect(REFERENCE_INK_STYLE_BIBLE.pacing.medianSceneSeconds).toBeCloseTo(median, 0);
    expect(REFERENCE_INK_STYLE_BIBLE.pacing.minSceneSeconds).toBeCloseTo(durations[0] ?? 0, 0);
    expect(REFERENCE_INK_STYLE_BIBLE.pacing.maxSceneSeconds).toBeCloseTo(
      durations[durations.length - 1] ?? 0,
      0,
    );
  });

  test('human-readable companion exists and documents the method', () => {
    const md = readFileSync('reference/annotations/reference-video-scenes.md', 'utf8');
    expect(md).toContain('## Method (reproducible instrument protocol)');
    expect(md).toContain("select='gt(scene,0.2)'");
    expect(md).toContain('silencedetect=noise=-38dB:d=0.45');
    expect(md).toContain('## Scene index');
    expect(md).toContain('| 48 | 412.600');
  });
});
