/**
 * v2 contract wave mechanism tests (C-5 + C-7; ruling 2026-09-29).
 *
 * Pins the two new shared-contract surfaces at the unit level:
 * - unitContentHash (C-5): the ONE per-unit content-keyed seeding
 *   derivation shared by both surfaces' stochastic keys;
 * - rate-model (C-7): the ONE authoritative turn-rate/mass-budget surface
 *   (values identical to the Director constants they replaced).
 *
 * Lab mechanism pins only — NOT product-parity evidence (AGENTS.md).
 */

import { describe, expect, test } from 'bun:test';
import {
  ANCHOR_CONNECTOR_TOKENS,
  FACTUAL_TURN_PURPOSES,
  MIN_TURN_SECONDS,
  QUESTION_TAIL_TOKENS,
  TOPICAL_TISSUE_TOKENS,
  TURN_PLANNING_RATE_WPS,
  unitContentHash,
} from '../../src/contracts';

describe('unitContentHash (C-5 shared derivation)', () => {
  test('deterministic: identical parts -> identical hash, across calls', () => {
    expect(unitContentHash(['brief', 'anchor one', 'anchor two'])).toBe(
      unitContentHash(['brief', 'anchor one', 'anchor two']),
    );
  });

  test('any part change changes the hash (unit-locality mechanism)', () => {
    const base = unitContentHash(['brief', 'anchor']);
    expect(unitContentHash(['brief changed', 'anchor'])).not.toBe(base);
    expect(unitContentHash(['brief', 'anchor changed'])).not.toBe(base);
  });

  test('order-sensitive and part-boundary unambiguous (JSON array encoding)', () => {
    // ['a:b', 'c'] vs ['a', 'b:c'] are DIFFERENT part lists — no
    // concatenation-collision ambiguity in the JSON encoding.
    expect(unitContentHash(['a:b', 'c'])).not.toBe(unitContentHash(['a', 'b:c']));
    expect(unitContentHash(['a', 'b'])).not.toBe(unitContentHash(['b', 'a']));
  });

  test('empty and single-part lists are stable hashes (zero-claim turns)', () => {
    expect(unitContentHash([])).toBe(unitContentHash([]));
    expect(unitContentHash(['just a brief'])).toBe(unitContentHash(['just a brief']));
    expect(unitContentHash([])).not.toBe(unitContentHash(['']));
  });

  test('64-char lowercase hex (sha256 shape)', () => {
    expect(unitContentHash(['x'])).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('rate model (C-7 shared surface)', () => {
  test('planning rate is the conservative 2.5 wps prior', () => {
    // EV-008: 2.5 wps sits below the tightest effective mode ceiling
    // (2.6 wps x 0.96 pacing x 1.15 ceiling multiplier = 2.87 wps).
    expect(TURN_PLANNING_RATE_WPS).toBe(2.5);
    expect(TURN_PLANNING_RATE_WPS).toBeLessThan(2.87);
  });

  test('factual carrier purposes mirror the W2 grounding rule complement', () => {
    expect([...FACTUAL_TURN_PURPOSES].sort()).toEqual(
      ['clarification', 'connection', 'example', 'explanation'],
    );
  });

  test('mass-budget tokens and minimum turn hold the P3A values', () => {
    expect(QUESTION_TAIL_TOKENS).toBe(8);
    expect(ANCHOR_CONNECTOR_TOKENS).toBe(5);
    expect(TOPICAL_TISSUE_TOKENS).toBe(8);
    expect(MIN_TURN_SECONDS).toBe(2);
  });
});
