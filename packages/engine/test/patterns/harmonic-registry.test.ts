import { describe, expect, it } from 'vitest';
import type { Swing } from '../../src/features/types';
import { detectGartley } from '../../src/patterns/harmonic';
import {
  HARMONIC_PATTERN_DETECTORS,
  HARMONIC_PATTERN_IDS,
  detectAllHarmonicPatterns,
  harmonicsAsOf,
} from '../../src/patterns/harmonic-registry';

const BAR_MS = 15 * 60_000;
const T0 = Date.parse('2026-01-06T08:00:00Z');

function fakeSwing(kind: 'HIGH' | 'LOW', price: number, formedIndex: number): Swing {
  return {
    id: `SWING:fake:${kind}:${price}:${formedIndex}`,
    defVersion: 'v1',
    type: 'SWING',
    kind,
    price,
    formedAt: T0 + formedIndex * BAR_MS,
    formedIndex,
    confirmedAt: T0 + (formedIndex + 1) * BAR_MS,
    confirmedIndex: formedIndex + 1,
  };
}

// SYNTHETIC: the same bullish Gartley fixture as patterns/harmonic.test.ts's positive case.
const GARTLEY_SWINGS = [
  fakeSwing('LOW', 100, 0), // X
  fakeSwing('HIGH', 200, 10), // A
  fakeSwing('LOW', 138.2, 20), // B
  fakeSwing('HIGH', 176.3924, 30), // C
  fakeSwing('LOW', 121.4, 40), // D
];

describe('HARMONIC_PATTERN_DETECTORS / detectAllHarmonicPatterns (D82)', () => {
  it('has exactly one entry per HARMONIC_PATTERN_IDS entry, matching the catalog (9/9)', () => {
    expect(HARMONIC_PATTERN_IDS.length).toBe(9);
    expect(new Set(HARMONIC_PATTERN_IDS).size).toBe(9);
    expect(Object.keys(HARMONIC_PATTERN_DETECTORS)).toEqual([...HARMONIC_PATTERN_IDS]);
  });

  it('every registered detector tags its output with the id it is registered under', () => {
    for (const [id, fn] of Object.entries(HARMONIC_PATTERN_DETECTORS)) {
      for (const p of fn(GARTLEY_SWINGS)) expect(p.patternId).toBe(id);
    }
  });

  it('detectAllHarmonicPatterns finds the same Gartley as calling the detector directly', () => {
    const direct = detectGartley(GARTLEY_SWINGS);
    expect(direct.length).toBeGreaterThan(0);
    const all = detectAllHarmonicPatterns(GARTLEY_SWINGS);
    expect(all.filter((p) => p.patternId === 'gartley')).toEqual(direct);
  });
});

describe('harmonicsAsOf (D82)', () => {
  it('keeps only patterns confirmed at or before the cutoff', () => {
    const found = detectGartley(GARTLEY_SWINGS);
    expect(found.length).toBeGreaterThan(0);
    const confirmedAt = found[0]!.confirmedAt;

    expect(harmonicsAsOf(found, confirmedAt - 1)).toEqual([]);
    expect(harmonicsAsOf(found, confirmedAt)).toEqual(found);
  });
});
