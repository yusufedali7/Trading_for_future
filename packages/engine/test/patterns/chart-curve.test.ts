import { describe, expect, it } from 'vitest';
import type { Bars } from '../../src/features/bars';
import { sliceBars } from '../../src/features/bars';
import { detectSwings } from '../../src/features/swing';
import {
  detectCupAndHandle,
  detectDiamond,
  detectRoundingBottom,
} from '../../src/patterns/chart-curve';
import { CHART_PIVOT_PARAMS, roundness } from '../../src/patterns/chart-shared';
import { bars, pathBars, randomWalk } from '../helpers/synthetic-bars';

function swingsOf(b: Bars) {
  return detectSwings(b, CHART_PIVOT_PARAMS);
}

/** A flat-OHLC Bars whose closes follow `f(i)` exactly, for testing `roundness()` in isolation. */
function closesOf(n: number, f: (i: number) => number): Bars {
  return bars(Array.from({ length: n }, (_, i) => [f(i), f(i), f(i), f(i)] as const));
}

describe('roundness (parabola fit)', () => {
  it('scores a true upward-opening parabola close to 1, with a positive leading coefficient', () => {
    const b = closesOf(41, (i) => 1.1 + 0.02 * (i / 40 - 0.5) ** 2 * 4);
    const { a, r2 } = roundness(b, 0, 40);
    expect(a).toBeGreaterThan(0);
    expect(r2).toBeGreaterThan(0.99);
  });

  it('scores a downward-opening parabola with a negative leading coefficient', () => {
    const b = closesOf(41, (i) => 1.12 - 0.02 * (i / 40 - 0.5) ** 2 * 4);
    const { a, r2 } = roundness(b, 0, 40);
    expect(a).toBeLessThan(0);
    expect(r2).toBeGreaterThan(0.99);
  });

  it('scores a flat-mean zigzag far below either roundness_min used in this file (0.6/0.7)', () => {
    const b = closesOf(41, (i) => 1.1 + (i % 2 === 0 ? 0.01 : -0.01));
    const { r2 } = roundness(b, 0, 40);
    expect(r2).toBeLessThan(0.3);
  });
});

describe('detectCupAndHandle', () => {
  it('finds a cup and handle: a rounded cup, a shallow handle, then a close above the rim', () => {
    const b = pathBars([
      [0, 1.08],
      [10, 1.12], // P1 (HIGH, left rim)
      [20, 1.10889],
      [30, 1.10222],
      [40, 1.1], // P2 (LOW, cup bottom) - parabola samples through here
      [50, 1.10222],
      [60, 1.10889],
      [70, 1.12], // P3 (HIGH, right rim, same as P1)
      [85, 1.115], // P4 (LOW, handle) - shallow retrace
      [100, 1.14],
    ]);
    const found = detectCupAndHandle(b, swingsOf(b));
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ patternId: 'cup_and_handle', direction: 'BULLISH' });
    expect(found[0]!.pivots).toHaveLength(4);
  });

  it('does not fire when the handle retraces more than half the cup depth', () => {
    const b = pathBars([
      [0, 1.08],
      [10, 1.12],
      [20, 1.10889],
      [30, 1.10222],
      [40, 1.1],
      [50, 1.10222],
      [60, 1.10889],
      [70, 1.12],
      [85, 1.1], // handle retraces the whole cup depth
      [100, 1.14],
    ]);
    expect(detectCupAndHandle(b, swingsOf(b))).toEqual([]);
  });
});

describe('detectRoundingBottom', () => {
  it('finds a rounding bottom: a wide, rounded U, then a close above the rim', () => {
    const b = pathBars([
      [0, 1.08],
      [10, 1.12], // P1 (HIGH)
      [20, 1.10889],
      [30, 1.10222],
      [40, 1.1], // P2 (LOW)
      [50, 1.10222],
      [60, 1.10889],
      [70, 1.12], // P3 (HIGH, rim)
      [75, 1.115], // brief pullback so P3 is a real local high
      [85, 1.14],
    ]);
    const found = detectRoundingBottom(b, swingsOf(b));
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ patternId: 'rounding_bottom', direction: 'BULLISH' });
  });

  it('does not fire when the bowl spans fewer than min_bars', () => {
    const b = pathBars([
      [0, 1.08],
      [10, 1.12], // P1
      [16, 1.10889],
      [22, 1.10222],
      [28, 1.1], // P2
      [34, 1.10222],
      [40, 1.10889],
      [46, 1.12], // P3 - only 36 bars after P1, under min_bars (40)
      [60, 1.14],
    ]);
    expect(detectRoundingBottom(b, swingsOf(b))).toEqual([]);
  });
});

describe('detectDiamond', () => {
  it('finds a diamond: widening then narrowing swings, then a close outside the narrowing lines', () => {
    const b = pathBars([
      [0, 1.08],
      [10, 1.1], // P1 (HIGH)
      [20, 1.095], // P2 (LOW)
      [30, 1.11], // P3 (HIGH, wider than P1/P2 - broadening)
      [40, 1.085], // P4 (LOW, wider than P1/P2)
      [50, 1.105], // P5 (HIGH, narrower than P3/P4 - contracting)
      [60, 1.09], // P6 (LOW, narrower than P3/P4)
      [75, 1.13],
    ]);
    const found = detectDiamond(b, swingsOf(b));
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ patternId: 'diamond', direction: 'BULLISH' });
    expect(found[0]!.pivots).toHaveLength(6);
  });

  it('does not fire when the swings never broaden', () => {
    const b = pathBars([
      [0, 1.08],
      [10, 1.1],
      [20, 1.095],
      [30, 1.1], // barely wider than P1/P2 - not real broadening
      [40, 1.097],
      [50, 1.105],
      [60, 1.09],
      [75, 1.13],
    ]);
    expect(detectDiamond(b, swingsOf(b))).toEqual([]);
  });
});

describe('no lookahead (cup and handle, rounding bottom, diamond together)', () => {
  it('cutting the data never changes an already-confirmed detection', () => {
    const w = randomWalk(1200, 131, 1.1, 6);
    const all = (bb: Bars) => {
      const s = detectSwings(bb, CHART_PIVOT_PARAMS);
      return [
        ...detectCupAndHandle(bb, s),
        ...detectRoundingBottom(bb, s),
        ...detectDiamond(bb, s),
      ];
    };
    const full = all(w);
    for (let k = 20; k <= w.length; k += 53) {
      const cut = all(sliceBars(w, k));
      expect(cut).toEqual(full.filter((d) => d.confirmedIndex < k));
    }
  });
});
