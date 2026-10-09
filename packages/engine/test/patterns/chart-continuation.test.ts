import { describe, expect, it } from 'vitest';
import type { Bars } from '../../src/features/bars';
import { sliceBars } from '../../src/features/bars';
import { detectSwings } from '../../src/features/swing';
import {
  detectBearFlag,
  detectBullFlag,
  detectPennant,
} from '../../src/patterns/chart-continuation';
import { CHART_PIVOT_PARAMS } from '../../src/patterns/chart-shared';
import { pathBars, randomWalk } from '../helpers/synthetic-bars';

function swingsOf(b: Bars) {
  return detectSwings(b, CHART_PIVOT_PARAMS);
}

describe('detectBullFlag / detectBearFlag', () => {
  it('finds a bull flag: a sharp pole, a shallow retracement, then a close above the flag line', () => {
    const b = pathBars([
      [0, 1.12],
      [10, 1.1], // P1 (LOW, pole start)
      [20, 1.14], // P2 (HIGH, pole end) - 400 pip pole over 10 bars
      [30, 1.125], // P3 (LOW, flag) - 150 pip retrace, well under half the pole
      [45, 1.16],
    ]);
    const found = detectBullFlag(b, swingsOf(b));
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ patternId: 'bull_flag', direction: 'BULLISH' });
  });

  it('does not fire when the flag retraces more than half the pole', () => {
    const b = pathBars([
      [0, 1.12],
      [10, 1.1],
      [20, 1.14],
      [30, 1.102], // almost a full retrace of the pole
      [45, 1.16],
    ]);
    expect(detectBullFlag(b, swingsOf(b))).toEqual([]);
  });

  it('finds a bear flag (mirror image)', () => {
    const b = pathBars([
      [0, 1.08],
      [10, 1.1],
      [20, 1.06],
      [30, 1.075],
      [45, 1.04],
    ]);
    const found = detectBearFlag(b, swingsOf(b));
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ patternId: 'bear_flag', direction: 'BEARISH' });
  });
});

describe('detectPennant', () => {
  it('finds a pennant: a pole, then a small narrowing triangle, breaking out in the pole direction', () => {
    const b = pathBars([
      [0, 1.12],
      [10, 1.1], // P1 (LOW, pole start)
      [20, 1.14], // P2 (HIGH, pole end)
      [30, 1.135], // P3 (LOW, tiny triangle)
      [40, 1.138], // P4 (HIGH, tiny triangle - below P2, narrowing)
      [45, 1.133], // brief pullback so P4 is a real local high
      [65, 1.18],
    ]);
    const found = detectPennant(b, swingsOf(b));
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ patternId: 'pennant', direction: 'BULLISH' });
    expect(found[0]!.pivots).toHaveLength(4);
  });

  it('does not fire when the "triangle" is not small relative to the pole', () => {
    const b = pathBars([
      [0, 1.12],
      [10, 1.1],
      [20, 1.14],
      [30, 1.11], // way more than half the pole's height
      [40, 1.138],
      [45, 1.112],
      [65, 1.18],
    ]);
    expect(detectPennant(b, swingsOf(b))).toEqual([]);
  });
});

describe('no lookahead (bull/bear flag + pennant together)', () => {
  it('cutting the data never changes an already-confirmed detection', () => {
    const w = randomWalk(1200, 97, 1.1, 12);
    const all = (bb: Bars) => {
      const s = detectSwings(bb, CHART_PIVOT_PARAMS);
      return [...detectBullFlag(bb, s), ...detectBearFlag(bb, s), ...detectPennant(bb, s)];
    };
    const full = all(w);
    for (let k = 20; k <= w.length; k += 47) {
      const cut = all(sliceBars(w, k));
      expect(cut).toEqual(full.filter((d) => d.confirmedIndex < k));
    }
  });
});
