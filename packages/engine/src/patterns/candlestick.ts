import type { Bars } from '../features/bars';
import {
  above,
  below,
  belowOrEqual,
  candleAverage,
  color,
  highLowRange,
  isBullish,
  lowerShadow,
  realBody,
  upperShadow,
} from './candle-classify';
import type { CandlePattern } from './types';

/**
 * TA-Lib candlestick patterns (BSD), reimplemented from the official source
 * (github.com/TA-Lib/ta-lib, `src/ta_func/ta_CDL*.c`, checked 2026-10-08) and checked against a
 * recorded TA-Lib run (`tools/oracle/talib_candles.py`,
 * `packages/engine/test/fixtures/SYNTHETIC_candlestick_oracle.json`) plus a real-data cross-check
 * (see `docs/PLAN-M9.md`). Only patterns with **no trend-context dependency** are implemented -
 * TA-Lib's Hammer/Hanging-Man/Morning-Star/... family uses an internal uptrend/downtrend lookback
 * whose exact reproduction was not attempted (CLAUDE.md rule 8); `catalog/patterns/candlestick.json`
 * still marks those `TO_IMPLEMENT`.
 */

const single = (
  b: Bars,
  i: number,
  patternId: string,
  direction: CandlePattern['direction'],
): CandlePattern => multi(b, i, i, patternId, direction);

/** `formedIndex` = the pattern's first bar, `confirmedIndex` = its last (triggering) bar. */
const multi = (
  b: Bars,
  formedIndex: number,
  confirmedIndex: number,
  patternId: string,
  direction: CandlePattern['direction'],
): CandlePattern => ({
  id: `${patternId}:v1:${b.t[confirmedIndex]}`,
  patternId,
  defVersion: 'v1',
  direction,
  formedAt: b.t[formedIndex]!,
  formedIndex,
  confirmedAt: b.end[confirmedIndex]!,
  confirmedIndex,
});

/** Real body at or under 10% of the average high-low range of the 10 prior bars. */
export function detectDoji(b: Bars): CandlePattern[] {
  const out: CandlePattern[] = [];
  for (let i = 0; i < b.length; i++) {
    if (belowOrEqual(b, i, 'bodyDoji', realBody(b, i))) out.push(single(b, i, 'cdldoji', null));
  }
  return out;
}

/** Long real body with both shadows under 10% of the average high-low range (no trend needed). */
export function detectMarubozu(b: Bars): CandlePattern[] {
  const out: CandlePattern[] = [];
  for (let i = 0; i < b.length; i++) {
    const long = above(b, i, 'bodyLong', realBody(b, i));
    const noUpper = below(b, i, 'shadowVeryShort', upperShadow(b, i));
    const noLower = below(b, i, 'shadowVeryShort', lowerShadow(b, i));
    if (long && noUpper && noLower) {
      out.push(single(b, i, 'cdlmarubozu', isBullish(b, i) ? 'BULLISH' : 'BEARISH'));
    }
  }
  return out;
}

/**
 * Opposite-coloured bodies where the second body's edges reach at least as far as the first's on
 * both sides (no size threshold - this is TA-Lib's own rule, a pure geometry check). TA-Lib
 * itself also scales its output to ±80 when an edge lands exactly on the other body's edge
 * rather than past it, and ±100 when both are strictly past it; we only need candidate presence
 * and direction (the same convention as every other engine detector), so that confidence split
 * is not modelled here - verified against the oracle to detect at the same bars either way.
 */
export function detectEngulfing(b: Bars): CandlePattern[] {
  // TA-Lib's own colour check counts a flat candle (close == open) as "white", not as neither
  // colour - confirmed against the oracle, where a doji followed by a genuinely bearish candle
  // still engulfs.
  const col = (i: number) => (b.c[i]! >= b.o[i]! ? 1 : -1);
  const out: CandlePattern[] = [];
  for (let i = 1; i < b.length; i++) {
    if (col(i) === col(i - 1)) continue;
    const hi = Math.max(b.o[i]!, b.c[i]!);
    const lo = Math.min(b.o[i]!, b.c[i]!);
    const prevHi = Math.max(b.o[i - 1]!, b.c[i - 1]!);
    const prevLo = Math.min(b.o[i - 1]!, b.c[i - 1]!);
    if (hi >= prevHi && lo <= prevLo && (hi > prevHi || lo < prevLo)) {
      out.push(multi(b, i - 1, i, 'cdlengulfing', isBullish(b, i) ? 'BULLISH' : 'BEARISH'));
    }
  }
  return out;
}

/** Long body, with no (or very short) shadow on the side the body opened from. */
export function detectBeltHold(b: Bars): CandlePattern[] {
  const out: CandlePattern[] = [];
  for (let i = 0; i < b.length; i++) {
    if (!above(b, i, 'bodyLong', realBody(b, i))) continue;
    const bull = color(b, i) === 1;
    const shadow = bull ? lowerShadow(b, i) : upperShadow(b, i);
    if (below(b, i, 'shadowVeryShort', shadow)) {
      out.push(single(b, i, 'cdlbelthold', bull ? 'BULLISH' : 'BEARISH'));
    }
  }
  return out;
}

/** Long body, with no (or very short) shadow on the side the body closed on. */
export function detectClosingMarubozu(b: Bars): CandlePattern[] {
  const out: CandlePattern[] = [];
  for (let i = 0; i < b.length; i++) {
    if (!above(b, i, 'bodyLong', realBody(b, i))) continue;
    const bull = color(b, i) === 1;
    const shadow = bull ? upperShadow(b, i) : lowerShadow(b, i);
    if (below(b, i, 'shadowVeryShort', shadow)) {
      out.push(single(b, i, 'cdlclosingmarubozu', bull ? 'BULLISH' : 'BEARISH'));
    }
  }
  return out;
}

/** Short body (vs. the trailing average) with both shadows longer than the body. */
export function detectSpinningTop(b: Bars): CandlePattern[] {
  const out: CandlePattern[] = [];
  for (let i = 0; i < b.length; i++) {
    const body = realBody(b, i);
    if (upperShadow(b, i) > body && lowerShadow(b, i) > body && below(b, i, 'bodyShort', body)) {
      out.push(single(b, i, 'cdlspinningtop', color(b, i) === 1 ? 'BULLISH' : 'BEARISH'));
    }
  }
  return out;
}

/** Short body with both shadows very long (vs. the trailing average) - more extreme than a spinning top. */
export function detectHighWave(b: Bars): CandlePattern[] {
  const out: CandlePattern[] = [];
  for (let i = 0; i < b.length; i++) {
    if (
      below(b, i, 'bodyShort', realBody(b, i)) &&
      above(b, i, 'shadowVeryLong', upperShadow(b, i)) &&
      above(b, i, 'shadowVeryLong', lowerShadow(b, i))
    ) {
      out.push(single(b, i, 'cdlhighwave', color(b, i) === 1 ? 'BULLISH' : 'BEARISH'));
    }
  }
  return out;
}

/** Short body with both shadows short (vs. the trailing average) - an unremarkable, quiet bar. */
export function detectShortLine(b: Bars): CandlePattern[] {
  const out: CandlePattern[] = [];
  for (let i = 0; i < b.length; i++) {
    if (
      below(b, i, 'bodyShort', realBody(b, i)) &&
      below(b, i, 'shadowShort', upperShadow(b, i)) &&
      below(b, i, 'shadowShort', lowerShadow(b, i))
    ) {
      out.push(single(b, i, 'cdlshortline', color(b, i) === 1 ? 'BULLISH' : 'BEARISH'));
    }
  }
  return out;
}

/** Long body with both shadows short (vs. the trailing average) - a decisive, uninterrupted move. */
export function detectLongLine(b: Bars): CandlePattern[] {
  const out: CandlePattern[] = [];
  for (let i = 0; i < b.length; i++) {
    if (
      above(b, i, 'bodyLong', realBody(b, i)) &&
      below(b, i, 'shadowShort', upperShadow(b, i)) &&
      below(b, i, 'shadowShort', lowerShadow(b, i))
    ) {
      out.push(single(b, i, 'cdllongline', color(b, i) === 1 ? 'BULLISH' : 'BEARISH'));
    }
  }
  return out;
}

/** Doji with no (or very short) lower shadow and a long upper shadow. */
export function detectGravestoneDoji(b: Bars): CandlePattern[] {
  const out: CandlePattern[] = [];
  for (let i = 0; i < b.length; i++) {
    if (
      belowOrEqual(b, i, 'bodyDoji', realBody(b, i)) &&
      below(b, i, 'shadowVeryShort', lowerShadow(b, i)) &&
      above(b, i, 'shadowVeryShort', upperShadow(b, i))
    ) {
      out.push(single(b, i, 'cdlgravestonedoji', null));
    }
  }
  return out;
}

/** Doji with no (or very short) upper shadow and a long lower shadow. */
export function detectDragonflyDoji(b: Bars): CandlePattern[] {
  const out: CandlePattern[] = [];
  for (let i = 0; i < b.length; i++) {
    if (
      belowOrEqual(b, i, 'bodyDoji', realBody(b, i)) &&
      below(b, i, 'shadowVeryShort', upperShadow(b, i)) &&
      above(b, i, 'shadowVeryShort', lowerShadow(b, i))
    ) {
      out.push(single(b, i, 'cdldragonflydoji', null));
    }
  }
  return out;
}

/** Doji with at least one shadow longer than the bar's own tiny body ("long legs"). */
export function detectLongLeggedDoji(b: Bars): CandlePattern[] {
  const out: CandlePattern[] = [];
  for (let i = 0; i < b.length; i++) {
    if (
      belowOrEqual(b, i, 'bodyDoji', realBody(b, i)) &&
      (above(b, i, 'shadowLong', lowerShadow(b, i)) || above(b, i, 'shadowLong', upperShadow(b, i)))
    ) {
      out.push(single(b, i, 'cdllongleggeddoji', null));
    }
  }
  return out;
}

/** Doji with both shadows longer than its own body, body near the middle of the bar's range. */
export function detectRickshawMan(b: Bars): CandlePattern[] {
  const out: CandlePattern[] = [];
  for (let i = 0; i < b.length; i++) {
    if (!belowOrEqual(b, i, 'bodyDoji', realBody(b, i))) continue;
    if (!above(b, i, 'shadowLong', lowerShadow(b, i))) continue;
    if (!above(b, i, 'shadowLong', upperShadow(b, i))) continue;
    const near = candleAverage(b, i, 'near');
    if (near === null) continue;
    const mid = b.l[i]! + highLowRange(b, i) / 2;
    const bodyHi = Math.max(b.o[i]!, b.c[i]!);
    const bodyLo = Math.min(b.o[i]!, b.c[i]!);
    if (bodyLo <= mid + near && bodyHi >= mid - near) {
      out.push(single(b, i, 'cdlrickshawman', null));
    }
  }
  return out;
}

/** A long body, then a short body fully inside it (opposite colour implied by TA-Lib, not required). */
export function detectHarami(b: Bars): CandlePattern[] {
  const out: CandlePattern[] = [];
  for (let i = 1; i < b.length; i++) {
    if (!above(b, i - 1, 'bodyLong', realBody(b, i - 1))) continue;
    if (!belowOrEqual(b, i, 'bodyShort', realBody(b, i))) continue;
    const hi1 = Math.max(b.o[i - 1]!, b.c[i - 1]!);
    const lo1 = Math.min(b.o[i - 1]!, b.c[i - 1]!);
    const hi2 = Math.max(b.o[i]!, b.c[i]!);
    const lo2 = Math.min(b.o[i]!, b.c[i]!);
    if (hi2 <= hi1 && lo2 >= lo1) {
      out.push(multi(b, i - 1, i, 'cdlharami', color(b, i - 1) === 1 ? 'BEARISH' : 'BULLISH'));
    }
  }
  return out;
}

/** A long body, then a doji fully inside it. */
export function detectHaramiCross(b: Bars): CandlePattern[] {
  const out: CandlePattern[] = [];
  for (let i = 1; i < b.length; i++) {
    if (!above(b, i - 1, 'bodyLong', realBody(b, i - 1))) continue;
    if (!belowOrEqual(b, i, 'bodyDoji', realBody(b, i))) continue;
    const hi1 = Math.max(b.o[i - 1]!, b.c[i - 1]!);
    const lo1 = Math.min(b.o[i - 1]!, b.c[i - 1]!);
    const hi2 = Math.max(b.o[i]!, b.c[i]!);
    const lo2 = Math.min(b.o[i]!, b.c[i]!);
    if (hi2 <= hi1 && lo2 >= lo1) {
      out.push(multi(b, i - 1, i, 'cdlharamicross', color(b, i - 1) === 1 ? 'BEARISH' : 'BULLISH'));
    }
  }
  return out;
}

/** A long body, then a doji that gaps away from it in the direction of the first body's colour. */
export function detectDojiStar(b: Bars): CandlePattern[] {
  const out: CandlePattern[] = [];
  for (let i = 1; i < b.length; i++) {
    if (!above(b, i - 1, 'bodyLong', realBody(b, i - 1))) continue;
    if (!belowOrEqual(b, i, 'bodyDoji', realBody(b, i))) continue;
    const c1 = color(b, i - 1);
    const hi1 = Math.max(b.o[i - 1]!, b.c[i - 1]!);
    const lo1 = Math.min(b.o[i - 1]!, b.c[i - 1]!);
    const hi2 = Math.max(b.o[i]!, b.c[i]!);
    const lo2 = Math.min(b.o[i]!, b.c[i]!);
    const gapped = c1 === 1 ? lo2 > hi1 : hi2 < lo1;
    if (gapped) out.push(multi(b, i - 1, i, 'cdldojistar', c1 === 1 ? 'BEARISH' : 'BULLISH'));
  }
  return out;
}

/** Two bearish bars with matching (within tolerance) closes - a floor candidate. */
export function detectMatchingLow(b: Bars): CandlePattern[] {
  const out: CandlePattern[] = [];
  for (let i = 1; i < b.length; i++) {
    if (color(b, i - 1) !== -1 || color(b, i) !== -1) continue;
    const tol = candleAverage(b, i - 1, 'equal');
    if (tol === null) continue;
    if (Math.abs(b.c[i]! - b.c[i - 1]!) <= tol) {
      out.push(multi(b, i - 1, i, 'cdlmatchinglow', 'BULLISH'));
    }
  }
  return out;
}

/** Two opposite, long-bodied bars that close at (within tolerance) the same price. */
export function detectCounterattack(b: Bars): CandlePattern[] {
  const out: CandlePattern[] = [];
  for (let i = 1; i < b.length; i++) {
    const c1 = color(b, i - 1);
    const c2 = color(b, i);
    if (c1 === c2) continue;
    if (!above(b, i - 1, 'bodyLong', realBody(b, i - 1))) continue;
    if (!above(b, i, 'bodyLong', realBody(b, i))) continue;
    const tol = candleAverage(b, i - 1, 'equal');
    if (tol === null) continue;
    if (Math.abs(b.c[i]! - b.c[i - 1]!) <= tol) {
      out.push(multi(b, i - 1, i, 'cdlcounterattack', c2 === 1 ? 'BULLISH' : 'BEARISH'));
    }
  }
  return out;
}

/** Two opposite-coloured bars opening at (within tolerance) the same price, the second a belt-hold. */
export function detectSeparatingLines(b: Bars): CandlePattern[] {
  const out: CandlePattern[] = [];
  for (let i = 1; i < b.length; i++) {
    const c1 = color(b, i - 1);
    const c2 = color(b, i);
    if (c1 === c2) continue;
    const tol = candleAverage(b, i - 1, 'equal');
    if (tol === null) continue;
    if (Math.abs(b.o[i]! - b.o[i - 1]!) > tol) continue;
    if (!above(b, i, 'bodyLong', realBody(b, i))) continue;
    const shadow = c2 === 1 ? lowerShadow(b, i) : upperShadow(b, i);
    if (below(b, i, 'shadowVeryShort', shadow)) {
      out.push(multi(b, i - 1, i, 'cdlseparatinglines', c2 === 1 ? 'BULLISH' : 'BEARISH'));
    }
  }
  return out;
}

function isMarubozuAt(b: Bars, i: number): boolean {
  return !!(
    above(b, i, 'bodyLong', realBody(b, i)) &&
    below(b, i, 'shadowVeryShort', upperShadow(b, i)) &&
    below(b, i, 'shadowVeryShort', lowerShadow(b, i))
  );
}

/** Two opposite marubozu bars with a gap between them. */
export function detectKicking(b: Bars): CandlePattern[] {
  const out: CandlePattern[] = [];
  for (let i = 1; i < b.length; i++) {
    const c1 = color(b, i - 1);
    const c2 = color(b, i);
    if (c1 === c2) continue;
    if (!isMarubozuAt(b, i - 1) || !isMarubozuAt(b, i)) continue;
    const gapped = c1 === -1 ? b.l[i]! > b.h[i - 1]! : b.h[i]! < b.l[i - 1]!;
    if (gapped) out.push(multi(b, i - 1, i, 'cdlkicking', c2 === 1 ? 'BULLISH' : 'BEARISH'));
  }
  return out;
}

/** Kicking, with direction taken from whichever of the two marubozu has the longer body. */
export function detectKickingByLength(b: Bars): CandlePattern[] {
  const out: CandlePattern[] = [];
  for (let i = 1; i < b.length; i++) {
    const c1 = color(b, i - 1);
    const c2 = color(b, i);
    if (c1 === c2) continue;
    if (!isMarubozuAt(b, i - 1) || !isMarubozuAt(b, i)) continue;
    const gapped = c1 === -1 ? b.l[i]! > b.h[i - 1]! : b.h[i]! < b.l[i - 1]!;
    if (!gapped) continue;
    const longer = realBody(b, i) > realBody(b, i - 1) ? i : i - 1;
    out.push(
      multi(b, i - 1, i, 'cdlkickingbylength', color(b, longer) === 1 ? 'BULLISH' : 'BEARISH'),
    );
  }
  return out;
}

/** A long black bar, then a long white bar opening below its low and closing past its midpoint. */
export function detectPiercing(b: Bars): CandlePattern[] {
  const out: CandlePattern[] = [];
  for (let i = 1; i < b.length; i++) {
    if (color(b, i - 1) !== -1) continue;
    if (!above(b, i - 1, 'bodyLong', realBody(b, i - 1))) continue;
    if (color(b, i) !== 1) continue;
    if (!above(b, i, 'bodyLong', realBody(b, i))) continue;
    if (b.o[i]! >= b.l[i - 1]!) continue;
    if (b.c[i]! >= b.o[i - 1]!) continue;
    const mid = b.c[i - 1]! + realBody(b, i - 1) * 0.5;
    if (b.c[i]! > mid) out.push(multi(b, i - 1, i, 'cdlpiercing', 'BULLISH'));
  }
  return out;
}

/** Piercing's bearish mirror: a long white bar, then a black bar opening above its high. */
export function detectDarkCloudCover(b: Bars, penetration = 0.5): CandlePattern[] {
  const out: CandlePattern[] = [];
  for (let i = 1; i < b.length; i++) {
    if (color(b, i - 1) !== 1) continue;
    if (!above(b, i - 1, 'bodyLong', realBody(b, i - 1))) continue;
    if (color(b, i) !== -1) continue;
    if (b.o[i]! <= b.h[i - 1]!) continue;
    if (b.c[i]! <= b.o[i - 1]!) continue;
    const mid = b.c[i - 1]! - realBody(b, i - 1) * penetration;
    if (b.c[i]! < mid) out.push(multi(b, i - 1, i, 'cdldarkcloudcover', 'BEARISH'));
  }
  return out;
}

/** A long black bar, then a short black bar whose body sits inside the first's open-close range. */
export function detectHomingPigeon(b: Bars): CandlePattern[] {
  const out: CandlePattern[] = [];
  for (let i = 1; i < b.length; i++) {
    if (color(b, i - 1) !== -1 || color(b, i) !== -1) continue;
    if (!above(b, i - 1, 'bodyLong', realBody(b, i - 1))) continue;
    if (!belowOrEqual(b, i, 'bodyShort', realBody(b, i))) continue;
    if (b.o[i]! >= b.o[i - 1]!) continue;
    if (b.c[i]! <= b.c[i - 1]!) continue;
    out.push(multi(b, i - 1, i, 'cdlhomingpigeon', 'BULLISH'));
  }
  return out;
}

/** Black, white, black; the white body's low clears the first close, and the third close matches the first. */
export function detectStickSandwich(b: Bars): CandlePattern[] {
  const out: CandlePattern[] = [];
  for (let i = 2; i < b.length; i++) {
    if (color(b, i - 2) !== -1 || color(b, i - 1) !== 1 || color(b, i) !== -1) continue;
    if (b.l[i - 1]! <= b.c[i - 2]!) continue;
    const tol = candleAverage(b, i - 2, 'equal');
    if (tol === null) continue;
    if (Math.abs(b.c[i]! - b.c[i - 2]!) <= tol) {
      out.push(multi(b, i - 2, i, 'cdlsticksandwich', 'BULLISH'));
    }
  }
  return out;
}

/** A long white bar, a short black bar gapping above it, then a black bar engulfing the 2nd but still above the 1st's close. */
export function detectUpsideGap2Crows(b: Bars): CandlePattern[] {
  const out: CandlePattern[] = [];
  for (let i = 2; i < b.length; i++) {
    if (color(b, i - 2) !== 1) continue;
    if (!above(b, i - 2, 'bodyLong', realBody(b, i - 2))) continue;
    if (color(b, i - 1) !== -1) continue;
    if (!belowOrEqual(b, i - 1, 'bodyShort', realBody(b, i - 1))) continue;
    const hi1 = Math.max(b.o[i - 2]!, b.c[i - 2]!);
    const lo2 = Math.min(b.o[i - 1]!, b.c[i - 1]!);
    if (!(lo2 > hi1)) continue;
    if (color(b, i) !== -1) continue;
    if (!(b.o[i]! > b.o[i - 1]!)) continue;
    if (!(b.c[i]! < b.c[i - 1]!)) continue;
    if (!(b.c[i]! > b.c[i - 2]!)) continue;
    out.push(multi(b, i - 2, i, 'cdlupsidegap2crows', 'BEARISH'));
  }
  return out;
}

/** A long white bar, a black bar gapping above it, then a black bar closing inside the first's body. */
export function detect2Crows(b: Bars): CandlePattern[] {
  const out: CandlePattern[] = [];
  for (let i = 2; i < b.length; i++) {
    if (color(b, i - 2) !== 1) continue;
    if (!above(b, i - 2, 'bodyLong', realBody(b, i - 2))) continue;
    if (color(b, i - 1) !== -1) continue;
    const hi1 = Math.max(b.o[i - 2]!, b.c[i - 2]!);
    const lo2 = Math.min(b.o[i - 1]!, b.c[i - 1]!);
    if (!(lo2 > hi1)) continue;
    if (color(b, i) !== -1) continue;
    if (!(b.o[i]! < b.o[i - 1]!)) continue;
    if (!(b.o[i]! > b.c[i - 1]!)) continue;
    if (!(b.c[i]! > b.o[i - 2]!)) continue;
    if (!(b.c[i]! < b.c[i - 2]!)) continue;
    out.push(multi(b, i - 2, i, 'cdl2crows', 'BEARISH'));
  }
  return out;
}
