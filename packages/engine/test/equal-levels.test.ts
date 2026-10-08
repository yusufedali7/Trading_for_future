import { describe, expect, it } from 'vitest';
import { sliceBars } from '../src/features/bars';
import { detectEqualLevels } from '../src/features/equal-levels';
import { detectSwings } from '../src/features/swing';
import { bars, randomWalk } from './helpers/synthetic-bars';

const swingP = { left: 1, right: 1 };
const P = { toleranceAtr: 0.1, atrPeriod: 2 }; // small atrPeriod so the tiny fixture has history

// SYNTHETIC: two swing highs close together (10.50 then 10.52), separated by a valley.
const b = bars([
  [10, 10.0, 9.9, 10.0],
  [10, 10.5, 9.9, 10.1], // swing high 10.50, confirmed@2
  [10, 10.0, 9.9, 10.0],
  [10, 10.52, 9.9, 10.1], // swing high 10.52, confirmed@4
  [10, 10.0, 9.9, 10.0],
]);

describe('detectEqualLevels (v1)', () => {
  it('pairs two confirmed swing highs within tolerance', () => {
    const swings = detectSwings(b, swingP);
    expect(swings).toHaveLength(2);
    const found = detectEqualLevels(b, swings, P);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      type: 'EQUAL_LEVELS',
      side: 'HIGH',
      price: (10.5 + 10.52) / 2,
      swingIds: [swings[0]!.id, swings[1]!.id],
      formedIndex: swings[0]!.formedIndex,
      confirmedIndex: swings[1]!.confirmedIndex,
    });
  });

  it('does not pair swings far apart in price', () => {
    const far = bars([
      [10, 10.0, 9.9, 10.0],
      [10, 10.5, 9.9, 10.1],
      [10, 10.0, 9.9, 10.0],
      [10, 11.5, 9.9, 10.1], // nowhere near 10.5
      [10, 10.0, 9.9, 10.0],
    ]);
    const swings = detectSwings(far, swingP);
    expect(detectEqualLevels(far, swings, P)).toEqual([]);
  });

  it('is truncation invariant', () => {
    const w = randomWalk(300, 13);
    const swings = detectSwings(w);
    const full = detectEqualLevels(w, swings);
    for (let k = 0; k <= w.length; k += 23) {
      const part = sliceBars(w, k);
      const partSwings = detectSwings(part);
      expect(detectEqualLevels(part, partSwings)).toEqual(full.filter((d) => d.confirmedIndex < k));
    }
  });
});
