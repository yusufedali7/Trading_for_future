import { describe, expect, it } from 'vitest';
import { sliceBars } from '../src/features/bars';
import { CISD_DEFAULTS, detectCisd } from '../src/features/cisd';
import { bars, randomWalk } from './helpers/synthetic-bars';

/** SYNTHETIC candle from open and close; wicks 0.5 pip beyond the body. */
const k = (o: number, c: number) =>
  [o, Math.max(o, c) + 0.00005, Math.min(o, c) - 0.00005, c] as const;
const r5 = (x: number) => Math.round(x * 1e5) / 1e5;
const up = (o: number) => k(o, r5(o + 0.0004));
const down = (o: number) => k(o, r5(o - 0.0004));

describe('detectCisd (v1)', () => {
  it('confirms a bullish CISD when a close goes above the open of the down-close series', () => {
    // three down closes opening at 1.1012, 1.1008, 1.1004, then a close at 1.1015 (> 1.1012)
    const b = bars([up(1.1), down(1.1012), down(1.1008), down(1.1004), k(1.1, 1.1015)]);
    const found = detectCisd(b);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      type: 'CISD',
      direction: 'BULLISH',
      level: 1.1012,
      seriesStartIndex: 1,
      seriesLength: 3,
      formedIndex: 4,
      confirmedIndex: 4,
      confirmedAt: b.end[4],
    });
  });

  it('can confirm a few bars later, as long as no new down close comes first', () => {
    const b = bars([down(1.101), down(1.1006), k(1.1002, 1.1008), k(1.1008, 1.1013)]);
    expect(detectCisd(b).map((c) => [c.direction, c.formedIndex, c.level])).toEqual([
      ['BULLISH', 3, 1.101],
    ]);
  });

  it('a new down close cancels the old level; the new series sets the level', () => {
    const b = bars([
      down(1.102), // series A: level 1.1020
      k(1.1016, 1.1018), // up, but below 1.1020
      k(1.1018, 1.1017), // down close (not below the up bar's 1.1016): series B, A is cancelled
      k(1.1014, 1.1019), // closes above B's 1.1018 (still below A's 1.1020)
    ]);
    expect(detectCisd(b).map((c) => [c.direction, c.formedIndex, c.level])).toEqual([
      ['BULLISH', 3, 1.1018],
    ]);
  });

  it('ignores series longer than maxSeries (a trend, not a pullback)', () => {
    const six = [1.103, 1.1026, 1.1022, 1.1018, 1.1014, 1.101].map(down);
    expect(detectCisd(bars([...six, k(1.1006, 1.104)]))).toEqual([]);
    expect(detectCisd(bars([...six, k(1.1006, 1.104)]), { maxSeries: 6 })).toHaveLength(1);
  });

  it('mirrors for a bearish CISD below the open of the up-close series', () => {
    const b = bars([up(1.1), up(1.1004), k(1.1008, 1.0997)]);
    expect(detectCisd(b)).toMatchObject([
      { direction: 'BEARISH', level: 1.1, seriesStartIndex: 0, seriesLength: 2, formedIndex: 2 },
    ]);
  });

  it('a doji ends a series but is not part of it', () => {
    const b = bars([down(1.101), k(1.1006, 1.1006), k(1.1006, 1.1012)]);
    expect(detectCisd(b)).toMatchObject([
      { direction: 'BULLISH', level: 1.101, seriesLength: 1, formedIndex: 2 },
    ]);
  });

  it('has the documented defaults', () => {
    expect(CISD_DEFAULTS).toEqual({ maxSeries: 5 });
  });

  it('never changes a past detection when later bars arrive (truncation invariance)', () => {
    const w = randomWalk(400, 11);
    const full = detectCisd(w);
    expect(full.length).toBeGreaterThan(5);
    for (let n = 0; n <= w.length; n += 13) {
      expect(detectCisd(sliceBars(w, n))).toEqual(full.filter((d) => d.confirmedIndex < n));
    }
  });
});
