import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { sliceBars } from '../../src/features/bars';
import { detectDoji, detectEngulfing, detectMarubozu } from '../../src/patterns/candlestick';
import { bars } from '../helpers/synthetic-bars';

describe('detectDoji', () => {
  it('finds a tiny body inside an ordinary range, not a normal candle', () => {
    // SYNTHETIC: 10 bars of ~5 pip bodies, then a near-flat 11th bar (body 0.2 pip, range 12 pip).
    const b = bars([
      [1.1, 1.1005, 1.0998, 1.1004],
      [1.1004, 1.1009, 1.0999, 1.1003],
      [1.1003, 1.1008, 1.0998, 1.1002],
      [1.1002, 1.1007, 1.0997, 1.1001],
      [1.1001, 1.1006, 1.0996, 1.1],
      [1.1, 1.1005, 1.0995, 1.1004],
      [1.1004, 1.1009, 1.0999, 1.1003],
      [1.1003, 1.1008, 1.0998, 1.1002],
      [1.1002, 1.1007, 1.0997, 1.1006],
      [1.1006, 1.1011, 1.0998, 1.1001],
      [1.1001, 1.1061, 1.0941, 1.10012], // doji: body 0.00002, range 0.012
    ]);
    const found = detectDoji(b);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      patternId: 'cdldoji',
      direction: null,
      formedIndex: 10,
      confirmedIndex: 10,
    });
  });

  it('does not fire on an ordinary-bodied candle', () => {
    const b = bars(Array.from({ length: 11 }, () => [1.1, 1.1005, 1.0995, 1.1004] as const));
    expect(detectDoji(b)).toEqual([]);
  });
});

describe('detectMarubozu', () => {
  it('finds a long body with no shadows, with direction', () => {
    const filler = Array.from({ length: 10 }, () => [1.1, 1.1005, 1.0995, 1.1003] as const);
    const b = bars([...filler, [1.1, 1.103, 1.1, 1.103]]); // bullish, 30 pip, zero shadows
    const found = detectMarubozu(b);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ patternId: 'cdlmarubozu', direction: 'BULLISH' });
  });

  it('does not fire when the body is long but shadows are present', () => {
    const filler = Array.from({ length: 10 }, () => [1.1, 1.1005, 1.0995, 1.1003] as const);
    const b = bars([...filler, [1.1, 1.104, 1.099, 1.103]]); // 30 pip body, 10 pip top shadow
    expect(detectMarubozu(b)).toEqual([]);
  });
});

describe('detectEngulfing', () => {
  it('finds a bearish engulfing (small bullish candle, then a larger bearish one)', () => {
    const b = bars([
      [1.101, 1.1012, 1.1005, 1.1015], // bullish, body 1.101-1.1015
      [1.1017, 1.1019, 1.1003, 1.1005], // bearish, body 1.1005-1.1017, strictly engulfs
    ]);
    const found = detectEngulfing(b);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      patternId: 'cdlengulfing',
      direction: 'BEARISH',
      formedIndex: 0,
      confirmedIndex: 1,
    });
  });

  it('does not fire on same-coloured candles or a body that does not cover the first', () => {
    const sameColor = bars([
      [1.101, 1.1012, 1.1005, 1.1015],
      [1.1005, 1.1025, 1.1003, 1.102],
    ]);
    expect(detectEngulfing(sameColor)).toEqual([]);

    const tooSmall = bars([
      [1.101, 1.1012, 1.1005, 1.1015],
      [1.1012, 1.1013, 1.1008, 1.1011], // bearish but does not cover the first body
    ]);
    expect(detectEngulfing(tooSmall)).toEqual([]);
  });
});

describe('no lookahead', () => {
  it('cutting the data never changes an already-confirmed detection', () => {
    const b = bars(
      Array.from({ length: 60 }, (_, i) => {
        const base = 1.1 + 0.0003 * Math.sin(i / 3);
        return [
          base,
          base + 0.0008,
          base - 0.0008,
          base + (i % 7 === 0 ? 0.00001 : 0.0002),
        ] as const;
      }),
    );
    const full = [...detectDoji(b), ...detectMarubozu(b), ...detectEngulfing(b)];
    for (let k = 20; k <= b.length; k += 13) {
      const cut = [
        ...detectDoji(sliceBars(b, k)),
        ...detectMarubozu(sliceBars(b, k)),
        ...detectEngulfing(sliceBars(b, k)),
      ];
      const stillKnown = full.filter((d) => d.confirmedIndex < k);
      expect(cut).toEqual(stillKnown);
    }
  });
});

describe('TA-Lib oracle (tools/oracle/talib_candles.py)', () => {
  const fixture = JSON.parse(
    readFileSync(join(__dirname, '../fixtures/SYNTHETIC_candlestick_oracle.json'), 'utf-8'),
  ) as { ohlc: [number, number, number, number][]; oracle: Record<string, number[]> };
  const b = bars(fixture.ohlc.map((x) => [x[0], x[1], x[2], x[3]] as const));

  const bySign = (oracle: number[]) =>
    oracle.map((v) => (v > 0 ? 'BULLISH' : v < 0 ? 'BEARISH' : 'NONE'));
  /** 'NONE' for "not detected", distinct from a legitimate null direction (e.g. doji). */
  const atIndex = (
    detections: { confirmedIndex: number; direction: string | null }[],
    n: number,
  ) => {
    const out: (string | null)[] = new Array(n).fill('NONE');
    for (const d of detections) out[d.confirmedIndex] = d.direction;
    return out;
  };

  it('CDLDOJI: detected at the same bars as the recorded TA-Lib run', () => {
    const want = fixture.oracle.CDLDOJI!.map((v) => v !== 0);
    const got = atIndex(detectDoji(b), b.length).map((x) => x !== 'NONE');
    expect(got).toEqual(want);
  });

  it('CDLMARUBOZU: same bars and direction as the recorded TA-Lib run', () => {
    expect(atIndex(detectMarubozu(b), b.length)).toEqual(bySign(fixture.oracle.CDLMARUBOZU!));
  });

  it('CDLENGULFING: same bars and direction as the recorded TA-Lib run (±80 and ±100 both count)', () => {
    expect(atIndex(detectEngulfing(b), b.length)).toEqual(bySign(fixture.oracle.CDLENGULFING!));
  });
});
