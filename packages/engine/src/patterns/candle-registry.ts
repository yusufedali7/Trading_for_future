import type { UtcMs } from '../core/types';
import type { Bars } from '../features/bars';
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
} from './candlestick';
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
} from './candlestick-trend';
import type { CandlePattern } from './types';

/**
 * A single lookup for all 61 candlestick detectors (M9 1./5./6. dilim, D48/D52/D53), used by the
 * strategy engine's `CANDLE_PATTERN_EVENT` step (D67) to resolve a catalog `patternId` (e.g.
 * "cdlengulfing") to its detector function. Every one of these shares the signature
 * `(bars) => CandlePattern[]` (a handful take an optional second `penetration` parameter with its
 * own default, which is still callable as a 1-argument function - TypeScript allows this).
 *
 * This is the `CandlePattern` counterpart of `chart-registry.ts`'s `CHART_PATTERN_DETECTORS` - a
 * separate registry because the two families have different shapes (`ChartPattern` has
 * `confirmationRef`/`targetPrice`/`invalidationRef`; `CandlePattern` has none of those, only a bar
 * index), so they need their own `EventStep` type rather than sharing `PATTERN_EVENT` (see
 * `strategy/schema.ts`'s `CandlePatternEventStep` doc comment for why reusing one type would have
 * forced `REF_FIELDS` to depend on `patternId`, not just `StepType`).
 */
export const CANDLE_PATTERN_DETECTORS: Record<string, (b: Bars) => CandlePattern[]> = {
  cdldoji: detectDoji,
  cdlmarubozu: detectMarubozu,
  cdlengulfing: detectEngulfing,
  cdlbelthold: detectBeltHold,
  cdlclosingmarubozu: detectClosingMarubozu,
  cdlspinningtop: detectSpinningTop,
  cdlhighwave: detectHighWave,
  cdlshortline: detectShortLine,
  cdllongline: detectLongLine,
  cdlgravestonedoji: detectGravestoneDoji,
  cdldragonflydoji: detectDragonflyDoji,
  cdllongleggeddoji: detectLongLeggedDoji,
  cdlrickshawman: detectRickshawMan,
  cdlharami: detectHarami,
  cdlharamicross: detectHaramiCross,
  cdldojistar: detectDojiStar,
  cdlmatchinglow: detectMatchingLow,
  cdlcounterattack: detectCounterattack,
  cdlseparatinglines: detectSeparatingLines,
  cdlkicking: detectKicking,
  cdlkickingbylength: detectKickingByLength,
  cdlpiercing: detectPiercing,
  cdldarkcloudcover: detectDarkCloudCover,
  cdlhomingpigeon: detectHomingPigeon,
  cdlsticksandwich: detectStickSandwich,
  cdlupsidegap2crows: detectUpsideGap2Crows,
  cdl2crows: detect2Crows,
  cdlhammer: detectHammer,
  cdlhangingman: detectHangingMan,
  cdlshootingstar: detectShootingStar,
  cdlinvertedhammer: detectInvertedHammer,
  cdltakuri: detectTakuri,
  cdl3blackcrows: detect3BlackCrows,
  cdl3whitesoldiers: detect3WhiteSoldiers,
  cdl3inside: detect3Inside,
  cdl3outside: detect3Outside,
  cdl3linestrike: detect3LineStrike,
  cdl3starsinsouth: detect3StarsInSouth,
  cdladvanceblock: detectAdvanceBlock,
  cdlstalledpattern: detectStalledPattern,
  cdlidentical3crows: detectIdentical3Crows,
  cdlabandonedbaby: detectAbandonedBaby,
  cdleveningstar: detectEveningStar,
  cdleveningdojistar: detectEveningDojiStar,
  cdlmorningstar: detectMorningStar,
  cdlmorningdojistar: detectMorningDojiStar,
  cdlbreakaway: detectBreakaway,
  cdlconcealbabyswall: detectConcealingBabySwallow,
  cdlgapsidesidewhite: detectGapSideSideWhite,
  cdlinneck: detectInNeck,
  cdlonneck: detectOnNeck,
  cdlthrusting: detectThrusting,
  cdlladderbottom: detectLadderBottom,
  cdlmathold: detectMatHold,
  cdlrisefall3methods: detectRiseFall3Methods,
  cdltasukigap: detectTasukiGap,
  cdltristar: detectTriStar,
  cdlunique3river: detectUnique3River,
  cdlxsidegap3methods: detectXSideGap3Methods,
  cdlhikkake: detectHikkake,
  cdlhikkakemod: detectHikkakeMod,
};

export const CANDLE_PATTERN_IDS: readonly string[] = Object.keys(CANDLE_PATTERN_DETECTORS);

/** Every candlestick detector run once, concatenated - the `CANDLE_PATTERN_EVENT` candidate source. */
export function detectAllCandlePatterns(b: Bars): CandlePattern[] {
  return Object.values(CANDLE_PATTERN_DETECTORS).flatMap((fn) => fn(b));
}

/** The candle-pattern candidates known at `cutoff` (the replay cursor) - mirrors `harmonicsAsOf`. */
export function candlePatternsAsOf(ps: readonly CandlePattern[], cutoff: UtcMs): CandlePattern[] {
  return ps.filter((p) => p.confirmedAt <= cutoff);
}
