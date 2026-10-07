import { describe, expect, it } from 'vitest';
import { sliceBars, type Bars } from '../src/features/bars';
import {
  atr,
  bollinger,
  diff,
  ema,
  lag,
  macd,
  movingMax,
  movingMin,
  movingSum,
  percentChange,
  rsi,
  sma,
  vwap,
  zscore,
} from '../src/features/indicators';
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

describe('macd', () => {
  it('matches a hand-computed line, signal and histogram', () => {
    // Straight +1-per-bar closes make the fast/slow EMA gap settle at a constant 1 (i >= 4).
    const b = closes([1, 2, 3, 4, 5, 6, 7]);
    const { line, signal, histogram } = macd(b, 3, 5, 2);
    expect(line).toEqual([null, null, null, null, 1, 1, 1]);
    expect(signal).toEqual([null, null, null, null, null, 1, 1]);
    expect(histogram).toEqual([null, null, null, null, null, 0, 0]);
  });
});

describe('bollinger', () => {
  it('matches a hand-computed mean and population standard deviation', () => {
    const b = closes([1, 1, 3, 3, 5]);
    const r = bollinger(b, 4, 2);
    // window [1,1,3,3]: mean 2, deviations ±1 -> variance 1 -> sd 1.
    expect(r.middle[3]).toBe(2);
    expect(r.upper[3]).toBe(4);
    expect(r.lower[3]).toBe(0);
    // window [1,3,3,5]: mean 3, variance 2 -> sd sqrt(2).
    expect(r.middle[4]).toBe(3);
    expect(r.upper[4]!).toBeCloseTo(3 + 2 * Math.sqrt(2));
    expect(r.lower[4]!).toBeCloseTo(3 - 2 * Math.sqrt(2));
  });
});

describe('vwap', () => {
  it('matches a hand-computed cumulative typical-price average', () => {
    const b = bars(
      [
        [9, 10, 8, 9],
        [10, 12, 10, 11],
        [9, 11, 9, 10],
      ],
      [2, 3, 5],
    );
    // typical prices 9, 11, 10; pv 18, 33, 50; cumvol 2, 5, 10.
    const v = vwap(b);
    expect(v[0]).toBe(9);
    expect(v[1]).toBe(10.2);
    expect(v[2]).toBe(10.1);
  });

  it('is null while no volume has been seen (honest "no data", never 0)', () => {
    const b = closes([1, 2, 3]); // the helper defaults volume to 0
    expect(vwap(b)).toEqual([null, null, null]);
  });
});

describe('moving min/max/sum', () => {
  it('matches hand values and is null until the window is full or has a null in it', () => {
    const v = [3, 1, 4, 1, 5, 9];
    expect(movingMin(v, 3)).toEqual([null, null, 1, 1, 1, 1]);
    expect(movingMax(v, 3)).toEqual([null, null, 4, 4, 5, 9]);
    expect(movingSum(v, 3)).toEqual([null, null, 8, 6, 10, 15]);

    const withGap = [1, null, 3, 4, 5];
    expect(movingSum(withGap, 2)).toEqual([null, null, null, 7, 9]);
  });
});

describe('lag', () => {
  it('shifts the series and carries a null forward', () => {
    expect(lag([10, 20, 30, 40], 2)).toEqual([null, null, 10, 20]);
    expect(lag([10, null, 30], 1)).toEqual([null, 10, null]);
  });
});

describe('diff and percentChange', () => {
  it('matches hand values and refuses to divide by zero', () => {
    expect(diff([10, 12, 9], 1)).toEqual([null, 2, -3]);
    expect(percentChange([10, 12, 9], 1)).toEqual([null, 20, -25]);
    expect(percentChange([0, 5], 1)).toEqual([null, null]); // was 0: null, not Infinity
  });
});

describe('zscore', () => {
  it('matches a hand-computed value and is null when the window has no spread', () => {
    // window [2,4,6]: mean 4, population sd 2*sqrt(2/3)... use round numbers instead:
    const v = [1, 1, 1, 4]; // window [1,1,4] at i=3: mean=2, variance=2, sd=sqrt(2)
    const z = zscore(v, 3);
    expect(z[2]).toBeNull(); // window [1,1,1]: sd 0
    expect(z[3]).toBeCloseTo((4 - 2) / Math.sqrt(2));
    expect(zscore([5, 5, 5], 3)[2]).toBeNull();
  });
});

describe('no lookahead', () => {
  const b = randomWalk(300, 11);
  const cases: [string, (b: Bars) => (number | null)[]][] = [
    ['sma', (x) => sma(x, 10)],
    ['ema', (x) => ema(x, 10)],
    ['rsi', (x) => rsi(x, 14)],
    ['atr', (x) => atr(x, 14)],
    ['macd.line', (x) => macd(x).line],
    ['macd.signal', (x) => macd(x).signal],
    ['bollinger.upper', (x) => bollinger(x).upper],
    ['vwap', (x) => vwap(x)],
    ['movingMin', (x) => movingMin(x.c, 10)],
    ['movingSum', (x) => movingSum(x.c, 10)],
    ['lag', (x) => lag(x.c, 5)],
    ['diff', (x) => diff(x.c, 3)],
    ['percentChange', (x) => percentChange(x.c, 3)],
    ['zscore', (x) => zscore(x.c, 10)],
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
