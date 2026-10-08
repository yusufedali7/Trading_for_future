import { describe, expect, it } from 'vitest';
import { sliceBars } from '../src/features/bars';
import { DISPLACEMENT_DEFAULTS, detectDisplacement } from '../src/features/displacement';
import { bars, randomWalk } from './helpers/synthetic-bars';

const P = { minBodyAtr: 1.5, atrPeriod: 5 };
// SYNTHETIC: 5 calm bars (TR ~0.2 pip), then a bar whose body is far larger.
const calm = Array.from({ length: 5 }, () => [1.1, 1.1002, 1.0999, 1.1001] as const);

describe('detectDisplacement (v1)', () => {
  it('fires when the body is far larger than the trailing average true range', () => {
    const b = bars([...calm, [1.1001, 1.1201, 1.1, 1.12]]); // body 0.0199 vs ~0.0003 avg TR
    const found = detectDisplacement(b, P);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      type: 'DISPLACEMENT',
      direction: 'BULLISH',
      formedIndex: 5,
      confirmedIndex: 5,
    });
  });

  it('does not fire on ordinary bars', () => {
    const b = bars(Array.from({ length: 10 }, () => [1.1, 1.1005, 1.0995, 1.1002] as const));
    expect(detectDisplacement(b, P)).toEqual([]);
  });

  it('direction follows the candle colour', () => {
    const bearish = bars([...calm, [1.12, 1.1201, 1.1, 1.1001]]);
    expect(detectDisplacement(bearish, P)[0]).toMatchObject({ direction: 'BEARISH' });
  });

  it('uses the default parameters when none are given', () => {
    const b = bars(Array.from({ length: 20 }, () => [1.1, 1.1005, 1.0995, 1.1002] as const));
    expect(detectDisplacement(b)).toEqual(detectDisplacement(b, DISPLACEMENT_DEFAULTS));
  });

  it('is truncation invariant: cutting the data never changes an already-confirmed detection', () => {
    const w = randomWalk(300, 7);
    const full = detectDisplacement(w);
    for (let k = 0; k <= w.length; k += 17) {
      const part = sliceBars(w, k);
      expect(detectDisplacement(part)).toEqual(full.filter((d) => d.confirmedIndex < k));
    }
  });
});
