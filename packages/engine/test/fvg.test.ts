import { describe, expect, it } from 'vitest';
import { sliceBars } from '../src/features/bars';
import { FirstReach } from '../src/features/first-reach';
import { detectFvgs } from '../src/features/fvg';
import type { Fvg } from '../src/features/types';
import { getInstrument } from '../src/instruments/registry';
import { BAR_MS, T0, bars, randomWalk } from './helpers/synthetic-bars';

const EUR = getInstrument('EURUSD');
const end = (i: number) => T0 + (i + 1) * BAR_MS;

/** What was known about a gap at `cutoff`: later touches and fills are not known yet. */
const asOf = (g: Fvg, cutoff: number): Fvg => ({
  ...g,
  touchedAt: g.touchedAt !== null && g.touchedAt <= cutoff ? g.touchedAt : null,
  filledAt: g.filledAt !== null && g.filledAt <= cutoff ? g.filledAt : null,
});

describe('detectFvgs (v1)', () => {
  // SYNTHETIC: bar 0 high 1.1010, bar 2 low 1.1030 → bullish gap 1.1010–1.1030 (20 pips).
  const b = bars([
    [1.1, 1.101, 1.0995, 1.1008],
    [1.1008, 1.105, 1.1005, 1.1045],
    [1.1045, 1.106, 1.103, 1.1055],
    [1.1055, 1.1058, 1.1025, 1.103], // touches the top (1.1030)
    [1.103, 1.1035, 1.1015, 1.102],
    [1.102, 1.1026, 1.1005, 1.101], // fills: low 1.1005 ≤ bottom 1.1010
  ]);

  it('finds a bullish gap formed at the middle bar and known at the third bar close', () => {
    const [g, ...rest] = detectFvgs(b, EUR);
    expect(rest).toEqual([]);
    expect(g).toEqual({
      id: `FVG:v1:BULLISH:${T0 + BAR_MS}`,
      defVersion: 'v1',
      type: 'FVG',
      direction: 'BULLISH',
      top: 1.103,
      bottom: 1.101,
      formedAt: T0 + BAR_MS,
      formedIndex: 1,
      confirmedAt: end(2),
      confirmedIndex: 2,
      touchedAt: end(3),
      filledAt: end(5),
    });
  });

  it('finds bearish gaps and applies the minimum size in pips', () => {
    // SYNTHETIC: bar 0 low 1.1000, bar 2 high 1.0995 → 5 pip bearish gap.
    const d = bars([
      [1.101, 1.1012, 1.1, 1.1001],
      [1.1001, 1.1002, 1.098, 1.0982],
      [1.0982, 1.0995, 1.097, 1.0975],
    ]);
    expect(detectFvgs(d, EUR, { minSizePips: 5 })).toMatchObject([
      { direction: 'BEARISH', top: 1.1, bottom: 1.0995, touchedAt: null, filledAt: null },
    ]);
    expect(detectFvgs(d, EUR, { minSizePips: 5.1 })).toEqual([]);
  });

  it('has no gap when the third bar only reaches the first bar (no overlap rule)', () => {
    const d = bars([
      [1.1, 1.101, 1.0995, 1.1008],
      [1.1008, 1.105, 1.1005, 1.1045],
      [1.1045, 1.106, 1.101, 1.1055], // low = first high: no gap
    ]);
    expect(detectFvgs(d, EUR, { minSizePips: 0 })).toEqual([]);
  });

  it('is truncation invariant (touch and fill only once they happened)', () => {
    const w = randomWalk(600, 7);
    const full = detectFvgs(w, EUR);
    expect(full.length).toBeGreaterThan(5);
    for (let k = 0; k <= w.length; k++) {
      const cutoff = k === 0 ? 0 : w.end[k - 1]!;
      const known = full.filter((g) => g.confirmedIndex < k).map((g) => asOf(g, cutoff));
      expect(detectFvgs(sliceBars(w, k), EUR)).toEqual(known);
    }
  });
});

describe('FirstReach', () => {
  it('finds the first index at or after `from` that reaches the threshold', () => {
    const lows = new FirstReach([5, 3, 4, 2, 6, 1], 'MIN');
    expect(lows.first(0, 3)).toBe(1);
    expect(lows.first(2, 3)).toBe(3);
    expect(lows.first(4, 1)).toBe(5);
    expect(lows.first(4, 0.5)).toBe(-1);
    const highs = new FirstReach([1, 4, 2, 7], 'MAX');
    expect(highs.first(2, 5)).toBe(3);
    expect(highs.first(9, 0)).toBe(-1);
  });
});
