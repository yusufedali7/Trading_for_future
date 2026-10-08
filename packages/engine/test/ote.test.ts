import { describe, expect, it } from 'vitest';
import { sliceBars } from '../src/features/bars';
import { detectOte } from '../src/features/ote';
import { detectSwings } from '../src/features/swing';
import type { Swing } from '../src/features/types';
import { randomWalk } from './helpers/synthetic-bars';

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

describe('detectOte (v1)', () => {
  it('zones a bullish impulse (LOW then HIGH) as a retracement down from the high', () => {
    const low = fakeSwing('LOW', 9.0, 0);
    const high = fakeSwing('HIGH', 11.0, 2);
    const found = detectOte([low, high]);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      type: 'OTE',
      direction: 'BULLISH',
      top: 11.0 - 0.62 * 2.0,
      bottom: 11.0 - 0.79 * 2.0,
      sweetSpot: 11.0 - 0.705 * 2.0,
      startSwingId: low.id,
      endSwingId: high.id,
      confirmedIndex: high.confirmedIndex,
    });
  });

  it('zones a bearish impulse (HIGH then LOW) as a retracement up from the low', () => {
    const high = fakeSwing('HIGH', 11.0, 0);
    const low = fakeSwing('LOW', 8.0, 2);
    const found = detectOte([high, low]);
    expect(found[0]).toMatchObject({
      direction: 'BEARISH',
      top: 8.0 + 0.79 * 3.0,
      bottom: 8.0 + 0.62 * 3.0,
    });
  });

  it('skips consecutive swings of the same kind', () => {
    const a = fakeSwing('HIGH', 11.0, 0);
    const b = fakeSwing('HIGH', 11.5, 2);
    expect(detectOte([a, b])).toEqual([]);
  });

  it('is truncation invariant', () => {
    const w = randomWalk(300, 19);
    const swings = detectSwings(w);
    const full = detectOte(swings);
    for (let k = 0; k <= w.length; k += 23) {
      const partSwings = detectSwings(sliceBars(w, k));
      expect(detectOte(partSwings)).toEqual(full.filter((z) => z.confirmedIndex < k));
    }
  });
});
