import type { Bars } from '../features/bars';
import {
  above,
  below,
  belowOrEqual,
  candleAverage,
  color,
  lowerShadow,
  realBody,
  upperShadow,
} from './candle-classify';
import { multi, single } from './pattern-builder';
import type { CandlePattern } from './types';

/**
 * The "Hammer family" and other TA-Lib candlestick patterns whose textbook definition calls for
 * a prior trend (BSD, from the official source github.com/TA-Lib/ta-lib `src/ta_func/ta_CDL*.c`
 * at tag v0.8.1 - matching the installed `TA-Lib` 0.8.1 Python package exactly, checked
 * 2026-10-08). The catalog previously marked these `TO_IMPLEMENT` because reproducing TA-Lib's
 * trend detection "from memory" felt unsafe (CLAUDE.md rule 8) - reading the actual source
 * resolved that: **none of these functions implement real trend detection.** Every one of them
 * carries a comment like "the user should consider that a hammer must appear in a downtrend,
 * while this function does not consider it" - TA-Lib leaves trend judgement entirely to the
 * caller and only checks the candle geometry (confirmed empirically too: feeding the installed
 * library an identical "hammer-shaped" bar after a synthetic uptrend vs. downtrend gave different
 * results, but tracing why showed it is the "near the prior bar's low/high" geometric check
 * reacting to where that prior bar happens to sit, not a genuine multi-bar trend lookback). So
 * these are implemented with the same confidence as every other geometric pattern in
 * `candlestick.ts`; this project's own "candidate, not confirmed" display convention already
 * covers the "only meaningful in the right context" caveat TA-Lib's comments are making.
 *
 * `detectHikkake`/`detectHikkakeMod` are a deliberate exception: TA-Lib's own versions re-emit a
 * "confirmation" signal on a later bar (up to 3 bars after) when price closes beyond the pattern.
 * That stateful, multi-bar-lookback behaviour is not modelled here - only the initial signal is
 * (same "presence + direction, not every nuance" policy already used for Engulfing's ±80/±100).
 */

export function detectHammer(b: Bars): CandlePattern[] {
  const out: CandlePattern[] = [];
  for (let i = 1; i < b.length; i++) {
    if (!below(b, i, 'bodyShort', realBody(b, i))) continue;
    if (!above(b, i, 'shadowLong', lowerShadow(b, i))) continue;
    if (!below(b, i, 'shadowVeryShort', upperShadow(b, i))) continue;
    const near = candleAverage(b, i - 1, 'near');
    if (near === null) continue;
    if (Math.min(b.c[i]!, b.o[i]!) <= b.l[i - 1]! + near)
      out.push(single(b, i, 'cdlhammer', 'BULLISH'));
  }
  return out;
}

export function detectHangingMan(b: Bars): CandlePattern[] {
  const out: CandlePattern[] = [];
  for (let i = 1; i < b.length; i++) {
    if (!below(b, i, 'bodyShort', realBody(b, i))) continue;
    if (!above(b, i, 'shadowLong', lowerShadow(b, i))) continue;
    if (!below(b, i, 'shadowVeryShort', upperShadow(b, i))) continue;
    const near = candleAverage(b, i - 1, 'near');
    if (near === null) continue;
    if (Math.min(b.c[i]!, b.o[i]!) >= b.h[i - 1]! - near)
      out.push(single(b, i, 'cdlhangingman', 'BEARISH'));
  }
  return out;
}

export function detectShootingStar(b: Bars): CandlePattern[] {
  const out: CandlePattern[] = [];
  for (let i = 1; i < b.length; i++) {
    if (!(Math.min(b.o[i]!, b.c[i]!) > Math.max(b.o[i - 1]!, b.c[i - 1]!))) continue;
    if (!below(b, i, 'bodyShort', realBody(b, i))) continue;
    if (!above(b, i, 'shadowLong', upperShadow(b, i))) continue;
    if (!below(b, i, 'shadowVeryShort', lowerShadow(b, i))) continue;
    out.push(single(b, i, 'cdlshootingstar', 'BEARISH'));
  }
  return out;
}

export function detectInvertedHammer(b: Bars): CandlePattern[] {
  const out: CandlePattern[] = [];
  for (let i = 1; i < b.length; i++) {
    if (!(Math.max(b.o[i]!, b.c[i]!) < Math.min(b.o[i - 1]!, b.c[i - 1]!))) continue;
    if (!below(b, i, 'bodyShort', realBody(b, i))) continue;
    if (!above(b, i, 'shadowLong', upperShadow(b, i))) continue;
    if (!below(b, i, 'shadowVeryShort', lowerShadow(b, i))) continue;
    out.push(single(b, i, 'cdlinvertedhammer', 'BULLISH'));
  }
  return out;
}

/** Doji with a tiny (or no) upper shadow and a very long lower shadow; direction is TA-Lib's own "always positive but this does not mean bullish" - we record `null`, like every other doji. */
export function detectTakuri(b: Bars): CandlePattern[] {
  const out: CandlePattern[] = [];
  for (let i = 0; i < b.length; i++) {
    if (!belowOrEqual(b, i, 'bodyDoji', realBody(b, i))) continue;
    if (!below(b, i, 'shadowVeryShort', upperShadow(b, i))) continue;
    if (!above(b, i, 'shadowVeryLong', lowerShadow(b, i))) continue;
    out.push(single(b, i, 'cdltakuri', null));
  }
  return out;
}

export function detect3BlackCrows(b: Bars): CandlePattern[] {
  const out: CandlePattern[] = [];
  for (let i = 3; i < b.length; i++) {
    if (
      color(b, i - 3) !== 1 ||
      color(b, i - 2) !== -1 ||
      color(b, i - 1) !== -1 ||
      color(b, i) !== -1
    )
      continue;
    if (!(b.o[i - 1]! < b.o[i - 2]! && b.o[i - 1]! > b.c[i - 2]!)) continue;
    if (!(b.o[i]! < b.o[i - 1]! && b.o[i]! > b.c[i - 1]!)) continue;
    if (!(b.h[i - 3]! > b.c[i - 2]!)) continue;
    if (!(b.c[i - 2]! > b.c[i - 1]! && b.c[i - 1]! > b.c[i]!)) continue;
    if (!below(b, i - 2, 'shadowVeryShort', lowerShadow(b, i - 2))) continue;
    if (!below(b, i - 1, 'shadowVeryShort', lowerShadow(b, i - 1))) continue;
    if (!below(b, i, 'shadowVeryShort', lowerShadow(b, i))) continue;
    out.push(multi(b, i - 3, i, 'cdl3blackcrows', 'BEARISH'));
  }
  return out;
}

export function detect3WhiteSoldiers(b: Bars): CandlePattern[] {
  const out: CandlePattern[] = [];
  for (let i = 2; i < b.length; i++) {
    if (color(b, i - 2) !== 1 || color(b, i - 1) !== 1 || color(b, i) !== 1) continue;
    if (!below(b, i - 2, 'shadowVeryShort', upperShadow(b, i - 2))) continue;
    if (!below(b, i - 1, 'shadowVeryShort', upperShadow(b, i - 1))) continue;
    if (!below(b, i, 'shadowVeryShort', upperShadow(b, i))) continue;
    if (!(b.c[i]! > b.c[i - 1]! && b.c[i - 1]! > b.c[i - 2]!)) continue;
    if (!(b.o[i - 1]! > b.o[i - 2]!)) continue;
    const near2 = candleAverage(b, i - 2, 'near');
    if (near2 === null || !(b.o[i - 1]! <= b.c[i - 2]! + near2)) continue;
    if (!(b.o[i]! > b.o[i - 1]!)) continue;
    const near1 = candleAverage(b, i - 1, 'near');
    if (near1 === null || !(b.o[i]! <= b.c[i - 1]! + near1)) continue;
    const far2 = candleAverage(b, i - 2, 'far');
    if (far2 === null || !(realBody(b, i - 1) > realBody(b, i - 2) - far2)) continue;
    const far1 = candleAverage(b, i - 1, 'far');
    if (far1 === null || !(realBody(b, i) > realBody(b, i - 1) - far1)) continue;
    if (!above(b, i, 'bodyShort', realBody(b, i))) continue;
    out.push(multi(b, i - 2, i, 'cdl3whitesoldiers', 'BULLISH'));
  }
  return out;
}

export function detect3Inside(b: Bars): CandlePattern[] {
  const out: CandlePattern[] = [];
  for (let i = 2; i < b.length; i++) {
    const hi1 = Math.max(b.c[i - 2]!, b.o[i - 2]!);
    const lo1 = Math.min(b.c[i - 2]!, b.o[i - 2]!);
    const hi2 = Math.max(b.c[i - 1]!, b.o[i - 1]!);
    const lo2 = Math.min(b.c[i - 1]!, b.o[i - 1]!);
    if (!(hi2 < hi1 && lo2 > lo1)) continue;
    const c2 = color(b, i - 2);
    const c0 = color(b, i);
    const up = c2 === 1 && c0 === -1 && b.c[i]! < b.o[i - 2]!;
    const down = c2 === -1 && c0 === 1 && b.c[i]! > b.o[i - 2]!;
    if (!up && !down) continue;
    if (!above(b, i - 2, 'bodyLong', realBody(b, i - 2))) continue;
    if (!belowOrEqual(b, i - 1, 'bodyShort', realBody(b, i - 1))) continue;
    out.push(multi(b, i - 2, i, 'cdl3inside', c2 === 1 ? 'BEARISH' : 'BULLISH'));
  }
  return out;
}

export function detect3Outside(b: Bars): CandlePattern[] {
  const out: CandlePattern[] = [];
  for (let i = 2; i < b.length; i++) {
    const c1 = color(b, i - 2);
    const c2 = color(b, i - 1);
    if (
      c2 === 1 &&
      c1 === -1 &&
      b.c[i - 1]! > b.o[i - 2]! &&
      b.o[i - 1]! < b.c[i - 2]! &&
      b.c[i]! > b.c[i - 1]!
    ) {
      out.push(multi(b, i - 2, i, 'cdl3outside', 'BULLISH'));
    } else if (
      c2 === -1 &&
      c1 === 1 &&
      b.o[i - 1]! > b.c[i - 2]! &&
      b.c[i - 1]! < b.o[i - 2]! &&
      b.c[i]! < b.c[i - 1]!
    ) {
      out.push(multi(b, i - 2, i, 'cdl3outside', 'BEARISH'));
    }
  }
  return out;
}

export function detect3LineStrike(b: Bars): CandlePattern[] {
  const out: CandlePattern[] = [];
  for (let i = 3; i < b.length; i++) {
    const c3 = color(b, i - 3);
    const c2 = color(b, i - 2);
    const c1 = color(b, i - 1);
    const c0 = color(b, i);
    if (c3 !== c2 || c2 !== c1 || c0 !== (-c1 as 1 | -1)) continue;
    const near3 = candleAverage(b, i - 3, 'near');
    const near2 = candleAverage(b, i - 2, 'near');
    if (near3 === null || near2 === null) continue;
    const lo3 = Math.min(b.o[i - 3]!, b.c[i - 3]!);
    const hi3 = Math.max(b.o[i - 3]!, b.c[i - 3]!);
    if (!(b.o[i - 2]! >= lo3 - near3 && b.o[i - 2]! <= hi3 + near3)) continue;
    const lo2 = Math.min(b.o[i - 2]!, b.c[i - 2]!);
    const hi2 = Math.max(b.o[i - 2]!, b.c[i - 2]!);
    if (!(b.o[i - 1]! >= lo2 - near2 && b.o[i - 1]! <= hi2 + near2)) continue;
    const ok =
      c1 === 1
        ? b.c[i - 1]! > b.c[i - 2]! &&
          b.c[i - 2]! > b.c[i - 3]! &&
          b.o[i]! > b.c[i - 1]! &&
          b.c[i]! < b.o[i - 3]!
        : b.c[i - 1]! < b.c[i - 2]! &&
          b.c[i - 2]! < b.c[i - 3]! &&
          b.o[i]! < b.c[i - 1]! &&
          b.c[i]! > b.o[i - 3]!;
    if (!ok) continue;
    out.push(multi(b, i - 3, i, 'cdl3linestrike', c1 === 1 ? 'BULLISH' : 'BEARISH'));
  }
  return out;
}

export function detect3StarsInSouth(b: Bars): CandlePattern[] {
  const out: CandlePattern[] = [];
  for (let i = 2; i < b.length; i++) {
    if (color(b, i - 2) !== -1 || color(b, i - 1) !== -1 || color(b, i) !== -1) continue;
    if (!above(b, i - 2, 'bodyLong', realBody(b, i - 2))) continue;
    if (!above(b, i - 2, 'shadowLong', lowerShadow(b, i - 2))) continue;
    if (!(realBody(b, i - 1) < realBody(b, i - 2))) continue;
    if (!(b.o[i - 1]! > b.c[i - 2]! && b.o[i - 1]! <= b.h[i - 2]!)) continue;
    if (!(b.l[i - 1]! < b.c[i - 2]! && b.l[i - 1]! >= b.l[i - 2]!)) continue;
    if (!above(b, i - 1, 'shadowVeryShort', lowerShadow(b, i - 1))) continue;
    if (!below(b, i, 'bodyShort', realBody(b, i))) continue;
    if (!below(b, i, 'shadowVeryShort', lowerShadow(b, i))) continue;
    if (!below(b, i, 'shadowVeryShort', upperShadow(b, i))) continue;
    if (!(b.l[i]! > b.l[i - 1]! && b.h[i]! < b.h[i - 1]!)) continue;
    out.push(multi(b, i - 2, i, 'cdl3starsinsouth', 'BULLISH'));
  }
  return out;
}

export function detectAdvanceBlock(b: Bars): CandlePattern[] {
  const out: CandlePattern[] = [];
  for (let i = 2; i < b.length; i++) {
    if (color(b, i - 2) !== 1 || color(b, i - 1) !== 1 || color(b, i) !== 1) continue;
    if (!(b.c[i]! > b.c[i - 1]! && b.c[i - 1]! > b.c[i - 2]!)) continue;
    const near2 = candleAverage(b, i - 2, 'near');
    const near1 = candleAverage(b, i - 1, 'near');
    if (near2 === null || near1 === null) continue;
    if (!(b.o[i - 1]! > b.o[i - 2]! && b.o[i - 1]! <= b.c[i - 2]! + near2)) continue;
    if (!(b.o[i]! > b.o[i - 1]! && b.o[i]! <= b.c[i - 1]! + near1)) continue;
    if (!above(b, i - 2, 'bodyLong', realBody(b, i - 2))) continue;
    if (!below(b, i - 2, 'shadowShort', upperShadow(b, i - 2))) continue;
    const far2 = candleAverage(b, i - 2, 'far');
    const far1 = candleAverage(b, i - 1, 'far');
    const shadowShort0 = candleAverage(b, i, 'shadowShort');
    const shadowShort1 = candleAverage(b, i - 1, 'shadowShort');
    const shadowLong0 = candleAverage(b, i, 'shadowLong');
    if (
      far2 === null ||
      far1 === null ||
      shadowShort0 === null ||
      shadowShort1 === null ||
      shadowLong0 === null
    )
      continue;
    const body2 = realBody(b, i - 2);
    const body1 = realBody(b, i - 1);
    const body0 = realBody(b, i);
    const cond1 = body1 < body2 - far2 && body0 < body1 + near1;
    const cond2 = body0 < body1 - far1;
    const cond3 =
      body0 < body1 &&
      body1 < body2 &&
      (upperShadow(b, i) > shadowShort0 || upperShadow(b, i - 1) > shadowShort1);
    const cond4 = body0 < body1 && upperShadow(b, i) > shadowLong0;
    if (!(cond1 || cond2 || cond3 || cond4)) continue;
    out.push(multi(b, i - 2, i, 'cdladvanceblock', 'BEARISH'));
  }
  return out;
}

export function detectStalledPattern(b: Bars): CandlePattern[] {
  const out: CandlePattern[] = [];
  for (let i = 2; i < b.length; i++) {
    if (color(b, i - 2) !== 1 || color(b, i - 1) !== 1 || color(b, i) !== 1) continue;
    if (!(b.c[i]! > b.c[i - 1]! && b.c[i - 1]! > b.c[i - 2]!)) continue;
    if (!above(b, i - 2, 'bodyLong', realBody(b, i - 2))) continue;
    if (!above(b, i - 1, 'bodyLong', realBody(b, i - 1))) continue;
    if (!below(b, i - 1, 'shadowVeryShort', upperShadow(b, i - 1))) continue;
    if (!(b.o[i - 1]! > b.o[i - 2]!)) continue;
    const near2 = candleAverage(b, i - 2, 'near');
    if (near2 === null || !(b.o[i - 1]! <= b.c[i - 2]! + near2)) continue;
    if (!below(b, i, 'bodyShort', realBody(b, i))) continue;
    const near1 = candleAverage(b, i - 1, 'near');
    if (near1 === null) continue;
    if (!(b.o[i]! >= b.c[i - 1]! - realBody(b, i) - near1)) continue;
    out.push(multi(b, i - 2, i, 'cdlstalledpattern', 'BEARISH'));
  }
  return out;
}

export function detectIdentical3Crows(b: Bars): CandlePattern[] {
  const out: CandlePattern[] = [];
  for (let i = 2; i < b.length; i++) {
    if (color(b, i - 2) !== -1 || color(b, i - 1) !== -1 || color(b, i) !== -1) continue;
    if (!below(b, i - 2, 'shadowVeryShort', lowerShadow(b, i - 2))) continue;
    if (!below(b, i - 1, 'shadowVeryShort', lowerShadow(b, i - 1))) continue;
    if (!below(b, i, 'shadowVeryShort', lowerShadow(b, i))) continue;
    if (!(b.c[i - 2]! > b.c[i - 1]! && b.c[i - 1]! > b.c[i]!)) continue;
    const eq2 = candleAverage(b, i - 2, 'equal');
    const eq1 = candleAverage(b, i - 1, 'equal');
    if (eq2 === null || eq1 === null) continue;
    if (!(b.o[i - 1]! <= b.c[i - 2]! + eq2 && b.o[i - 1]! >= b.c[i - 2]! - eq2)) continue;
    if (!(b.o[i]! <= b.c[i - 1]! + eq1 && b.o[i]! >= b.c[i - 1]! - eq1)) continue;
    out.push(multi(b, i - 2, i, 'cdlidentical3crows', 'BEARISH'));
  }
  return out;
}

export function detectAbandonedBaby(b: Bars, penetration = 0.3): CandlePattern[] {
  const out: CandlePattern[] = [];
  for (let i = 2; i < b.length; i++) {
    if (!above(b, i - 2, 'bodyLong', realBody(b, i - 2))) continue;
    if (!belowOrEqual(b, i - 1, 'bodyDoji', realBody(b, i - 1))) continue;
    if (!above(b, i, 'bodyShort', realBody(b, i))) continue;
    const c2 = color(b, i - 2);
    const c0 = color(b, i);
    if (
      c2 === 1 &&
      c0 === -1 &&
      b.c[i]! < b.c[i - 2]! - realBody(b, i - 2) * penetration &&
      b.l[i - 1]! > b.h[i - 2]! &&
      b.h[i]! < b.l[i - 1]!
    ) {
      out.push(multi(b, i - 2, i, 'cdlabandonedbaby', 'BEARISH'));
    } else if (
      c2 === -1 &&
      c0 === 1 &&
      b.c[i]! > b.c[i - 2]! + realBody(b, i - 2) * penetration &&
      b.h[i - 1]! < b.l[i - 2]! &&
      b.l[i]! > b.h[i - 1]!
    ) {
      out.push(multi(b, i - 2, i, 'cdlabandonedbaby', 'BULLISH'));
    }
  }
  return out;
}

export function detectEveningStar(b: Bars, penetration = 0.3): CandlePattern[] {
  const out: CandlePattern[] = [];
  for (let i = 2; i < b.length; i++) {
    if (color(b, i - 2) !== 1 || color(b, i) !== -1) continue;
    if (!(Math.min(b.o[i - 1]!, b.c[i - 1]!) > Math.max(b.o[i - 2]!, b.c[i - 2]!))) continue;
    if (!(b.c[i]! < b.c[i - 2]! - realBody(b, i - 2) * penetration)) continue;
    if (!above(b, i - 2, 'bodyLong', realBody(b, i - 2))) continue;
    if (!belowOrEqual(b, i - 1, 'bodyShort', realBody(b, i - 1))) continue;
    if (!above(b, i, 'bodyShort', realBody(b, i))) continue;
    out.push(multi(b, i - 2, i, 'cdleveningstar', 'BEARISH'));
  }
  return out;
}

export function detectEveningDojiStar(b: Bars, penetration = 0.3): CandlePattern[] {
  const out: CandlePattern[] = [];
  for (let i = 2; i < b.length; i++) {
    if (color(b, i - 2) !== 1 || color(b, i) !== -1) continue;
    if (!(Math.min(b.o[i - 1]!, b.c[i - 1]!) > Math.max(b.o[i - 2]!, b.c[i - 2]!))) continue;
    if (!(b.c[i]! < b.c[i - 2]! - realBody(b, i - 2) * penetration)) continue;
    if (!above(b, i - 2, 'bodyLong', realBody(b, i - 2))) continue;
    if (!belowOrEqual(b, i - 1, 'bodyDoji', realBody(b, i - 1))) continue;
    if (!above(b, i, 'bodyShort', realBody(b, i))) continue;
    out.push(multi(b, i - 2, i, 'cdleveningdojistar', 'BEARISH'));
  }
  return out;
}

export function detectMorningStar(b: Bars, penetration = 0.3): CandlePattern[] {
  const out: CandlePattern[] = [];
  for (let i = 2; i < b.length; i++) {
    if (color(b, i - 2) !== -1 || color(b, i) !== 1) continue;
    if (!(Math.max(b.o[i - 1]!, b.c[i - 1]!) < Math.min(b.o[i - 2]!, b.c[i - 2]!))) continue;
    if (!(b.c[i]! > b.c[i - 2]! + realBody(b, i - 2) * penetration)) continue;
    if (!above(b, i - 2, 'bodyLong', realBody(b, i - 2))) continue;
    if (!belowOrEqual(b, i - 1, 'bodyShort', realBody(b, i - 1))) continue;
    if (!above(b, i, 'bodyShort', realBody(b, i))) continue;
    out.push(multi(b, i - 2, i, 'cdlmorningstar', 'BULLISH'));
  }
  return out;
}

export function detectMorningDojiStar(b: Bars, penetration = 0.3): CandlePattern[] {
  const out: CandlePattern[] = [];
  for (let i = 2; i < b.length; i++) {
    if (color(b, i - 2) !== -1 || color(b, i) !== 1) continue;
    if (!(Math.max(b.o[i - 1]!, b.c[i - 1]!) < Math.min(b.o[i - 2]!, b.c[i - 2]!))) continue;
    if (!(b.c[i]! > b.c[i - 2]! + realBody(b, i - 2) * penetration)) continue;
    if (!above(b, i - 2, 'bodyLong', realBody(b, i - 2))) continue;
    if (!belowOrEqual(b, i - 1, 'bodyDoji', realBody(b, i - 1))) continue;
    if (!above(b, i, 'bodyShort', realBody(b, i))) continue;
    out.push(multi(b, i - 2, i, 'cdlmorningdojistar', 'BULLISH'));
  }
  return out;
}

export function detectBreakaway(b: Bars): CandlePattern[] {
  const out: CandlePattern[] = [];
  for (let i = 4; i < b.length; i++) {
    const c4 = color(b, i - 4);
    const c3 = color(b, i - 3);
    const c1 = color(b, i - 1);
    const c0 = color(b, i);
    if (c4 !== c3 || c3 !== c1 || c1 === c0) continue;
    if (!above(b, i - 4, 'bodyLong', realBody(b, i - 4))) continue;
    const ok =
      c4 === -1
        ? Math.max(b.o[i - 3]!, b.c[i - 3]!) < Math.min(b.o[i - 4]!, b.c[i - 4]!) &&
          b.h[i - 2]! < b.h[i - 3]! &&
          b.l[i - 2]! < b.l[i - 3]! &&
          b.h[i - 1]! < b.h[i - 2]! &&
          b.l[i - 1]! < b.l[i - 2]! &&
          b.c[i]! > b.o[i - 3]! &&
          b.c[i]! < b.c[i - 4]!
        : Math.min(b.o[i - 3]!, b.c[i - 3]!) > Math.max(b.o[i - 4]!, b.c[i - 4]!) &&
          b.h[i - 2]! > b.h[i - 3]! &&
          b.l[i - 2]! > b.l[i - 3]! &&
          b.h[i - 1]! > b.h[i - 2]! &&
          b.l[i - 1]! > b.l[i - 2]! &&
          b.c[i]! < b.o[i - 3]! &&
          b.c[i]! > b.c[i - 4]!;
    if (!ok) continue;
    out.push(multi(b, i - 4, i, 'cdlbreakaway', c0 === 1 ? 'BULLISH' : 'BEARISH'));
  }
  return out;
}

export function detectConcealingBabySwallow(b: Bars): CandlePattern[] {
  const out: CandlePattern[] = [];
  for (let i = 3; i < b.length; i++) {
    if (
      color(b, i - 3) !== -1 ||
      color(b, i - 2) !== -1 ||
      color(b, i - 1) !== -1 ||
      color(b, i) !== -1
    )
      continue;
    if (!below(b, i - 3, 'shadowVeryShort', lowerShadow(b, i - 3))) continue;
    if (!below(b, i - 3, 'shadowVeryShort', upperShadow(b, i - 3))) continue;
    if (!below(b, i - 2, 'shadowVeryShort', lowerShadow(b, i - 2))) continue;
    if (!below(b, i - 2, 'shadowVeryShort', upperShadow(b, i - 2))) continue;
    if (!(Math.max(b.o[i - 1]!, b.c[i - 1]!) < Math.min(b.o[i - 2]!, b.c[i - 2]!))) continue;
    if (!above(b, i - 1, 'shadowVeryShort', upperShadow(b, i - 1))) continue;
    if (!(b.h[i - 1]! > b.c[i - 2]!)) continue;
    if (!(b.h[i]! > b.h[i - 1]! && b.l[i]! < b.l[i - 1]!)) continue;
    out.push(multi(b, i - 3, i, 'cdlconcealbabyswall', 'BULLISH'));
  }
  return out;
}

export function detectGapSideSideWhite(b: Bars): CandlePattern[] {
  const out: CandlePattern[] = [];
  for (let i = 2; i < b.length; i++) {
    const gapUp = Math.min(b.o[i - 1]!, b.c[i - 1]!) > Math.max(b.o[i - 2]!, b.c[i - 2]!);
    const gapDown = Math.max(b.o[i - 1]!, b.c[i - 1]!) < Math.min(b.o[i - 2]!, b.c[i - 2]!);
    const gapUp2 = Math.min(b.o[i]!, b.c[i]!) > Math.max(b.o[i - 2]!, b.c[i - 2]!);
    const gapDown2 = Math.max(b.o[i]!, b.c[i]!) < Math.min(b.o[i - 2]!, b.c[i - 2]!);
    if (!((gapUp && gapUp2) || (gapDown && gapDown2))) continue;
    if (color(b, i - 1) !== 1 || color(b, i) !== 1) continue;
    const near1 = candleAverage(b, i - 1, 'near');
    const eq1 = candleAverage(b, i - 1, 'equal');
    if (near1 === null || eq1 === null) continue;
    if (!(
      realBody(b, i) >= realBody(b, i - 1) - near1 && realBody(b, i) <= realBody(b, i - 1) + near1
    ))
      continue;
    if (!(b.o[i]! >= b.o[i - 1]! - eq1 && b.o[i]! <= b.o[i - 1]! + eq1)) continue;
    out.push(multi(b, i - 2, i, 'cdlgapsidesidewhite', gapUp ? 'BULLISH' : 'BEARISH'));
  }
  return out;
}

export function detectInNeck(b: Bars): CandlePattern[] {
  const out: CandlePattern[] = [];
  for (let i = 1; i < b.length; i++) {
    if (color(b, i - 1) !== -1) continue;
    if (!above(b, i - 1, 'bodyLong', realBody(b, i - 1))) continue;
    if (color(b, i) !== 1) continue;
    if (!(b.o[i]! < b.l[i - 1]!)) continue;
    const eq = candleAverage(b, i - 1, 'equal');
    if (eq === null) continue;
    if (!(b.c[i]! <= b.c[i - 1]! + eq && b.c[i]! >= b.c[i - 1]!)) continue;
    out.push(multi(b, i - 1, i, 'cdlinneck', 'BEARISH'));
  }
  return out;
}

export function detectOnNeck(b: Bars): CandlePattern[] {
  const out: CandlePattern[] = [];
  for (let i = 1; i < b.length; i++) {
    if (color(b, i - 1) !== -1) continue;
    if (!above(b, i - 1, 'bodyLong', realBody(b, i - 1))) continue;
    if (color(b, i) !== 1) continue;
    if (!(b.o[i]! < b.l[i - 1]!)) continue;
    const eq = candleAverage(b, i - 1, 'equal');
    if (eq === null) continue;
    if (!(b.c[i]! <= b.l[i - 1]! + eq && b.c[i]! >= b.l[i - 1]! - eq)) continue;
    out.push(multi(b, i - 1, i, 'cdlonneck', 'BEARISH'));
  }
  return out;
}

export function detectThrusting(b: Bars): CandlePattern[] {
  const out: CandlePattern[] = [];
  for (let i = 1; i < b.length; i++) {
    if (color(b, i - 1) !== -1) continue;
    if (!above(b, i - 1, 'bodyLong', realBody(b, i - 1))) continue;
    if (color(b, i) !== 1) continue;
    if (!(b.o[i]! < b.l[i - 1]!)) continue;
    const eq = candleAverage(b, i - 1, 'equal');
    if (eq === null) continue;
    if (!(b.c[i]! > b.c[i - 1]! + eq)) continue;
    const mid = b.c[i - 1]! + realBody(b, i - 1) * 0.5;
    if (!(b.c[i]! <= mid)) continue;
    out.push(multi(b, i - 1, i, 'cdlthrusting', 'BEARISH'));
  }
  return out;
}

export function detectLadderBottom(b: Bars): CandlePattern[] {
  const out: CandlePattern[] = [];
  for (let i = 4; i < b.length; i++) {
    if (color(b, i - 4) !== -1 || color(b, i - 3) !== -1 || color(b, i - 2) !== -1) continue;
    if (!(b.o[i - 4]! > b.o[i - 3]! && b.o[i - 3]! > b.o[i - 2]!)) continue;
    if (!(b.c[i - 4]! > b.c[i - 3]! && b.c[i - 3]! > b.c[i - 2]!)) continue;
    if (color(b, i - 1) !== -1) continue;
    if (!above(b, i - 1, 'shadowVeryShort', upperShadow(b, i - 1))) continue;
    if (color(b, i) !== 1) continue;
    if (!(b.o[i]! > b.o[i - 1]!)) continue;
    if (!(b.c[i]! > b.h[i - 1]!)) continue;
    out.push(multi(b, i - 4, i, 'cdlladderbottom', 'BULLISH'));
  }
  return out;
}

export function detectMatHold(b: Bars, penetration = 0.5): CandlePattern[] {
  const out: CandlePattern[] = [];
  for (let i = 4; i < b.length; i++) {
    if (color(b, i - 4) !== 1 || color(b, i - 3) !== -1 || color(b, i) !== 1) continue;
    if (!(Math.min(b.o[i - 3]!, b.c[i - 3]!) > Math.max(b.o[i - 4]!, b.c[i - 4]!))) continue;
    const body4 = realBody(b, i - 4);
    const lim = b.c[i - 4]! - body4 * penetration;
    if (!(Math.min(b.o[i - 2]!, b.c[i - 2]!) < b.c[i - 4]!)) continue;
    if (!(Math.min(b.o[i - 1]!, b.c[i - 1]!) < b.c[i - 4]!)) continue;
    if (!(Math.min(b.o[i - 2]!, b.c[i - 2]!) > lim)) continue;
    if (!(Math.min(b.o[i - 1]!, b.c[i - 1]!) > lim)) continue;
    if (!(Math.max(b.c[i - 2]!, b.o[i - 2]!) < b.o[i - 3]!)) continue;
    if (!(Math.max(b.c[i - 1]!, b.o[i - 1]!) < Math.max(b.c[i - 2]!, b.o[i - 2]!))) continue;
    if (!(b.o[i]! > b.c[i - 1]!)) continue;
    if (!(b.c[i]! > Math.max(b.h[i - 3]!, Math.max(b.h[i - 2]!, b.h[i - 1]!)))) continue;
    if (!above(b, i - 4, 'bodyLong', body4)) continue;
    if (!below(b, i - 3, 'bodyShort', realBody(b, i - 3))) continue;
    if (!below(b, i - 2, 'bodyShort', realBody(b, i - 2))) continue;
    if (!below(b, i - 1, 'bodyShort', realBody(b, i - 1))) continue;
    out.push(multi(b, i - 4, i, 'cdlmathold', 'BULLISH'));
  }
  return out;
}

export function detectRiseFall3Methods(b: Bars): CandlePattern[] {
  const out: CandlePattern[] = [];
  for (let i = 4; i < b.length; i++) {
    const c4 = color(b, i - 4);
    const c3 = color(b, i - 3);
    const c2 = color(b, i - 2);
    const c1 = color(b, i - 1);
    const c0 = color(b, i);
    if (c4 === c3 || c3 !== c2 || c2 !== c1 || c1 === c0) continue;
    const hi4 = b.h[i - 4]!;
    const lo4 = b.l[i - 4]!;
    if (!(Math.min(b.o[i - 3]!, b.c[i - 3]!) < hi4 && Math.max(b.o[i - 3]!, b.c[i - 3]!) > lo4))
      continue;
    if (!(Math.min(b.o[i - 2]!, b.c[i - 2]!) < hi4 && Math.max(b.o[i - 2]!, b.c[i - 2]!) > lo4))
      continue;
    if (!(Math.min(b.o[i - 1]!, b.c[i - 1]!) < hi4 && Math.max(b.o[i - 1]!, b.c[i - 1]!) > lo4))
      continue;
    const dir = c4;
    if (!(b.c[i - 2]! * dir < b.c[i - 3]! * dir)) continue;
    if (!(b.c[i - 1]! * dir < b.c[i - 2]! * dir)) continue;
    if (!(b.o[i]! * dir > b.c[i - 1]! * dir)) continue;
    if (!(b.c[i]! * dir > b.c[i - 4]! * dir)) continue;
    if (!above(b, i - 4, 'bodyLong', realBody(b, i - 4))) continue;
    if (!below(b, i - 3, 'bodyShort', realBody(b, i - 3))) continue;
    if (!below(b, i - 2, 'bodyShort', realBody(b, i - 2))) continue;
    if (!below(b, i - 1, 'bodyShort', realBody(b, i - 1))) continue;
    if (!above(b, i, 'bodyLong', realBody(b, i))) continue;
    out.push(multi(b, i - 4, i, 'cdlrisefall3methods', c4 === 1 ? 'BULLISH' : 'BEARISH'));
  }
  return out;
}

export function detectTasukiGap(b: Bars): CandlePattern[] {
  const out: CandlePattern[] = [];
  for (let i = 2; i < b.length; i++) {
    const near = candleAverage(b, i - 1, 'near');
    if (near === null) continue;
    const gapUp = Math.min(b.o[i - 1]!, b.c[i - 1]!) > Math.max(b.o[i - 2]!, b.c[i - 2]!);
    const gapDown = Math.max(b.o[i - 1]!, b.c[i - 1]!) < Math.min(b.o[i - 2]!, b.c[i - 2]!);
    if (
      gapUp &&
      color(b, i - 1) === 1 &&
      color(b, i) === -1 &&
      b.o[i]! < b.c[i - 1]! &&
      b.o[i]! > b.o[i - 1]! &&
      b.c[i]! < b.o[i - 1]! &&
      b.c[i]! > Math.max(b.c[i - 2]!, b.o[i - 2]!) &&
      Math.abs(realBody(b, i - 1) - realBody(b, i)) < near
    ) {
      out.push(multi(b, i - 2, i, 'cdltasukigap', 'BULLISH'));
    } else if (
      gapDown &&
      color(b, i - 1) === -1 &&
      color(b, i) === 1 &&
      b.o[i]! < b.o[i - 1]! &&
      b.o[i]! > b.c[i - 1]! &&
      b.c[i]! > b.o[i - 1]! &&
      b.c[i]! < Math.min(b.c[i - 2]!, b.o[i - 2]!) &&
      Math.abs(realBody(b, i - 1) - realBody(b, i)) < near
    ) {
      out.push(multi(b, i - 2, i, 'cdltasukigap', 'BEARISH'));
    }
  }
  return out;
}

export function detectTriStar(b: Bars): CandlePattern[] {
  const out: CandlePattern[] = [];
  for (let i = 2; i < b.length; i++) {
    const thresh = candleAverage(b, i - 2, 'bodyDoji');
    if (thresh === null) continue;
    if (!(realBody(b, i - 2) <= thresh && realBody(b, i - 1) <= thresh && realBody(b, i) <= thresh))
      continue;
    const hi2 = Math.max(b.o[i - 2]!, b.c[i - 2]!);
    const lo2 = Math.min(b.o[i - 2]!, b.c[i - 2]!);
    const hi1 = Math.max(b.o[i - 1]!, b.c[i - 1]!);
    const lo1 = Math.min(b.o[i - 1]!, b.c[i - 1]!);
    const hi0 = Math.max(b.o[i]!, b.c[i]!);
    const lo0 = Math.min(b.o[i]!, b.c[i]!);
    if (lo1 > hi2 && hi0 < hi1) {
      out.push(multi(b, i - 2, i, 'cdltristar', 'BEARISH'));
    } else if (hi1 < lo2 && lo0 > lo1) {
      out.push(multi(b, i - 2, i, 'cdltristar', 'BULLISH'));
    }
  }
  return out;
}

export function detectUnique3River(b: Bars): CandlePattern[] {
  const out: CandlePattern[] = [];
  for (let i = 2; i < b.length; i++) {
    if (color(b, i - 2) !== -1 || color(b, i - 1) !== -1 || color(b, i) !== 1) continue;
    if (!(b.c[i - 1]! > b.c[i - 2]!)) continue;
    if (!(b.o[i - 1]! <= b.o[i - 2]!)) continue;
    if (!(b.l[i - 1]! < b.l[i - 2]!)) continue;
    if (!(b.o[i]! > b.l[i - 1]!)) continue;
    if (!above(b, i - 2, 'bodyLong', realBody(b, i - 2))) continue;
    if (!below(b, i, 'bodyShort', realBody(b, i))) continue;
    out.push(multi(b, i - 2, i, 'cdlunique3river', 'BULLISH'));
  }
  return out;
}

export function detectXSideGap3Methods(b: Bars): CandlePattern[] {
  const out: CandlePattern[] = [];
  for (let i = 2; i < b.length; i++) {
    const c2 = color(b, i - 2);
    const c1 = color(b, i - 1);
    const c0 = color(b, i);
    if (c2 !== c1 || c1 === c0) continue;
    const hi1 = Math.max(b.o[i - 1]!, b.c[i - 1]!);
    const lo1 = Math.min(b.o[i - 1]!, b.c[i - 1]!);
    if (!(b.o[i]! < hi1 && b.o[i]! > lo1)) continue;
    const hi2 = Math.max(b.o[i - 2]!, b.c[i - 2]!);
    const lo2 = Math.min(b.o[i - 2]!, b.c[i - 2]!);
    if (!(b.c[i]! < hi2 && b.c[i]! > lo2)) continue;
    const gapUp = Math.min(b.o[i - 1]!, b.c[i - 1]!) > Math.max(b.o[i - 2]!, b.c[i - 2]!);
    const gapDown = Math.max(b.o[i - 1]!, b.c[i - 1]!) < Math.min(b.o[i - 2]!, b.c[i - 2]!);
    if (!((c2 === 1 && gapUp) || (c2 === -1 && gapDown))) continue;
    out.push(multi(b, i - 2, i, 'cdlxsidegap3methods', c2 === 1 ? 'BULLISH' : 'BEARISH'));
  }
  return out;
}

/** Only the initial signal - TA-Lib's later "confirmation" re-signal is not modelled (see module doc). */
export function detectHikkake(b: Bars): CandlePattern[] {
  const out: CandlePattern[] = [];
  for (let i = 2; i < b.length; i++) {
    if (!(b.h[i - 1]! < b.h[i - 2]! && b.l[i - 1]! > b.l[i - 2]!)) continue;
    const bull = b.h[i]! < b.h[i - 1]! && b.l[i]! < b.l[i - 1]!;
    const bear = b.h[i]! > b.h[i - 1]! && b.l[i]! > b.l[i - 1]!;
    if (!bull && !bear) continue;
    out.push(multi(b, i - 2, i, 'cdlhikkake', bull ? 'BULLISH' : 'BEARISH'));
  }
  return out;
}

/** Only the initial signal - see `detectHikkake`. */
export function detectHikkakeMod(b: Bars): CandlePattern[] {
  const out: CandlePattern[] = [];
  for (let i = 3; i < b.length; i++) {
    if (!(b.h[i - 2]! < b.h[i - 3]! && b.l[i - 2]! > b.l[i - 3]!)) continue;
    if (!(b.h[i - 1]! < b.h[i - 2]! && b.l[i - 1]! > b.l[i - 2]!)) continue;
    const near = candleAverage(b, i - 2, 'near');
    if (near === null) continue;
    const bull =
      b.h[i]! < b.h[i - 1]! && b.l[i]! < b.l[i - 1]! && b.c[i - 2]! <= b.l[i - 2]! + near;
    const bear =
      b.h[i]! > b.h[i - 1]! && b.l[i]! > b.l[i - 1]! && b.c[i - 2]! >= b.h[i - 2]! - near;
    if (!bull && !bear) continue;
    out.push(multi(b, i - 3, i, 'cdlhikkakemod', bull ? 'BULLISH' : 'BEARISH'));
  }
  return out;
}
