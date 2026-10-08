import type { Bars } from './bars';
import type { Displacement, DisplacementParams } from './types';

export const DISPLACEMENT_DEFAULTS: DisplacementParams = { minBodyAtr: 1.5, atrPeriod: 14 };

/** Vs. the previous close for bar 0's neighbours; bar 0 uses its own high-low. */
function trueRange(b: Bars, i: number): number {
  if (i === 0) return b.h[0]! - b.l[0]!;
  const prevClose = b.c[i - 1]!;
  return Math.max(b.h[i]! - b.l[i]!, Math.abs(b.h[i]! - prevClose), Math.abs(b.l[i]! - prevClose));
}

/**
 * Displacement, definition v1 (docs/definitions/displacement-v1.md). A bar whose real body
 * exceeds `minBodyAtr` x the simple average true range of the `atrPeriod` bars strictly before
 * it (never including the bar itself, matching the trailing-average convention already used for
 * candlestick thresholds in patterns/candle-classify.ts). Single-bar only: the catalog's
 * alternative "or a run of bars" is not modelled in v1.
 */
export function detectDisplacement(
  b: Bars,
  p: DisplacementParams = DISPLACEMENT_DEFAULTS,
): Displacement[] {
  const { minBodyAtr, atrPeriod } = p;
  const out: Displacement[] = [];
  for (let i = atrPeriod; i < b.length; i++) {
    let sum = 0;
    for (let k = i - atrPeriod; k < i; k++) sum += trueRange(b, k);
    const avgAtr = sum / atrPeriod;
    const body = Math.abs(b.c[i]! - b.o[i]!);
    if (body > minBodyAtr * avgAtr) {
      out.push({
        id: `DISPLACEMENT:v1:${b.t[i]}`,
        defVersion: 'v1',
        type: 'DISPLACEMENT',
        direction: b.c[i]! >= b.o[i]! ? 'BULLISH' : 'BEARISH',
        body,
        atr: avgAtr,
        formedAt: b.t[i]!,
        formedIndex: i,
        confirmedAt: b.end[i]!,
        confirmedIndex: i,
      });
    }
  }
  return out;
}
