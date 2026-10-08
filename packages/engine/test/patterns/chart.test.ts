import { describe, expect, it } from 'vitest';
import type { Bars } from '../../src/features/bars';
import { sliceBars } from '../../src/features/bars';
import {
  detectDoubleBottom,
  detectDoubleTop,
  detectHeadShouldersBottom,
  detectHeadShouldersTop,
  detectTripleBottom,
  detectTripleTop,
} from '../../src/patterns/chart';
import { CHART_PIVOT_PARAMS } from '../../src/patterns/chart-shared';
import { detectSwings } from '../../src/features/swing';
import { randomWalk } from '../helpers/synthetic-bars';

const BAR_MS = 15 * 60_000;
const T0 = Date.parse('2026-01-06T08:00:00Z');

/**
 * SYNTHETIC: a smooth piecewise-linear price path through `points` ([barIndex, price], sorted),
 * with a tiny constant wick on every bar - gentle and slow enough that each bar's own true range
 * stays far below the deliberately large (multi-ATR) tolerances used in the tests below, so the
 * exact ATR value never has to be computed by hand.
 */
function pathBars(points: readonly (readonly [number, number])[]): Bars {
  const last = points[points.length - 1]!;
  const n = last[0] + 1;
  const priceAt = (i: number) => {
    let k = 0;
    while (k < points.length - 2 && points[k + 1]![0] <= i) k++;
    const [i0, p0] = points[k]!;
    const [i1, p1] = points[k + 1]!;
    const t = i1 === i0 ? 0 : (i - i0) / (i1 - i0);
    return p0 + (p1 - p0) * t;
  };
  const eps = 0.0001;
  const rows: [number, number, number, number][] = [];
  let prevClose = priceAt(0);
  for (let i = 0; i < n; i++) {
    const c = priceAt(i);
    const o = i === 0 ? c : prevClose;
    rows.push([o, Math.max(o, c) + eps, Math.min(o, c) - eps, c]);
    prevClose = c;
  }
  const t = rows.map((_, i) => T0 + i * BAR_MS);
  return {
    length: n,
    t,
    o: rows.map((r) => r[0]),
    h: rows.map((r) => r[1]),
    l: rows.map((r) => r[2]),
    c: rows.map((r) => r[3]),
    end: t.map((x) => x + BAR_MS),
    v: rows.map(() => 0),
  };
}

function swingsOf(b: Bars) {
  return detectSwings(b, CHART_PIVOT_PARAMS);
}

describe('detectDoubleTop / detectDoubleBottom', () => {
  it('finds a double top: two equal peaks, a deep trough, then a close below the neckline', () => {
    const b = pathBars([
      [0, 1.09],
      [20, 1.105], // P1 (HIGH)
      [35, 1.095], // P2 (LOW, neckline) - 100 pips below the peaks, far past 2*ATR
      [50, 1.105], // P3 (HIGH), exactly equal to P1
      [65, 1.09], // breakout: closes under the neckline well after P3 is confirmed
    ]);
    const found = detectDoubleTop(b, swingsOf(b));
    expect(found).toHaveLength(1);
    // The LOW pivot's recorded price is the bar's own low (path price minus the fixture's wick).
    expect(found[0]).toMatchObject({
      patternId: 'double_top',
      direction: 'BEARISH',
      confirmationRef: 1.0949,
    });
    expect(found[0]!.pivots.map((p) => p.kind)).toEqual(['HIGH', 'LOW', 'HIGH']);
    expect(found[0]!.confirmedIndex).toBeGreaterThan(found[0]!.formedIndex);
  });

  it('does not fire when the second trough is too shallow (fails min_depth_atr)', () => {
    const b = pathBars([
      [0, 1.09],
      [20, 1.105],
      [35, 1.1049], // 0.1 pip deep - nowhere near 2*ATR
      [50, 1.105],
      [65, 1.09],
    ]);
    expect(detectDoubleTop(b, swingsOf(b))).toEqual([]);
  });

  it('does not fire when price breaks the old high before the neckline (invalidated)', () => {
    const b = pathBars([
      [0, 1.09],
      [20, 1.105],
      [35, 1.095],
      [50, 1.105],
      [65, 1.11], // closes above max(P1,P3) first - kills the candidate
      [80, 1.09], // even though it later dips under the neckline too
    ]);
    expect(detectDoubleTop(b, swingsOf(b))).toEqual([]);
  });

  it('finds a double bottom (mirror image)', () => {
    const b = pathBars([
      [0, 1.11],
      [20, 1.095],
      [35, 1.105],
      [50, 1.095],
      [65, 1.11],
    ]);
    const found = detectDoubleBottom(b, swingsOf(b));
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      patternId: 'double_bottom',
      direction: 'BULLISH',
      confirmationRef: 1.1051,
    });
  });
});

describe('detectTripleTop / detectTripleBottom', () => {
  it('finds a triple top: three near-equal peaks over a shared support', () => {
    const b = pathBars([
      [0, 1.09],
      [20, 1.1],
      [35, 1.095],
      [50, 1.1],
      [65, 1.095],
      [80, 1.1],
      [95, 1.085], // closes below the shared support after the 3rd peak is confirmed
    ]);
    const found = detectTripleTop(b, swingsOf(b));
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      patternId: 'triple_top',
      direction: 'BEARISH',
      confirmationRef: 1.0949,
    });
    expect(found[0]!.pivots).toHaveLength(5);
  });

  it('finds a triple bottom (mirror image)', () => {
    const b = pathBars([
      [0, 1.11],
      [20, 1.1],
      [35, 1.105],
      [50, 1.1],
      [65, 1.105],
      [80, 1.1],
      [95, 1.115],
    ]);
    const found = detectTripleBottom(b, swingsOf(b));
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ patternId: 'triple_bottom', direction: 'BULLISH' });
  });
});

describe('detectHeadShouldersTop / detectHeadShouldersBottom', () => {
  it('finds a head and shoulders top: a higher middle peak between two equal shoulders over a flat neckline', () => {
    const b = pathBars([
      [0, 1.09],
      [20, 1.1], // left shoulder
      [35, 1.095], // neckline point 1
      [50, 1.11], // head - clearly above both shoulders
      [65, 1.095], // neckline point 2 (same price - flat neckline)
      [80, 1.1], // right shoulder (equal to the left one)
      [95, 1.085], // breakout below the neckline
    ]);
    const found = detectHeadShouldersTop(b, swingsOf(b));
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ patternId: 'head_shoulders_top', direction: 'BEARISH' });
    expect(found[0]!.pivots.map((p) => p.kind)).toEqual(['HIGH', 'LOW', 'HIGH', 'LOW', 'HIGH']);
  });

  it('does not fire when the middle peak is not clearly the highest (fails head_margin_atr)', () => {
    const b = pathBars([
      [0, 1.09],
      [20, 1.1],
      [35, 1.095],
      [50, 1.1001], // barely above the shoulders - not a real head
      [65, 1.095],
      [80, 1.1],
      [95, 1.085],
    ]);
    expect(detectHeadShouldersTop(b, swingsOf(b))).toEqual([]);
  });

  it('finds an inverse head and shoulders (mirror image)', () => {
    const b = pathBars([
      [0, 1.11],
      [20, 1.1],
      [35, 1.105],
      [50, 1.09],
      [65, 1.105],
      [80, 1.1],
      [95, 1.115],
    ]);
    const found = detectHeadShouldersBottom(b, swingsOf(b));
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ patternId: 'head_shoulders_bottom', direction: 'BULLISH' });
  });
});

describe('no lookahead (all 6 reversal chart patterns together)', () => {
  it('cutting the data never changes an already-confirmed detection', () => {
    const w = randomWalk(900, 71, 1.1, 8);
    const all = (bb: Bars) => {
      const s = detectSwings(bb, CHART_PIVOT_PARAMS);
      return [
        ...detectDoubleTop(bb, s),
        ...detectDoubleBottom(bb, s),
        ...detectTripleTop(bb, s),
        ...detectTripleBottom(bb, s),
        ...detectHeadShouldersTop(bb, s),
        ...detectHeadShouldersBottom(bb, s),
      ];
    };
    const full = all(w);
    expect(full.length).toBeGreaterThan(0);
    for (let k = 30; k <= w.length; k += 53) {
      const cut = all(sliceBars(w, k));
      expect(cut).toEqual(full.filter((d) => d.confirmedIndex < k));
    }
  });
});
