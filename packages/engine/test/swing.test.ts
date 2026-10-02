import { describe, expect, it } from 'vitest';
import { sliceBars } from '../src/features/bars';
import { detectSwings } from '../src/features/swing';
import { BAR_MS, T0, hl, randomWalk } from './helpers/synthetic-bars';

describe('detectSwings (v1)', () => {
  it('finds a high and a low and confirms them `right` bars later', () => {
    // SYNTHETIC: bar 3 is the highest, bar 7 the lowest.
    const b = hl([
      [10, 8],
      [11, 9],
      [12, 10],
      [15, 11],
      [13, 10],
      [12, 9],
      [11, 7],
      [10, 5],
      [11, 6],
      [12, 7],
      [13, 8],
    ]);
    const s = detectSwings(b, { left: 2, right: 2 });
    expect(s.map((x) => [x.kind, x.formedIndex, x.price, x.confirmedIndex])).toEqual([
      ['HIGH', 3, 15, 5],
      ['LOW', 7, 5, 9],
    ]);
    expect(s[0]).toMatchObject({
      formedAt: T0 + 3 * BAR_MS,
      confirmedAt: T0 + 6 * BAR_MS, // close of bar 5
      defVersion: 'v1',
      id: `SWING:v1:2-2:HIGH:${T0 + 3 * BAR_MS}`,
    });
  });

  it('takes the first of equal highs and needs strictly lower bars on the left', () => {
    const b = hl([
      [10, 9],
      [12, 9],
      [12, 9],
      [11, 9],
      [10, 9],
    ]);
    const highs = detectSwings(b, { left: 1, right: 2 }).filter((x) => x.kind === 'HIGH');
    expect(highs.map((x) => x.formedIndex)).toEqual([1]);
  });

  it('never reports a swing without `left` bars before and `right` bars after it', () => {
    const b = hl([
      [20, 1],
      [10, 5],
      [11, 6],
    ]);
    expect(detectSwings(b, { left: 1, right: 1 })).toEqual([]);
    expect(() => detectSwings(b, { left: 0, right: 1 })).toThrow();
  });

  it('is truncation invariant: cutting the data never changes earlier detections', () => {
    const b = randomWalk(300);
    const full = detectSwings(b);
    expect(full.length).toBeGreaterThan(20);
    for (let k = 0; k <= b.length; k++) {
      const known = full.filter((x) => x.confirmedIndex < k);
      expect(detectSwings(sliceBars(b, k))).toEqual(known);
    }
  });
});
