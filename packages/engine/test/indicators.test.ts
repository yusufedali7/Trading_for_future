import { describe, expect, it } from 'vitest';
import { sliceBars } from '../src/features/bars';
import { atr, ema, rsi, sma } from '../src/features/indicators';
import { bars, randomWalk } from './helpers/synthetic-bars';

// SYNTHETIC: closes only (open/high/low mirror close unless noted).
const closes = (cs: readonly number[]) => bars(cs.map((c) => [c, c, c, c] as const));

describe('sma', () => {
  it('is null before the period fills, then the plain average', () => {
    const b = closes([1, 2, 3, 4, 5]);
    expect(sma(b, 3)).toEqual([null, null, 2, 3, 4]);
  });
});

describe('ema', () => {
  it('seeds with the SMA, then applies the smoothing weight', () => {
    const b = closes([1, 2, 3, 4, 5]);
    // k = 2/(3+1) = 0.5; seed = SMA(1,2,3) = 2.
    expect(ema(b, 3)).toEqual([null, null, 2, 3, 4]);
  });

  it('diverges from SMA on non-linear data (more weight on recent closes)', () => {
    const b = closes([1, 1, 1, 10, 1]);
    const e = ema(b, 3)[3]!;
    const s = sma(b, 3)[3]!;
    expect(e).toBeGreaterThan(s); // the EMA reacts more to the spike at i=3
  });
});

describe('rsi (Wilder)', () => {
  it('is 100 on an unbroken rise and 0 on an unbroken fall', () => {
    expect(rsi(closes([1, 2, 3, 4, 5]), 4)).toEqual([null, null, null, null, 100]);
    expect(rsi(closes([5, 4, 3, 2, 1]), 4)).toEqual([null, null, null, null, 0]);
  });

  it('matches a hand-computed value after the seed smooths', () => {
    // changes: +1,-1,+1 (period 2): seed at i=2 -> avgGain=avgLoss=0.5 -> RSI 50.
    // i=3: gain 1, loss 0 -> avgGain=0.75, avgLoss=0.25 -> RSI = 100 - 100/4 = 75.
    const r = rsi(closes([1, 2, 1, 2]), 2);
    expect(r[2]).toBe(50);
    expect(r[3]).toBe(75);
  });
});

describe('atr (Wilder)', () => {
  it('matches a hand-computed true range average', () => {
    const b = bars([
      [9, 10, 8, 9],
      [10, 11, 9, 10],
      [11, 12, 9, 11],
    ]);
    // TR0 = 10-8 = 2; TR1 = max(11-9, |11-9|, |9-9|) = 2; TR2 = max(12-9, |12-10|, |9-10|) = 3.
    const a = atr(b, 2);
    expect(a[0]).toBeNull();
    expect(a[1]).toBe(2); // seed: (TR0+TR1)/2
    expect(a[2]).toBe(2.5); // (2*(2-1)+3)/2
  });
});

describe('no lookahead', () => {
  const b = randomWalk(300, 11);
  const cases: [string, (b: typeof b) => (number | null)[]][] = [
    ['sma', (x) => sma(x, 10)],
    ['ema', (x) => ema(x, 10)],
    ['rsi', (x) => rsi(x, 14)],
    ['atr', (x) => atr(x, 14)],
  ];

  for (const [name, fn] of cases) {
    it(`${name}: cutting the data never changes an already-computed value`, () => {
      const full = fn(b);
      for (let k = 20; k <= b.length; k += 37) {
        const cut = fn(sliceBars(b, k));
        expect(cut).toEqual(full.slice(0, k));
      }
    });
  }
});
