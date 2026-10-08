import type { Bars } from '../features/bars';
import { atr } from '../features/indicators';
import type { Swing } from '../features/types';
import {
  CHART_ATR_PERIOD,
  lineAt,
  makeChartPattern,
  pivotWindows,
  scanBreakout,
} from './chart-shared';
import type { ChartPattern } from './types';

/**
 * Chart (price-action) reversal patterns, catalog `catalog/patterns/chart.json`. Unlike the
 * candlestick family these have no TA-Lib-equivalent oracle; rules are ported directly from the
 * catalog (itself sourced from Bulkowski's Encyclopedia of Chart Patterns) and checked with
 * synthetic positive/negative fixtures, a no-lookahead test, and a real-data frequency sanity
 * check - no independent library cross-check exists, so catalog status is `IMPLEMENTED`, not
 * `VERIFIED` (same convention as the SMC concepts in `features/smc.ts`, which also have no
 * oracle).
 *
 * Pivots come from the M4 swing engine (v1), but with the catalog's own `left=right=5` setting,
 * not the chart's default 3/3 - callers compute `detectSwings(bars, CHART_PIVOT_PARAMS)` once and
 * pass the result in, shared across every detector in this family. A pivot window is only
 * checked for shape once its *last* pivot is
 * confirmed, and the breakout/invalidation scan starts strictly after that bar: this mirrors
 * `features/structure.ts`'s identical "a swing is usable only from the bar after its own
 * confirmation" convention, so a breakout that technically happened earlier (in the pivot's
 * still-unconfirmed 5-bar window) is not retroactively detected - simpler and consistent with the
 * rest of the engine, at the cost of occasionally missing an early breakout (documented, not a
 * bug).
 */

export function detectDoubleTop(b: Bars, swings: readonly Swing[]): ChartPattern[] {
  const a = atr(b, CHART_ATR_PERIOD);
  const out: ChartPattern[] = [];
  for (const [p1, p2, p3] of pivotWindows(swings, ['HIGH', 'LOW', 'HIGH'])) {
    const atrP3 = a[p3!.formedIndex];
    if (atrP3 == null) continue;
    const gap = p3!.formedIndex - p1!.formedIndex;
    if (gap < 10 || gap > 120) continue;
    if (Math.abs(p1!.price - p3!.price) > 0.5 * atrP3) continue;
    if (Math.min(p1!.price, p3!.price) - p2!.price < 2.0 * atrP3) continue;
    const neckline = p2!.price;
    const invalidLevel = Math.max(p1!.price, p3!.price);
    const breakoutIdx = scanBreakout(
      b,
      p3!.confirmedIndex + 1,
      (i) => b.c[i]! < neckline,
      (i) => b.c[i]! > invalidLevel,
    );
    if (breakoutIdx == null) continue;
    const height = invalidLevel - p2!.price;
    out.push(
      makeChartPattern(
        'double_top',
        'BEARISH',
        [p1!, p2!, p3!],
        b,
        breakoutIdx,
        neckline,
        neckline - height,
        invalidLevel,
      ),
    );
  }
  return out;
}

export function detectDoubleBottom(b: Bars, swings: readonly Swing[]): ChartPattern[] {
  const a = atr(b, CHART_ATR_PERIOD);
  const out: ChartPattern[] = [];
  for (const [p1, p2, p3] of pivotWindows(swings, ['LOW', 'HIGH', 'LOW'])) {
    const atrP3 = a[p3!.formedIndex];
    if (atrP3 == null) continue;
    const gap = p3!.formedIndex - p1!.formedIndex;
    if (gap < 10 || gap > 120) continue;
    if (Math.abs(p1!.price - p3!.price) > 0.5 * atrP3) continue;
    if (p2!.price - Math.max(p1!.price, p3!.price) < 2.0 * atrP3) continue;
    const neckline = p2!.price;
    const invalidLevel = Math.min(p1!.price, p3!.price);
    const breakoutIdx = scanBreakout(
      b,
      p3!.confirmedIndex + 1,
      (i) => b.c[i]! > neckline,
      (i) => b.c[i]! < invalidLevel,
    );
    if (breakoutIdx == null) continue;
    const height = p2!.price - invalidLevel;
    out.push(
      makeChartPattern(
        'double_bottom',
        'BULLISH',
        [p1!, p2!, p3!],
        b,
        breakoutIdx,
        neckline,
        neckline + height,
        invalidLevel,
      ),
    );
  }
  return out;
}

export function detectTripleTop(b: Bars, swings: readonly Swing[]): ChartPattern[] {
  const a = atr(b, CHART_ATR_PERIOD);
  const out: ChartPattern[] = [];
  for (const [p1, p2, p3, p4, p5] of pivotWindows(swings, ['HIGH', 'LOW', 'HIGH', 'LOW', 'HIGH'])) {
    const atrP5 = a[p5!.formedIndex];
    if (atrP5 == null) continue;
    if (p5!.formedIndex - p1!.formedIndex > 200) continue;
    const peaks = [p1!.price, p3!.price, p5!.price];
    const troughs = [p2!.price, p4!.price];
    if (Math.max(...peaks) - Math.min(...peaks) > 0.6 * atrP5) continue;
    if (Math.min(...peaks) - Math.max(...troughs) < 1.5 * atrP5) continue;
    const support = Math.min(...troughs);
    const invalidLevel = Math.max(...peaks);
    const breakoutIdx = scanBreakout(
      b,
      p5!.confirmedIndex + 1,
      (i) => b.c[i]! < support,
      (i) => b.c[i]! > invalidLevel,
    );
    if (breakoutIdx == null) continue;
    const height = invalidLevel - Math.max(...troughs);
    out.push(
      makeChartPattern(
        'triple_top',
        'BEARISH',
        [p1!, p2!, p3!, p4!, p5!],
        b,
        breakoutIdx,
        support,
        support - height,
        invalidLevel,
      ),
    );
  }
  return out;
}

export function detectTripleBottom(b: Bars, swings: readonly Swing[]): ChartPattern[] {
  const a = atr(b, CHART_ATR_PERIOD);
  const out: ChartPattern[] = [];
  for (const [p1, p2, p3, p4, p5] of pivotWindows(swings, ['LOW', 'HIGH', 'LOW', 'HIGH', 'LOW'])) {
    const atrP5 = a[p5!.formedIndex];
    if (atrP5 == null) continue;
    if (p5!.formedIndex - p1!.formedIndex > 200) continue;
    const troughs = [p1!.price, p3!.price, p5!.price];
    const peaks = [p2!.price, p4!.price];
    if (Math.max(...troughs) - Math.min(...troughs) > 0.6 * atrP5) continue;
    if (Math.min(...peaks) - Math.max(...troughs) < 1.5 * atrP5) continue;
    const resistance = Math.max(...peaks);
    const invalidLevel = Math.min(...troughs);
    const breakoutIdx = scanBreakout(
      b,
      p5!.confirmedIndex + 1,
      (i) => b.c[i]! > resistance,
      (i) => b.c[i]! < invalidLevel,
    );
    if (breakoutIdx == null) continue;
    const height = Math.min(...peaks) - invalidLevel;
    out.push(
      makeChartPattern(
        'triple_bottom',
        'BULLISH',
        [p1!, p2!, p3!, p4!, p5!],
        b,
        breakoutIdx,
        resistance,
        resistance + height,
        invalidLevel,
      ),
    );
  }
  return out;
}

export function detectHeadShouldersTop(b: Bars, swings: readonly Swing[]): ChartPattern[] {
  const a = atr(b, CHART_ATR_PERIOD);
  const out: ChartPattern[] = [];
  for (const [p1, p2, p3, p4, p5] of pivotWindows(swings, ['HIGH', 'LOW', 'HIGH', 'LOW', 'HIGH'])) {
    const atrP5 = a[p5!.formedIndex];
    if (atrP5 == null) continue;
    if (p5!.formedIndex - p1!.formedIndex > 200) continue;
    if (p3!.price < Math.max(p1!.price, p5!.price) + 0.5 * atrP5) continue;
    if (Math.abs(p1!.price - p5!.price) > 1.0 * atrP5) continue;
    const neck2 = { index: p2!.formedIndex, price: p2!.price };
    const neck4 = { index: p4!.formedIndex, price: p4!.price };
    const slope = (p4!.price - p2!.price) / (p4!.formedIndex - p2!.formedIndex);
    if (Math.abs(slope) > 0.05 * atrP5) continue;
    const invalidLevel = p5!.price;
    const breakoutIdx = scanBreakout(
      b,
      p5!.confirmedIndex + 1,
      (i) => b.c[i]! < lineAt(neck2, neck4, i),
      (i) => b.c[i]! > invalidLevel,
    );
    if (breakoutIdx == null) continue;
    const necklineAtBreakout = lineAt(neck2, neck4, breakoutIdx);
    const height = p3!.price - lineAt(neck2, neck4, p3!.formedIndex);
    out.push(
      makeChartPattern(
        'head_shoulders_top',
        'BEARISH',
        [p1!, p2!, p3!, p4!, p5!],
        b,
        breakoutIdx,
        necklineAtBreakout,
        necklineAtBreakout - height,
        invalidLevel,
      ),
    );
  }
  return out;
}

export function detectHeadShouldersBottom(b: Bars, swings: readonly Swing[]): ChartPattern[] {
  const a = atr(b, CHART_ATR_PERIOD);
  const out: ChartPattern[] = [];
  for (const [p1, p2, p3, p4, p5] of pivotWindows(swings, ['LOW', 'HIGH', 'LOW', 'HIGH', 'LOW'])) {
    const atrP5 = a[p5!.formedIndex];
    if (atrP5 == null) continue;
    if (p5!.formedIndex - p1!.formedIndex > 200) continue;
    if (p3!.price > Math.min(p1!.price, p5!.price) - 0.5 * atrP5) continue;
    if (Math.abs(p1!.price - p5!.price) > 1.0 * atrP5) continue;
    const neck2 = { index: p2!.formedIndex, price: p2!.price };
    const neck4 = { index: p4!.formedIndex, price: p4!.price };
    const slope = (p4!.price - p2!.price) / (p4!.formedIndex - p2!.formedIndex);
    if (Math.abs(slope) > 0.05 * atrP5) continue;
    const invalidLevel = p5!.price;
    const breakoutIdx = scanBreakout(
      b,
      p5!.confirmedIndex + 1,
      (i) => b.c[i]! > lineAt(neck2, neck4, i),
      (i) => b.c[i]! < invalidLevel,
    );
    if (breakoutIdx == null) continue;
    const necklineAtBreakout = lineAt(neck2, neck4, breakoutIdx);
    const height = lineAt(neck2, neck4, p3!.formedIndex) - p3!.price;
    out.push(
      makeChartPattern(
        'head_shoulders_bottom',
        'BULLISH',
        [p1!, p2!, p3!, p4!, p5!],
        b,
        breakoutIdx,
        necklineAtBreakout,
        necklineAtBreakout + height,
        invalidLevel,
      ),
    );
  }
  return out;
}
