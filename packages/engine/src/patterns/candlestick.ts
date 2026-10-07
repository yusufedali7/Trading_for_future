import type { Bars } from '../features/bars';
import { above, below, isBullish, lowerShadow, realBody, upperShadow } from './candle-classify';
import type { CandlePattern } from './types';

/**
 * TA-Lib candlestick patterns (BSD), reimplemented from the public rules and checked against a
 * recorded TA-Lib run (`tools/oracle/talib_candles.py`,
 * `packages/engine/test/fixtures/SYNTHETIC_candlestick_oracle.json`). Only the three patterns
 * below are implemented so far (`catalog/patterns/candlestick.json` has 61; the rest are still
 * `TO_IMPLEMENT`) - these three have no trend-context dependency, so a faithful, exact port was
 * realistic to verify; the others (e.g. CDLHAMMER's uptrend/downtrend lookback) are not yet
 * confidently reproduced and are left for a later pass rather than guessed at.
 */

const single = (
  b: Bars,
  i: number,
  patternId: string,
  direction: CandlePattern['direction'],
): CandlePattern => ({
  id: `${patternId}:v1:${b.t[i]}`,
  patternId,
  defVersion: 'v1',
  direction,
  formedAt: b.t[i]!,
  formedIndex: i,
  confirmedAt: b.end[i]!,
  confirmedIndex: i,
});

/** Real body under 10% of the average high-low range of the 10 prior bars. */
export function detectDoji(b: Bars): CandlePattern[] {
  const out: CandlePattern[] = [];
  for (let i = 0; i < b.length; i++) {
    if (below(b, i, 'bodyDoji', realBody(b, i))) out.push(single(b, i, 'cdldoji', null));
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
  const color = (i: number) => (b.c[i]! >= b.o[i]! ? 1 : -1);
  const out: CandlePattern[] = [];
  for (let i = 1; i < b.length; i++) {
    if (color(i) === color(i - 1)) continue;
    const hi = Math.max(b.o[i]!, b.c[i]!);
    const lo = Math.min(b.o[i]!, b.c[i]!);
    const prevHi = Math.max(b.o[i - 1]!, b.c[i - 1]!);
    const prevLo = Math.min(b.o[i - 1]!, b.c[i - 1]!);
    if (hi >= prevHi && lo <= prevLo && (hi > prevHi || lo < prevLo)) {
      out.push({
        id: `cdlengulfing:v1:${b.t[i]}`,
        patternId: 'cdlengulfing',
        defVersion: 'v1',
        direction: isBullish(b, i) ? 'BULLISH' : 'BEARISH',
        formedAt: b.t[i - 1]!,
        formedIndex: i - 1,
        confirmedAt: b.end[i]!,
        confirmedIndex: i,
      });
    }
  }
  return out;
}
