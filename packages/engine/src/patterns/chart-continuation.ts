import type { Bars } from '../features/bars';
import { atr } from '../features/indicators';
import type { Swing } from '../features/types';
import {
  CHART_ATR_PERIOD,
  lineAt,
  makeChartPattern,
  pivotWindows,
  pt,
  scanBreakout,
} from './chart-shared';
import type { ChartPattern } from './types';

/**
 * Bull/bear flag and pennant - a sharp "pole" move followed by a brief consolidation. Same
 * family and verification approach as `chart.ts`/`chart-lines.ts` (no oracle, `IMPLEMENTED` not
 * `VERIFIED` - D54/D55).
 *
 * **Assumption, not spelled out in the catalog (flagged per CLAUDE.md "varsayım yaptıysan açıkça
 * yaz"):** the catalog only gives 3 pivots for a flag (pole-start, pole-end, one flag pivot) and
 * 4 for a pennant (pole-start, pole-end, two tiny-triangle pivots) - one short of the two pivots
 * per side a real two-line channel/triangle needs (contrast `chart-lines.ts`'s 4-pivot families,
 * which always had exactly 2 points per line). Interpreted literally from the catalog's own field
 * names: `flag_upper_line`/`flag_lower_line`/`triangle_line` (bar-dependent, i.e. a line) is built
 * from the pole's end pivot and the one flag/triangle pivot on the *breakout* side; the opposite
 * side (`flag_low`/`flag_high`, not "line") is read as a flat invalidation level at that one flag
 * pivot's price. Not verified against an external source - a reasonable single-line reading of an
 * under-specified definition, not a confirmed rule.
 */

const MIN_POLE_ATR = 3.0;
const MAX_POLE_BARS = 15;
const MAX_FLAG_RETRACE = 0.5;
const MAX_FLAG_BARS = 25;

export function detectBullFlag(b: Bars, swings: readonly Swing[]): ChartPattern[] {
  const a = atr(b, CHART_ATR_PERIOD);
  const out: ChartPattern[] = [];
  for (const [p1, p2, p3] of pivotWindows(swings, ['LOW', 'HIGH', 'LOW'])) {
    const atrP2 = a[p2!.formedIndex];
    if (atrP2 == null) continue;
    const poleBars = p2!.formedIndex - p1!.formedIndex;
    const poleRise = p2!.price - p1!.price;
    if (poleBars > MAX_POLE_BARS || poleRise < MIN_POLE_ATR * atrP2) continue;
    if (p3!.formedIndex - p2!.formedIndex > MAX_FLAG_BARS) continue;
    if (p2!.price - p3!.price > MAX_FLAG_RETRACE * poleRise) continue;
    const upperA = pt(p2!);
    const upperB = pt(p3!);
    const flagLow = p3!.price;
    const breakoutIdx = scanBreakout(
      b,
      p3!.confirmedIndex + 1,
      (i) => b.c[i]! > lineAt(upperA, upperB, i),
      (i) => b.c[i]! < flagLow,
    );
    if (breakoutIdx == null) continue;
    const ref = lineAt(upperA, upperB, breakoutIdx);
    out.push(
      makeChartPattern(
        'bull_flag',
        'BULLISH',
        [p1!, p2!, p3!],
        b,
        breakoutIdx,
        ref,
        ref + poleRise,
        flagLow,
      ),
    );
  }
  return out;
}

export function detectBearFlag(b: Bars, swings: readonly Swing[]): ChartPattern[] {
  const a = atr(b, CHART_ATR_PERIOD);
  const out: ChartPattern[] = [];
  for (const [p1, p2, p3] of pivotWindows(swings, ['HIGH', 'LOW', 'HIGH'])) {
    const atrP2 = a[p2!.formedIndex];
    if (atrP2 == null) continue;
    const poleBars = p2!.formedIndex - p1!.formedIndex;
    const poleDrop = p1!.price - p2!.price;
    if (poleBars > MAX_POLE_BARS || poleDrop < MIN_POLE_ATR * atrP2) continue;
    if (p3!.formedIndex - p2!.formedIndex > MAX_FLAG_BARS) continue;
    if (p3!.price - p2!.price > MAX_FLAG_RETRACE * poleDrop) continue;
    const lowerA = pt(p2!);
    const lowerB = pt(p3!);
    const flagHigh = p3!.price;
    const breakoutIdx = scanBreakout(
      b,
      p3!.confirmedIndex + 1,
      (i) => b.c[i]! < lineAt(lowerA, lowerB, i),
      (i) => b.c[i]! > flagHigh,
    );
    if (breakoutIdx == null) continue;
    const ref = lineAt(lowerA, lowerB, breakoutIdx);
    out.push(
      makeChartPattern(
        'bear_flag',
        'BEARISH',
        [p1!, p2!, p3!],
        b,
        breakoutIdx,
        ref,
        ref - poleDrop,
        flagHigh,
      ),
    );
  }
  return out;
}

/** Only the bullish-pole shape (`L,H,L,H`) exists in the catalog - see module doc. */
export function detectPennant(b: Bars, swings: readonly Swing[]): ChartPattern[] {
  const a = atr(b, CHART_ATR_PERIOD);
  const out: ChartPattern[] = [];
  for (const [p1, p2, p3, p4] of pivotWindows(swings, ['LOW', 'HIGH', 'LOW', 'HIGH'])) {
    if (a[p2!.formedIndex] == null) continue;
    const poleBars = p2!.formedIndex - p1!.formedIndex;
    const poleHeight = p2!.price - p1!.price;
    if (poleBars > MAX_POLE_BARS || poleHeight <= 0) continue;
    if (p4!.formedIndex - p1!.formedIndex > MAX_POLE_BARS + MAX_FLAG_BARS) continue;
    const triangleHeight = p2!.price - p3!.price;
    if (triangleHeight <= 0 || triangleHeight >= 0.5 * poleHeight) continue;
    if (p4!.price >= p2!.price) continue; // the upper line must narrow, not widen
    const upperA = pt(p2!);
    const upperB = pt(p4!);
    const triangleLow = p3!.price;
    const breakoutIdx = scanBreakout(
      b,
      p4!.confirmedIndex + 1,
      (i) => b.c[i]! > lineAt(upperA, upperB, i),
      (i) => b.c[i]! < triangleLow,
    );
    if (breakoutIdx == null) continue;
    const ref = lineAt(upperA, upperB, breakoutIdx);
    out.push(
      makeChartPattern(
        'pennant',
        'BULLISH',
        [p1!, p2!, p3!, p4!],
        b,
        breakoutIdx,
        ref,
        ref + poleHeight,
        triangleLow,
      ),
    );
  }
  return out;
}
