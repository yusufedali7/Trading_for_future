import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { sliceBars } from '../../src/features/bars';
import {
  detect2Crows,
  detectBeltHold,
  detectClosingMarubozu,
  detectCounterattack,
  detectDarkCloudCover,
  detectDoji,
  detectDojiStar,
  detectDragonflyDoji,
  detectEngulfing,
  detectGravestoneDoji,
  detectHarami,
  detectHaramiCross,
  detectHighWave,
  detectHomingPigeon,
  detectKicking,
  detectKickingByLength,
  detectLongLeggedDoji,
  detectLongLine,
  detectMarubozu,
  detectMatchingLow,
  detectPiercing,
  detectRickshawMan,
  detectSeparatingLines,
  detectShortLine,
  detectSpinningTop,
  detectStickSandwich,
  detectUpsideGap2Crows,
} from '../../src/patterns/candlestick';
import { bars, randomWalk } from '../helpers/synthetic-bars';

// SYNTHETIC: ten calm 1-pip-range bars, used as trailing history for the threshold settings.
const FILLER = Array.from({ length: 10 }, () => [1.1, 1.1005, 1.0995, 1.1002] as const);

describe('detectBeltHold', () => {
  it('finds a long bullish body with no lower shadow', () => {
    const b = bars([...FILLER, [1.1, 1.13, 1.1, 1.1295]]); // open === low
    const found = detectBeltHold(b);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ patternId: 'cdlbelthold', direction: 'BULLISH' });
  });

  it('does not fire when the entry-side shadow is present', () => {
    const b = bars([...FILLER, [1.1, 1.13, 1.095, 1.1295]]); // 5 pip lower shadow
    expect(detectBeltHold(b)).toEqual([]);
  });
});

describe('detectClosingMarubozu', () => {
  it('finds a long bearish body with no upper shadow (close === high is impossible when bearish, so close === open side)', () => {
    const b = bars([...FILLER, [1.13, 1.13, 1.1, 1.1]]); // black, close === low (no lower shadow)
    const found = detectClosingMarubozu(b);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ patternId: 'cdlclosingmarubozu', direction: 'BEARISH' });
  });
});

describe('detectSpinningTop', () => {
  it('finds a tiny body with both shadows longer than it', () => {
    const b = bars([...FILLER, [1.1, 1.101, 1.099, 1.10005]]);
    const found = detectSpinningTop(b);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ patternId: 'cdlspinningtop', direction: 'BULLISH' });
  });
});

describe('detectHighWave', () => {
  it('finds a tiny body with both shadows very long relative to that same tiny body', () => {
    const b = bars([...FILLER, [1.1, 1.101, 1.099, 1.10005]]);
    const found = detectHighWave(b);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ patternId: 'cdlhighwave' });
  });
});

describe('detectShortLine', () => {
  it('finds a short body with both shadows short', () => {
    const b = bars([...FILLER, [1.1, 1.1001, 1.0999, 1.10005]]);
    const found = detectShortLine(b);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ patternId: 'cdlshortline', direction: 'BULLISH' });
  });
});

describe('detectLongLine', () => {
  it('finds a long body with both shadows short', () => {
    const b = bars([...FILLER, [1.1, 1.1301, 1.0999, 1.13]]);
    const found = detectLongLine(b);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ patternId: 'cdllongline', direction: 'BULLISH' });
  });

  it('does not fire when a shadow is not short', () => {
    const b = bars([...FILLER, [1.1, 1.135, 1.0999, 1.13]]); // 5 pip upper shadow
    expect(detectLongLine(b)).toEqual([]);
  });
});

describe('detectGravestoneDoji', () => {
  it('finds a doji with no lower shadow and a long upper shadow', () => {
    const b = bars([...FILLER, [1.1, 1.13, 1.0999, 1.10002]]);
    const found = detectGravestoneDoji(b);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ patternId: 'cdlgravestonedoji', direction: null });
  });
});

describe('detectDragonflyDoji', () => {
  it('finds a doji with no upper shadow and a long lower shadow', () => {
    const b = bars([...FILLER, [1.1, 1.10012, 1.07, 1.10002]]);
    const found = detectDragonflyDoji(b);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ patternId: 'cdldragonflydoji', direction: null });
  });
});

describe('detectLongLeggedDoji', () => {
  it('finds a doji with a shadow longer than its own tiny body', () => {
    const b = bars([...FILLER, [1.1, 1.13, 1.09, 1.10002]]);
    const found = detectLongLeggedDoji(b);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ patternId: 'cdllongleggeddoji', direction: null });
  });
});

describe('detectRickshawMan', () => {
  it('finds a doji with both shadows long, body near the middle of the range', () => {
    const b = bars([...FILLER, [1.1, 1.2, 1.0, 1.10002]]); // mid = 1.1, body 1.1-1.10002
    const found = detectRickshawMan(b);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ patternId: 'cdlrickshawman', direction: null });
  });
});

describe('detectHarami', () => {
  it('finds a short body fully inside the prior long body', () => {
    const b = bars([...FILLER, [1.1, 1.131, 1.099, 1.13], [1.11, 1.1102, 1.1098, 1.1101]]);
    const found = detectHarami(b);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ patternId: 'cdlharami', direction: 'BEARISH' });
  });
});

describe('detectHaramiCross', () => {
  it('finds a doji fully inside the prior long body', () => {
    const b = bars([...FILLER, [1.1, 1.131, 1.099, 1.13], [1.115, 1.1151, 1.1149, 1.11502]]);
    const found = detectHaramiCross(b);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ patternId: 'cdlharamicross', direction: 'BEARISH' });
  });
});

describe('detectDojiStar', () => {
  it('finds a doji that gaps away from a prior long body', () => {
    const b = bars([...FILLER, [1.1, 1.131, 1.099, 1.13], [1.14, 1.1402, 1.1398, 1.14002]]);
    const found = detectDojiStar(b);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ patternId: 'cdldojistar', direction: 'BEARISH' });
  });
});

describe('detectMatchingLow', () => {
  it('finds two bearish bars closing at (within tolerance) the same price', () => {
    const b = bars([...FILLER, [1.11, 1.111, 1.099, 1.1], [1.105, 1.106, 1.095, 1.10003]]);
    const found = detectMatchingLow(b);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ patternId: 'cdlmatchinglow', direction: 'BULLISH' });
  });
});

describe('detectCounterattack', () => {
  it('finds two opposite long bodies closing at (within tolerance) the same price', () => {
    const b = bars([...FILLER, [1.1, 1.131, 1.099, 1.13], [1.15, 1.151, 1.129, 1.13003]]);
    const found = detectCounterattack(b);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ patternId: 'cdlcounterattack', direction: 'BEARISH' });
  });
});

describe('detectSeparatingLines', () => {
  it('finds two opposite bars opening at (within tolerance) the same price, the second a belt-hold', () => {
    const b = bars([...FILLER, [1.11, 1.111, 1.079, 1.08], [1.11003, 1.14, 1.11003, 1.14]]);
    const found = detectSeparatingLines(b);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ patternId: 'cdlseparatinglines', direction: 'BULLISH' });
  });
});

describe('detectKicking / detectKickingByLength', () => {
  it('finds two opposite marubozu bars with a gap between them', () => {
    const b = bars([...FILLER, [1.13, 1.13, 1.1, 1.1], [1.2, 1.25, 1.2, 1.25]]);
    const found = detectKicking(b);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ patternId: 'cdlkicking', direction: 'BULLISH' });
  });

  it('kicking-by-length picks the direction of the longer-bodied marubozu', () => {
    const b = bars([
      ...FILLER,
      [1.2, 1.21, 1.2, 1.21], // 1st: bullish marubozu, body 0.01
      [1.15, 1.15, 1.1, 1.1], // 2nd: bearish marubozu, body 0.05, gapped down, longer
    ]);
    const found = detectKickingByLength(b);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ patternId: 'cdlkickingbylength', direction: 'BEARISH' });
  });
});

describe('detectPiercing', () => {
  it('finds a long black bar then a long white bar closing past its midpoint', () => {
    const b = bars([...FILLER, [1.13, 1.131, 1.099, 1.1], [1.095, 1.121, 1.094, 1.12]]);
    const found = detectPiercing(b);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ patternId: 'cdlpiercing', direction: 'BULLISH' });
  });
});

describe('detectDarkCloudCover', () => {
  it('finds a long white bar then a black bar closing past its midpoint', () => {
    const b = bars([...FILLER, [1.1, 1.131, 1.099, 1.13], [1.135, 1.136, 1.109, 1.11]]);
    const found = detectDarkCloudCover(b);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ patternId: 'cdldarkcloudcover', direction: 'BEARISH' });
  });
});

describe('detectHomingPigeon', () => {
  it('finds a long black bar then a short black bar inside its open-close range', () => {
    const b = bars([...FILLER, [1.13, 1.131, 1.099, 1.1], [1.1125, 1.1126, 1.1123, 1.1124]]);
    const found = detectHomingPigeon(b);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ patternId: 'cdlhomingpigeon', direction: 'BULLISH' });
  });
});

describe('detectStickSandwich', () => {
  it('finds black, white, black with the 1st and 3rd closing at (within tolerance) the same price', () => {
    const b = bars([
      ...FILLER,
      [1.12, 1.121, 1.099, 1.1],
      [1.102, 1.131, 1.101, 1.13],
      [1.125, 1.126, 1.099, 1.10003],
    ]);
    const found = detectStickSandwich(b);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ patternId: 'cdlsticksandwich', direction: 'BULLISH' });
  });
});

describe('detectUpsideGap2Crows', () => {
  it('finds a white bar, a short black bar gapping up, then a black bar closing above the 1st', () => {
    const b = bars([
      ...FILLER,
      [1.1, 1.131, 1.099, 1.13],
      [1.14, 1.1401, 1.13985, 1.13985],
      [1.141, 1.1415, 1.1345, 1.135],
    ]);
    const found = detectUpsideGap2Crows(b);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ patternId: 'cdlupsidegap2crows', direction: 'BEARISH' });
  });
});

describe('detect2Crows', () => {
  it('finds a white bar, a black bar gapping up, then a black bar closing inside the 1st', () => {
    const b = bars([
      ...FILLER,
      [1.1, 1.131, 1.099, 1.13],
      [1.14, 1.141, 1.1345, 1.135],
      [1.137, 1.138, 1.114, 1.115],
    ]);
    const found = detect2Crows(b);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ patternId: 'cdl2crows', direction: 'BEARISH' });
  });
});

describe('no lookahead (all new detectors together)', () => {
  it('cutting the data never changes an already-confirmed detection', () => {
    const w = randomWalk(400, 29);
    const all = (bb: ReturnType<typeof sliceBars>) => [
      ...detectDoji(bb),
      ...detectEngulfing(bb),
      ...detectMarubozu(bb),
      ...detectBeltHold(bb),
      ...detectClosingMarubozu(bb),
      ...detectSpinningTop(bb),
      ...detectHighWave(bb),
      ...detectShortLine(bb),
      ...detectLongLine(bb),
      ...detectGravestoneDoji(bb),
      ...detectDragonflyDoji(bb),
      ...detectLongLeggedDoji(bb),
      ...detectRickshawMan(bb),
      ...detectHarami(bb),
      ...detectHaramiCross(bb),
      ...detectDojiStar(bb),
      ...detectMatchingLow(bb),
      ...detectCounterattack(bb),
      ...detectSeparatingLines(bb),
      ...detectKicking(bb),
      ...detectKickingByLength(bb),
      ...detectPiercing(bb),
      ...detectDarkCloudCover(bb),
      ...detectHomingPigeon(bb),
      ...detectStickSandwich(bb),
      ...detectUpsideGap2Crows(bb),
      ...detect2Crows(bb),
    ];
    const full = all(w);
    expect(full.length).toBeGreaterThan(0);
    for (let k = 20; k <= w.length; k += 31) {
      const cut = all(sliceBars(w, k));
      expect(cut).toEqual(full.filter((d) => d.confirmedIndex < k));
    }
  });
});

/**
 * TA-Lib oracle (tools/oracle/talib_candles.py) for the patterns that happen to fire somewhere
 * in the small SYNTHETIC fixture. The other 14 new patterns need more specific multi-candle
 * setups (gaps, matching closes) that this 85-bar fixture does not happen to contain - those are
 * covered instead by the hand-written tests above and by a real 736,706-bar EURUSD 1m
 * cross-check against the actually-installed TA-Lib (not committed; see docs/PLAN-M9.md), which
 * found an exact match on every one of the 24 new patterns except for ~0.3% of CDLMATCHINGLOW/
 * CDLSEPARATINGLINES/CDLSTICKSANDWICH detections - a floating-point tie-breaking difference at
 * the "equal price" tolerance (roughly 1e-16 relative error), not a logic error (see the module
 * doc in candle-classify.ts and PLAN-M9.md for detail).
 */
describe('TA-Lib oracle (tools/oracle/talib_candles.py)', () => {
  const fixture = JSON.parse(
    readFileSync(join(__dirname, '../fixtures/SYNTHETIC_candlestick_oracle.json'), 'utf-8'),
  ) as { ohlc: [number, number, number, number][]; oracle: Record<string, number[]> };
  const b = bars(fixture.ohlc.map((x) => [x[0], x[1], x[2], x[3]] as const));

  const bySign = (oracle: number[]) =>
    oracle.map((v) => (v > 0 ? 'BULLISH' : v < 0 ? 'BEARISH' : 'NONE'));
  const atIndex = (
    detections: { confirmedIndex: number; direction: string | null }[],
    n: number,
  ) => {
    const out: (string | null)[] = new Array(n).fill('NONE');
    for (const d of detections) out[d.confirmedIndex] = d.direction;
    return out;
  };

  const directional: [string, () => ReturnType<typeof detectDoji>][] = [
    ['CDLBELTHOLD', () => detectBeltHold(b)],
    ['CDLCLOSINGMARUBOZU', () => detectClosingMarubozu(b)],
    ['CDLSPINNINGTOP', () => detectSpinningTop(b)],
    ['CDLHIGHWAVE', () => detectHighWave(b)],
    ['CDLSHORTLINE', () => detectShortLine(b)],
    ['CDLLONGLINE', () => detectLongLine(b)],
    ['CDLHARAMI', () => detectHarami(b)],
  ];

  it.each(directional)(
    '%s: same bars and direction as the recorded TA-Lib run',
    (oracleKey, fn) => {
      expect(atIndex(fn(), b.length)).toEqual(bySign(fixture.oracle[oracleKey]!));
    },
  );

  // TA-Lib always outputs a flat +100 for these (no real direction, like CDLDOJI); we record
  // `direction: null`, so only presence is compared here.
  const directionless: [string, () => ReturnType<typeof detectDoji>][] = [
    ['CDLLONGLEGGEDDOJI', () => detectLongLeggedDoji(b)],
    ['CDLRICKSHAWMAN', () => detectRickshawMan(b)],
  ];

  it.each(directionless)(
    '%s: detected at the same bars as the recorded TA-Lib run',
    (oracleKey, fn) => {
      const want = fixture.oracle[oracleKey]!.map((v) => v !== 0);
      const got = atIndex(fn(), b.length).map((x) => x !== 'NONE');
      expect(got).toEqual(want);
    },
  );
});
