/**
 * StyleBible tests (WFLX-W3).
 *
 * The canonical instance must validate against its own schema, stay pinned
 * to the committed annotation's identity, and resolve exactly as the plan
 * fixtures reference it. Version discipline mirrors CONTRACTS_VERSION tests.
 */

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import {
  KNOWN_STYLE_BIBLES,
  REFERENCE_INK_STYLE_BIBLE,
  STYLE_BIBLE_VERSION,
  isStyleBible,
  parseStyleBible,
  resolveStyleBible,
  styleBibleById,
} from '../../src/video/style-bible';

describe('StyleBible schema and canonical instance', () => {
  test('canonical instance validates against its own schema', () => {
    expect(isStyleBible(REFERENCE_INK_STYLE_BIBLE)).toBe(true);
    expect(parseStyleBible(REFERENCE_INK_STYLE_BIBLE)).toEqual(REFERENCE_INK_STYLE_BIBLE);
  });

  test('version is pinned and major-locked', () => {
    expect(STYLE_BIBLE_VERSION).toBe('1.0.0');
    expect(REFERENCE_INK_STYLE_BIBLE.styleBibleVersion).toBe(STYLE_BIBLE_VERSION);
    expect(() =>
      parseStyleBible({ ...REFERENCE_INK_STYLE_BIBLE, styleBibleVersion: '2.0.0' }),
    ).toThrow();
    expect(() =>
      parseStyleBible({ ...REFERENCE_INK_STYLE_BIBLE, styleBibleVersion: '1.1.0' }),
    ).not.toThrow();
  });

  test('id matches the canonical plan fixture reference', () => {
    const plan = JSON.parse(
      readFileSync('fixtures/contracts/plan-video-explainer-7min.json', 'utf8'),
    ) as { style: { styleBibleId?: string } };
    expect(plan.style.styleBibleId).toBe(REFERENCE_INK_STYLE_BIBLE.id);
  });

  test('evidence links to the committed annotation and its served-variant sha', () => {
    const annotation = JSON.parse(
      readFileSync('reference/annotations/reference-video-scenes.json', 'utf8'),
    ) as { sha256: string; annotationVersion: string };
    expect(REFERENCE_INK_STYLE_BIBLE.evidence.servedVariantSha256).toBe(annotation.sha256);
    expect(REFERENCE_INK_STYLE_BIBLE.evidence.annotationVersion).toBe(annotation.annotationVersion);
    expect(REFERENCE_INK_STYLE_BIBLE.evidence.annotationFile).toBe(
      'reference/annotations/reference-video-scenes.json',
    );
  });

  test('palette roles are lowercase hex and grammatically distinct', () => {
    const palette = REFERENCE_INK_STYLE_BIBLE.palette;
    for (const role of Object.values(palette)) {
      expect(role.value).toMatch(/^#[0-9a-f]{6}$/);
      expect(role.evidence.length).toBeGreaterThan(10);
    }
    expect(palette.background.value).toBe('#3e4346');
    expect(palette.emphasis.value).toBe('#53dfcd');
    expect(palette.warning.value).not.toBe(palette.emphasis.value);
    expect(palette.aiNode.value).not.toBe(palette.emphasis.value);
  });

  test('motion grammar encodes the observed transition mix', () => {
    const motion = REFERENCE_INK_STYLE_BIBLE.motion;
    expect(motion.preferredTransition).toBe('crossfade');
    expect(motion.crossfadeShare).toBeCloseTo(0.52, 2);
    expect(motion.hardCutShare).toBeCloseTo(0.375, 3);
    expect(motion.defaultMotion).toBe('static');
  });

  test('pacing grammar encodes the observed narration-led pacing', () => {
    const pacing = REFERENCE_INK_STYLE_BIBLE.pacing;
    expect(pacing.narrationLed).toBe(true);
    expect(pacing.pauseSyncShare).toBeCloseTo(0.75, 2);
    expect(pacing.medianSceneSeconds).toBeGreaterThan(4);
    expect(pacing.minSceneSeconds).toBe(2);
  });

  test('rules carry the reconstruction rules from the annotation', () => {
    expect(REFERENCE_INK_STYLE_BIBLE.rules.length).toBeGreaterThanOrEqual(10);
    expect(REFERENCE_INK_STYLE_BIBLE.rules[0]).toContain('Exact labels');
  });

  test('resolution: known ids resolve, unknown ids degrade to canonical deterministically', () => {
    expect(styleBibleById('style-bible--reference-ink')).toBe(REFERENCE_INK_STYLE_BIBLE);
    expect(styleBibleById('style-bible--missing')).toBeUndefined();
    expect(resolveStyleBible('style-bible--reference-ink')).toBe(REFERENCE_INK_STYLE_BIBLE);
    expect(resolveStyleBible(undefined)).toBe(REFERENCE_INK_STYLE_BIBLE);
    expect(resolveStyleBible('style-bible--missing')).toBe(REFERENCE_INK_STYLE_BIBLE);
    expect(KNOWN_STYLE_BIBLES).toContain(REFERENCE_INK_STYLE_BIBLE);
  });

  test('schema rejects structural mutations', () => {
    expect(isStyleBible({ ...REFERENCE_INK_STYLE_BIBLE, recordType: 'Nope' })).toBe(false);
    expect(
      isStyleBible({ ...REFERENCE_INK_STYLE_BIBLE, palette: { background: '#3e4346' } }),
    ).toBe(false);
    expect(
      isStyleBible({
        ...REFERENCE_INK_STYLE_BIBLE,
        typography: { ...REFERENCE_INK_STYLE_BIBLE.typography, labelCase: 'shout' },
      }),
    ).toBe(false);
  });
});
