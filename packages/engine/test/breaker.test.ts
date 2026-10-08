import { describe, expect, it } from 'vitest';
import { detectBreakers } from '../src/features/breaker';
import { sliceBars } from '../src/features/bars';
import type { OrderBlock } from '../src/features/types';
import { bars, randomWalk } from './helpers/synthetic-bars';

const BAR_MS = 15 * 60_000;
const T0 = Date.parse('2026-01-06T08:00:00Z');

function fakeOrderBlock(direction: 'BULLISH' | 'BEARISH', top: number, bottom: number): OrderBlock {
  return {
    id: 'ORDER_BLOCK:fake',
    defVersion: 'v1',
    type: 'ORDER_BLOCK',
    direction,
    top,
    bottom,
    breakId: 'STRUCTURE_BREAK:fake',
    formedAt: T0,
    formedIndex: 0,
    confirmedAt: T0 + BAR_MS,
    confirmedIndex: 0,
  };
}

describe('detectBreakers (v1)', () => {
  // SYNTHETIC: a bullish order block [bottom 9.6, top 10.0]; bar2 closes fully below it.
  const b = bars([
    [10.0, 10.1, 9.9, 10.0],
    [10.0, 10.1, 9.9, 10.0],
    [9.4, 9.5, 9.3, 9.4], // closes below 9.6 -> invalidates
  ]);

  it('fires when a later close fully crosses the far edge, flipping direction', () => {
    const ob = fakeOrderBlock('BULLISH', 10.0, 9.6);
    const found = detectBreakers(b, [ob]);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      type: 'BREAKER',
      direction: 'BEARISH',
      top: 10.0,
      bottom: 9.6,
      sourceOrderBlockId: ob.id,
      confirmedIndex: 2,
    });
  });

  it('does not fire while the zone has not been closed through yet', () => {
    const ob = fakeOrderBlock('BULLISH', 10.0, 9.6);
    expect(detectBreakers(sliceBars(b, 2), [ob])).toEqual([]);
  });

  it('is truncation invariant', () => {
    const w = randomWalk(200, 23);
    // A handful of fake order blocks spread across the series, both directions.
    const obs: OrderBlock[] = [20, 60, 100, 140].map((i, k) =>
      fakeOrderBlock(k % 2 === 0 ? 'BULLISH' : 'BEARISH', w.h[i]!, w.l[i]!),
    );
    const full = detectBreakers(w, obs);
    for (let k = 0; k <= w.length; k += 17) {
      expect(detectBreakers(sliceBars(w, k), obs)).toEqual(
        full.filter((d) => d.confirmedIndex < k),
      );
    }
  });
});
