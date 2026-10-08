import { describe, expect, it } from 'vitest';
import { sliceBars } from '../src/features/bars';
import { detectPremiumDiscount } from '../src/features/premium-discount';
import { detectSwings } from '../src/features/swing';
import type { Swing } from '../src/features/types';
import { randomWalk } from './helpers/synthetic-bars';

const BAR_MS = 15 * 60_000;
const T0 = Date.parse('2026-01-06T08:00:00Z');

function fakeSwing(kind: 'HIGH' | 'LOW', price: number, confirmedIndex: number): Swing {
  return {
    id: `SWING:fake:${kind}:${price}`,
    defVersion: 'v1',
    type: 'SWING',
    kind,
    price,
    formedAt: T0 + (confirmedIndex - 1) * BAR_MS,
    formedIndex: confirmedIndex - 1,
    confirmedAt: T0 + confirmedIndex * BAR_MS,
    confirmedIndex,
  };
}

describe('detectPremiumDiscount (v1)', () => {
  it('emits a new zone every time the reference high or low changes', () => {
    const swings = [
      fakeSwing('LOW', 9.0, 1),
      fakeSwing('HIGH', 11.0, 3),
      fakeSwing('LOW', 9.5, 5),
      fakeSwing('HIGH', 12.0, 7),
    ];
    const found = detectPremiumDiscount(swings);
    expect(found.map((z) => [z.top, z.bottom, z.equilibrium, z.confirmedIndex])).toEqual([
      [11.0, 9.0, 10.0, 3],
      [11.0, 9.5, 10.25, 5],
      [12.0, 9.5, 10.75, 7],
    ]);
  });

  it('produces nothing until both a high and a low are confirmed', () => {
    expect(detectPremiumDiscount([fakeSwing('HIGH', 11.0, 3)])).toEqual([]);
  });

  it('is truncation invariant', () => {
    const w = randomWalk(300, 17);
    const swings = detectSwings(w);
    const full = detectPremiumDiscount(swings);
    for (let k = 0; k <= w.length; k += 23) {
      const partSwings = detectSwings(sliceBars(w, k));
      expect(detectPremiumDiscount(partSwings)).toEqual(full.filter((z) => z.confirmedIndex < k));
    }
  });
});
