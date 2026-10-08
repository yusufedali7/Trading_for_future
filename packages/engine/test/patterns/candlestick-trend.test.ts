import { describe, expect, it } from 'vitest';
import { sliceBars } from '../../src/features/bars';
import {
  detect3BlackCrows,
  detect3Inside,
  detect3LineStrike,
  detect3Outside,
  detect3StarsInSouth,
  detect3WhiteSoldiers,
  detectAbandonedBaby,
  detectAdvanceBlock,
  detectBreakaway,
  detectConcealingBabySwallow,
  detectEveningDojiStar,
  detectEveningStar,
  detectGapSideSideWhite,
  detectHammer,
  detectHangingMan,
  detectHikkake,
  detectHikkakeMod,
  detectIdentical3Crows,
  detectInNeck,
  detectInvertedHammer,
  detectLadderBottom,
  detectMatHold,
  detectMorningDojiStar,
  detectMorningStar,
  detectOnNeck,
  detectRiseFall3Methods,
  detectShootingStar,
  detectStalledPattern,
  detectTakuri,
  detectTasukiGap,
  detectThrusting,
  detectTriStar,
  detectUnique3River,
  detectXSideGap3Methods,
} from '../../src/patterns/candlestick-trend';
import { bars, randomWalk } from '../helpers/synthetic-bars';

// SYNTHETIC: ten calm 1-pip-range bars, used as trailing history for the threshold settings.
const FILLER = Array.from({ length: 10 }, () => [1.1, 1.1005, 1.0995, 1.1002] as const);

describe('detectHammer', () => {
  it('small body near the prior low, long lower shadow, tiny upper shadow', () => {
    // Filler's last low is 1.0995; the body sits within the "near" tolerance of it.
    const b = bars([...FILLER, [1.0996, 1.0997, 1.095, 1.09965]]);
    const found = detectHammer(b);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ patternId: 'cdlhammer', direction: 'BULLISH' });
  });
});

describe('detectHangingMan', () => {
  it('the same shape as a hammer, but near the prior high (TA-Lib does not judge the trend)', () => {
    // Filler's last high is 1.1005; the body sits within the "near" tolerance of it.
    const b = bars([...FILLER, [1.1004, 1.1005, 1.098, 1.10045]]);
    const found = detectHangingMan(b);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ patternId: 'cdlhangingman', direction: 'BEARISH' });
  });
});

describe('detectShootingStar / detectInvertedHammer', () => {
  it('shooting star: gaps up, small body, long upper shadow, tiny lower shadow', () => {
    const b = bars([...FILLER, [1.14, 1.1702, 1.13995, 1.14005]]);
    const found = detectShootingStar(b);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ patternId: 'cdlshootingstar', direction: 'BEARISH' });
  });

  it('inverted hammer: gaps down, small body, long upper shadow, tiny lower shadow', () => {
    const b = bars([...FILLER, [1.06, 1.0902, 1.05995, 1.06005]]);
    const found = detectInvertedHammer(b);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ patternId: 'cdlinvertedhammer', direction: 'BULLISH' });
  });
});

describe('detectTakuri', () => {
  it('finds a doji with a very long lower shadow and no upper shadow', () => {
    const b = bars([...FILLER, [1.1, 1.10012, 1.07, 1.10002]]);
    const found = detectTakuri(b);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ patternId: 'cdltakuri', direction: null });
  });
});

describe('detectInNeck / detectOnNeck / detectThrusting', () => {
  // All three share the setup: long black, then white opening below its low.
  it('in-neck: closes slightly above the black close', () => {
    const b = bars([...FILLER, [1.13, 1.131, 1.099, 1.1], [1.095, 1.101, 1.094, 1.10003]]);
    const found = detectInNeck(b);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ patternId: 'cdlinneck', direction: 'BEARISH' });
  });

  it("on-neck: closes at the black candle's low", () => {
    const b = bars([...FILLER, [1.13, 1.131, 1.099, 1.1], [1.095, 1.1, 1.094, 1.09903]]);
    const found = detectOnNeck(b);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ patternId: 'cdlonneck', direction: 'BEARISH' });
  });

  it('thrusting: closes well into the black body but under its midpoint', () => {
    const b = bars([...FILLER, [1.13, 1.131, 1.099, 1.1], [1.095, 1.113, 1.094, 1.112]]);
    const found = detectThrusting(b);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ patternId: 'cdlthrusting', direction: 'BEARISH' });
  });
});

describe('detect3WhiteSoldiers / detect3BlackCrows', () => {
  it('finds three advancing white candles, each opening within the last and closing near its high', () => {
    const b = bars([
      ...FILLER,
      [1.1, 1.12955, 1.0995, 1.1295],
      [1.115, 1.1596, 1.1145, 1.1595],
      [1.145, 1.1896, 1.1445, 1.1895],
    ]);
    const found = detect3WhiteSoldiers(b);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ patternId: 'cdl3whitesoldiers', direction: 'BULLISH' });
  });

  it('finds three declining black candles opening within the last body', () => {
    const b = bars([
      ...FILLER,
      [1.105, 1.1055, 1.09795, 1.098],
      [1.1, 1.1005, 1.08995, 1.09],
      [1.095, 1.0955, 1.07995, 1.08],
    ]);
    const found = detect3BlackCrows(b);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ patternId: 'cdl3blackcrows', direction: 'BEARISH' });
  });
});

describe('detectMorningStar / detectEveningStar', () => {
  it('morning star: long black, gapping-down short star, long white closing well into the 1st body', () => {
    const b = bars([
      ...FILLER,
      [1.13, 1.131, 1.099, 1.1],
      [1.095, 1.0955, 1.0945, 1.0951],
      [1.093, 1.126, 1.092, 1.125],
    ]);
    const found = detectMorningStar(b);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ patternId: 'cdlmorningstar', direction: 'BULLISH' });
  });

  it('evening star: long white, gapping-up short star, long black closing well into the 1st body', () => {
    const b = bars([
      ...FILLER,
      [1.1, 1.131, 1.099, 1.13],
      [1.135, 1.1355, 1.1345, 1.1349],
      [1.137, 1.138, 1.104, 1.105],
    ]);
    const found = detectEveningStar(b);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ patternId: 'cdleveningstar', direction: 'BEARISH' });
  });
});

describe('detectTriStar', () => {
  it('finds three consecutive dojis with the middle one gapping away', () => {
    const b = bars([
      ...FILLER,
      [1.1, 1.10012, 1.09988, 1.10002],
      [1.12, 1.12012, 1.11988, 1.12002],
      [1.115, 1.11512, 1.11488, 1.11502],
    ]);
    const found = detectTriStar(b);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ patternId: 'cdltristar', direction: 'BEARISH' });
  });
});

describe('detectHikkake', () => {
  it('finds an inside bar followed by a break of its low (bullish hikkake)', () => {
    const b = bars([
      [1.1, 1.12, 1.08, 1.1],
      [1.1, 1.11, 1.09, 1.1],
      [1.095, 1.1, 1.085, 1.09],
    ]);
    const found = detectHikkake(b);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ patternId: 'cdlhikkake', direction: 'BULLISH' });
  });
});

describe('no lookahead (all trend-family detectors together)', () => {
  it('cutting the data never changes an already-confirmed detection', () => {
    const w = randomWalk(600, 37);
    const all = (bb: ReturnType<typeof sliceBars>) => [
      ...detectHammer(bb),
      ...detectHangingMan(bb),
      ...detectShootingStar(bb),
      ...detectInvertedHammer(bb),
      ...detectTakuri(bb),
      ...detect3BlackCrows(bb),
      ...detect3WhiteSoldiers(bb),
      ...detect3Inside(bb),
      ...detect3Outside(bb),
      ...detect3LineStrike(bb),
      ...detect3StarsInSouth(bb),
      ...detectAdvanceBlock(bb),
      ...detectStalledPattern(bb),
      ...detectIdentical3Crows(bb),
      ...detectAbandonedBaby(bb),
      ...detectEveningStar(bb),
      ...detectEveningDojiStar(bb),
      ...detectMorningStar(bb),
      ...detectMorningDojiStar(bb),
      ...detectBreakaway(bb),
      ...detectConcealingBabySwallow(bb),
      ...detectGapSideSideWhite(bb),
      ...detectInNeck(bb),
      ...detectOnNeck(bb),
      ...detectThrusting(bb),
      ...detectLadderBottom(bb),
      ...detectMatHold(bb),
      ...detectRiseFall3Methods(bb),
      ...detectTasukiGap(bb),
      ...detectTriStar(bb),
      ...detectUnique3River(bb),
      ...detectXSideGap3Methods(bb),
      ...detectHikkake(bb),
      ...detectHikkakeMod(bb),
    ];
    const full = all(w);
    expect(full.length).toBeGreaterThan(0);
    for (let k = 20; k <= w.length; k += 41) {
      const cut = all(sliceBars(w, k));
      expect(cut).toEqual(full.filter((d) => d.confirmedIndex < k));
    }
  });
});
