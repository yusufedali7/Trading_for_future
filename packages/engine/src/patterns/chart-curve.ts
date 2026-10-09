import type { Bars } from '../features/bars';
import { atr } from '../features/indicators';
import type { Swing } from '../features/types';
import {
  CHART_ATR_PERIOD,
  lineAt,
  makeChartPattern,
  pivotWindows,
  pt,
  roundness,
  scanBreakout,
  scanDirectionalBreakout,
} from './chart-shared';
import type { ChartPattern } from './types';

/**
 * Cup and Handle, Rounding Bottom, and Diamond - the catalog's lowest-confidence chart patterns
 * (`definition_confidence: "low"` for all three in `catalog/patterns/chart.json`, which is
 * explicit that "roundness" has no agreed formula). D57 picked a parabola least-squares fit
 * (`roundness()` in `chart-shared.ts`) after asking the user how to resolve this - not a
 * validated definition, a documented judgment call for an admittedly subjective measure. Same
 * family/verification convention as `chart.ts`/`chart-lines.ts`/`chart-continuation.ts`
 * (`IMPLEMENTED` not `VERIFIED`, no oracle exists for this family).
 */

export function detectCupAndHandle(b: Bars, swings: readonly Swing[]): ChartPattern[] {
  const a = atr(b, CHART_ATR_PERIOD);
  const out: ChartPattern[] = [];
  for (const [p1, p2, p3, p4] of pivotWindows(swings, ['HIGH', 'LOW', 'HIGH', 'LOW'])) {
    const atrP4 = a[p4!.formedIndex];
    if (atrP4 == null) continue;
    if (p3!.formedIndex - p1!.formedIndex < 30) continue; // min_cup_bars
    if (Math.abs(p1!.price - p3!.price) > 0.8 * atrP4) continue; // rim_tolerance_atr
    const rim = Math.max(p1!.price, p3!.price);
    const cupDepth = rim - p2!.price;
    if (cupDepth <= 0) continue;
    if (p3!.price - p4!.price > 0.5 * cupDepth) continue; // max_handle_retrace
    const shape = roundness(b, p1!.formedIndex, p3!.formedIndex);
    if (shape.a <= 0 || shape.r2 < 0.6) continue; // roundness_min, opening upward
    const breakoutIdx = scanBreakout(
      b,
      p4!.confirmedIndex + 1,
      (i) => b.c[i]! > rim,
      (i) => b.c[i]! < p4!.price,
    );
    if (breakoutIdx == null) continue;
    out.push(
      makeChartPattern(
        'cup_and_handle',
        'BULLISH',
        [p1!, p2!, p3!, p4!],
        b,
        breakoutIdx,
        rim,
        rim + cupDepth,
        p4!.price,
      ),
    );
  }
  return out;
}

export function detectRoundingBottom(b: Bars, swings: readonly Swing[]): ChartPattern[] {
  const out: ChartPattern[] = [];
  for (const [p1, p2, p3] of pivotWindows(swings, ['HIGH', 'LOW', 'HIGH'])) {
    if (p3!.formedIndex - p1!.formedIndex < 40) continue; // min_bars
    const shape = roundness(b, p1!.formedIndex, p3!.formedIndex);
    if (shape.a <= 0 || shape.r2 < 0.7) continue; // roundness_min, opening upward
    const rim = p3!.price;
    const breakoutIdx = scanBreakout(
      b,
      p3!.confirmedIndex + 1,
      (i) => b.c[i]! > rim,
      () => false,
    );
    if (breakoutIdx == null) continue;
    const height = rim - p2!.price;
    out.push(
      makeChartPattern(
        'rounding_bottom',
        'BULLISH',
        [p1!, p2!, p3!],
        b,
        breakoutIdx,
        rim,
        rim + height,
        null,
      ),
    );
  }
  return out;
}

export function detectDiamond(b: Bars, swings: readonly Swing[]): ChartPattern[] {
  const a = atr(b, CHART_ATR_PERIOD);
  const out: ChartPattern[] = [];
  for (const [p1, p2, p3, p4, p5, p6] of pivotWindows(swings, [
    'HIGH',
    'LOW',
    'HIGH',
    'LOW',
    'HIGH',
    'LOW',
  ])) {
    if (a[p6!.formedIndex] == null) continue;
    if (p6!.formedIndex - p1!.formedIndex > 120) continue;
    const spread1 = p1!.price - p2!.price;
    const spread2 = p3!.price - p4!.price;
    const spread3 = p5!.price - p6!.price;
    if (!(spread2 > spread1 && spread3 < spread2)) continue; // broadening, then contracting
    const upperA = pt(p3!);
    const upperB = pt(p5!);
    const lowerA = pt(p4!);
    const lowerB = pt(p6!);
    const brk = scanDirectionalBreakout(
      b,
      p6!.confirmedIndex + 1,
      (i) => b.c[i]! > lineAt(upperA, upperB, i),
      (i) => b.c[i]! < lineAt(lowerA, lowerB, i),
      () => false,
    );
    if (brk == null) continue;
    const maxWidth = Math.max(spread1, spread2, spread3);
    const ref =
      brk.direction === 'BULLISH'
        ? lineAt(upperA, upperB, brk.index)
        : lineAt(lowerA, lowerB, brk.index);
    const target = brk.direction === 'BULLISH' ? ref + maxWidth : ref - maxWidth;
    out.push(
      makeChartPattern(
        'diamond',
        brk.direction,
        [p1!, p2!, p3!, p4!, p5!, p6!],
        b,
        brk.index,
        ref,
        target,
        null,
      ),
    );
  }
  return out;
}
