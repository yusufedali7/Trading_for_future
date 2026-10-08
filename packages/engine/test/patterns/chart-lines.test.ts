import { describe, expect, it } from 'vitest';
import type { Bars } from '../../src/features/bars';
import { sliceBars } from '../../src/features/bars';
import { detectSwings } from '../../src/features/swing';
import {
  detectAscendingChannel,
  detectAscendingTriangle,
  detectBroadening,
  detectDescendingChannel,
  detectDescendingTriangle,
  detectFallingWedge,
  detectRectangle,
  detectRisingWedge,
  detectSymmetricalTriangle,
} from '../../src/patterns/chart-lines';
import { CHART_PIVOT_PARAMS } from '../../src/patterns/chart-shared';
import { pathBars, randomWalk } from '../helpers/synthetic-bars';

function swingsOf(b: Bars) {
  return detectSwings(b, CHART_PIVOT_PARAMS);
}

describe('detectAscendingTriangle / detectDescendingTriangle', () => {
  it('finds an ascending triangle: flat resistance, rising support, then a close above resistance', () => {
    const b = pathBars([
      [0, 1.09],
      [20, 1.1], // P1 (HIGH, resistance)
      [35, 1.095], // P2 (LOW)
      [50, 1.1], // P3 (HIGH, same resistance)
      [65, 1.098], // P4 (LOW, well above P2 - rising support)
      [80, 1.105],
    ]);
    const found = detectAscendingTriangle(b, swingsOf(b));
    expect(found).toHaveLength(1);
    // P3's recorded price is the bar's own high (path price plus the fixture's wick).
    expect(found[0]).toMatchObject({
      patternId: 'ascending_triangle',
      direction: 'BULLISH',
      confirmationRef: 1.1001,
    });
  });

  it('finds a descending triangle (mirror image)', () => {
    const b = pathBars([
      [0, 1.11],
      [20, 1.1],
      [35, 1.105],
      [50, 1.1],
      [65, 1.102],
      [80, 1.095],
    ]);
    const found = detectDescendingTriangle(b, swingsOf(b));
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ patternId: 'descending_triangle', direction: 'BEARISH' });
  });
});

describe('detectSymmetricalTriangle', () => {
  it('finds a symmetrical triangle: converging lines, breakout before the apex', () => {
    const b = pathBars([
      [0, 1.095],
      [20, 1.11], // P1 (HIGH)
      [35, 1.095], // P2 (LOW)
      [50, 1.105], // P3 (HIGH, below P1 - upper line slopes down)
      [65, 1.1], // P4 (LOW, above P2 - lower line slopes up)
      [75, 1.12],
    ]);
    const found = detectSymmetricalTriangle(b, swingsOf(b));
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ patternId: 'symmetrical_triangle', direction: 'BULLISH' });
  });

  it('does not fire when the lines do not converge (both slope the same way)', () => {
    const b = pathBars([
      [0, 1.09],
      [20, 1.1],
      [35, 1.095],
      [50, 1.105], // both lines rising - not a symmetrical triangle
      [65, 1.102],
      [80, 1.12],
    ]);
    expect(detectSymmetricalTriangle(b, swingsOf(b))).toEqual([]);
  });
});

describe('detectRisingWedge / detectFallingWedge', () => {
  it('finds a rising wedge: both lines rise, the lower one faster, then a close below it', () => {
    const b = pathBars([
      [0, 1.1], // descending lead-in, so P1 is a real local low
      [20, 1.095], // P1 (LOW)
      [35, 1.105], // P2 (HIGH)
      [50, 1.102], // P3 (LOW, well above P1 - steep lower line)
      [65, 1.108], // P4 (HIGH, barely above P2 - shallow upper line)
      [80, 1.09],
    ]);
    const found = detectRisingWedge(b, swingsOf(b));
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ patternId: 'rising_wedge', direction: 'BEARISH' });
  });

  it('finds a falling wedge (mirror image)', () => {
    const b = pathBars([
      [0, 1.095], // ascending lead-in, so P1 is a real local high
      [20, 1.105],
      [35, 1.095],
      [50, 1.098],
      [65, 1.092],
      [80, 1.11],
    ]);
    const found = detectFallingWedge(b, swingsOf(b));
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ patternId: 'falling_wedge', direction: 'BULLISH' });
  });
});

describe('detectAscendingChannel / detectDescendingChannel', () => {
  it('finds an ascending channel breaking down (channel_break)', () => {
    const b = pathBars([
      [0, 1.1], // descending lead-in, so P1 is a real local low
      [20, 1.095], // P1 (LOW)
      [35, 1.105], // P2 (HIGH)
      [50, 1.1], // P3 (LOW)
      [65, 1.11], // P4 (HIGH) - same slope as P1->P3 (parallel)
      [80, 1.09],
    ]);
    const found = detectAscendingChannel(b, swingsOf(b));
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ patternId: 'ascending_channel', direction: 'BEARISH' });
  });

  it('finds a descending channel breaking up (mirror image)', () => {
    const b = pathBars([
      [0, 1.095], // ascending lead-in, so P1 is a real local high
      [20, 1.105],
      [35, 1.095],
      [50, 1.1],
      [65, 1.09],
      [80, 1.11],
    ]);
    const found = detectDescendingChannel(b, swingsOf(b));
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ patternId: 'descending_channel', direction: 'BULLISH' });
  });
});

describe('detectRectangle', () => {
  it('finds a rectangle breaking out above the flat top', () => {
    const b = pathBars([
      [0, 1.095],
      [20, 1.105], // P1 (HIGH, top)
      [35, 1.095], // P2 (LOW, bottom)
      [50, 1.105], // P3 (HIGH, same top)
      [65, 1.095], // P4 (LOW, same bottom)
      [80, 1.13],
    ]);
    const found = detectRectangle(b, swingsOf(b));
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      patternId: 'rectangle',
      direction: 'BULLISH',
      confirmationRef: 1.1051,
    });
  });
});

describe('detectBroadening', () => {
  it('finds a broadening formation: each high higher, each low lower, then a close above the upper line', () => {
    const b = pathBars([
      [0, 1.095],
      [20, 1.1], // P1 (HIGH)
      [35, 1.097], // P2 (LOW)
      [50, 1.105], // P3 (HIGH, above P1)
      [65, 1.093], // P4 (LOW, below P2)
      [80, 1.11], // P5 (HIGH, above P3)
      [85, 1.105], // brief pullback so P5 is a real local high within its own confirmation window
      [95, 1.14],
    ]);
    const found = detectBroadening(b, swingsOf(b));
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ patternId: 'broadening', direction: 'BULLISH' });
    expect(found[0]!.pivots).toHaveLength(5);
  });
});

describe('no lookahead (all 9 line-based chart patterns together)', () => {
  it('cutting the data never changes an already-confirmed detection', () => {
    const w = randomWalk(1200, 83, 1.1, 10);
    const all = (bb: Bars) => {
      const s = detectSwings(bb, CHART_PIVOT_PARAMS);
      return [
        ...detectAscendingTriangle(bb, s),
        ...detectDescendingTriangle(bb, s),
        ...detectSymmetricalTriangle(bb, s),
        ...detectRisingWedge(bb, s),
        ...detectFallingWedge(bb, s),
        ...detectAscendingChannel(bb, s),
        ...detectDescendingChannel(bb, s),
        ...detectRectangle(bb, s),
        ...detectBroadening(bb, s),
      ];
    };
    const full = all(w);
    for (let k = 30; k <= w.length; k += 61) {
      const cut = all(sliceBars(w, k));
      expect(cut).toEqual(full.filter((d) => d.confirmedIndex < k));
    }
  });
});
