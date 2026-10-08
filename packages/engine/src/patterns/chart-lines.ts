import type { Bars } from '../features/bars';
import { atr } from '../features/indicators';
import type { Swing } from '../features/types';
import {
  CHART_ATR_PERIOD,
  lineAt,
  lineIntersection,
  makeChartPattern,
  pivotWindows,
  pt,
  scanBreakout,
  scanDirectionalBreakout,
  slopeOf,
} from './chart-shared';
import type { ChartPattern } from './types';

/**
 * Chart patterns built on two fitted lines through the 4 (or 5, for broadening) pivots: triangles,
 * wedges, channels, the rectangle, and the broadening formation. Same family and verification
 * approach as `chart.ts` (no oracle, `IMPLEMENTED` not `VERIFIED` - see D54); see that file's
 * module doc for the shared conventions (pivot params, confirmation-after-last-pivot's-own-
 * confirmation).
 *
 * One assumption not spelled out in the catalog: `parallel_tolerance` (ascending/descending
 * channel) has no `_atr` suffix like every other threshold in this family, but is applied here as
 * ATR-scaled anyway (`parallel_tolerance * ATR`), for consistency with every other slope/price
 * tolerance in `catalog/patterns/chart.json` - flagged here per CLAUDE.md ("varsayım yaptıysan
 * açıkça yaz"), not verified against an external source.
 */

export function detectAscendingTriangle(b: Bars, swings: readonly Swing[]): ChartPattern[] {
  const a = atr(b, CHART_ATR_PERIOD);
  const out: ChartPattern[] = [];
  for (const [p1, p2, p3, p4] of pivotWindows(swings, ['HIGH', 'LOW', 'HIGH', 'LOW'])) {
    const atrP4 = a[p4!.formedIndex];
    if (atrP4 == null) continue;
    if (p4!.formedIndex - p1!.formedIndex > 150) continue;
    if (Math.abs(p1!.price - p3!.price) > 0.4 * atrP4) continue;
    if (p4!.price - p2!.price < 0.5 * atrP4) continue;
    const resistance = p3!.price;
    const lowA = pt(p2!);
    const lowB = pt(p4!);
    const breakoutIdx = scanBreakout(
      b,
      p4!.confirmedIndex + 1,
      (i) => b.c[i]! > resistance,
      (i) => b.c[i]! < lineAt(lowA, lowB, i),
    );
    if (breakoutIdx == null) continue;
    const height = resistance - p2!.price;
    out.push(
      makeChartPattern(
        'ascending_triangle',
        'BULLISH',
        [p1!, p2!, p3!, p4!],
        b,
        breakoutIdx,
        resistance,
        resistance + height,
        lineAt(lowA, lowB, breakoutIdx),
      ),
    );
  }
  return out;
}

export function detectDescendingTriangle(b: Bars, swings: readonly Swing[]): ChartPattern[] {
  const a = atr(b, CHART_ATR_PERIOD);
  const out: ChartPattern[] = [];
  for (const [p1, p2, p3, p4] of pivotWindows(swings, ['LOW', 'HIGH', 'LOW', 'HIGH'])) {
    const atrP4 = a[p4!.formedIndex];
    if (atrP4 == null) continue;
    if (p4!.formedIndex - p1!.formedIndex > 150) continue;
    if (Math.abs(p1!.price - p3!.price) > 0.4 * atrP4) continue;
    if (p2!.price - p4!.price < 0.5 * atrP4) continue;
    const support = p3!.price;
    const highA = pt(p2!);
    const highB = pt(p4!);
    const breakoutIdx = scanBreakout(
      b,
      p4!.confirmedIndex + 1,
      (i) => b.c[i]! < support,
      (i) => b.c[i]! > lineAt(highA, highB, i),
    );
    if (breakoutIdx == null) continue;
    const height = p2!.price - support;
    out.push(
      makeChartPattern(
        'descending_triangle',
        'BEARISH',
        [p1!, p2!, p3!, p4!],
        b,
        breakoutIdx,
        support,
        support - height,
        lineAt(highA, highB, breakoutIdx),
      ),
    );
  }
  return out;
}

export function detectSymmetricalTriangle(b: Bars, swings: readonly Swing[]): ChartPattern[] {
  const a = atr(b, CHART_ATR_PERIOD);
  const out: ChartPattern[] = [];
  for (const [p1, p2, p3, p4] of pivotWindows(swings, ['HIGH', 'LOW', 'HIGH', 'LOW'])) {
    const atrP4 = a[p4!.formedIndex];
    if (atrP4 == null) continue;
    if (p4!.formedIndex - p1!.formedIndex > 150) continue;
    const upperA = pt(p1!);
    const upperB = pt(p3!);
    const lowerA = pt(p2!);
    const lowerB = pt(p4!);
    const slopeUpper = slopeOf(upperA, upperB);
    const slopeLower = slopeOf(lowerA, lowerB);
    if (slopeUpper > -0.01 * atrP4 || slopeLower < 0.01 * atrP4) continue;
    const apex = lineIntersection(upperA, upperB, lowerA, lowerB);
    const brk = scanDirectionalBreakout(
      b,
      p4!.confirmedIndex + 1,
      (i) => b.c[i]! > lineAt(upperA, upperB, i),
      (i) => b.c[i]! < lineAt(lowerA, lowerB, i),
      (i) => apex != null && i >= apex,
    );
    if (brk == null) continue;
    const height = p1!.price - p2!.price;
    const ref =
      brk.direction === 'BULLISH'
        ? lineAt(upperA, upperB, brk.index)
        : lineAt(lowerA, lowerB, brk.index);
    const target = brk.direction === 'BULLISH' ? ref + height : ref - height;
    out.push(
      makeChartPattern(
        'symmetrical_triangle',
        brk.direction,
        [p1!, p2!, p3!, p4!],
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

export function detectRisingWedge(b: Bars, swings: readonly Swing[]): ChartPattern[] {
  const out: ChartPattern[] = [];
  for (const [p1, p2, p3, p4] of pivotWindows(swings, ['LOW', 'HIGH', 'LOW', 'HIGH'])) {
    if (p4!.formedIndex - p1!.formedIndex > 150) continue;
    const lowerA = pt(p1!);
    const lowerB = pt(p3!);
    const upperA = pt(p2!);
    const upperB = pt(p4!);
    const slopeLower = slopeOf(lowerA, lowerB);
    const slopeUpper = slopeOf(upperA, upperB);
    if (!(slopeLower > 0 && slopeUpper > 0 && slopeLower > slopeUpper)) continue;
    const breakoutIdx = scanBreakout(
      b,
      p4!.confirmedIndex + 1,
      (i) => b.c[i]! < lineAt(lowerA, lowerB, i),
      (i) => b.c[i]! > lineAt(upperA, upperB, i),
    );
    if (breakoutIdx == null) continue;
    out.push(
      makeChartPattern(
        'rising_wedge',
        'BEARISH',
        [p1!, p2!, p3!, p4!],
        b,
        breakoutIdx,
        lineAt(lowerA, lowerB, breakoutIdx),
        p1!.price,
        lineAt(upperA, upperB, breakoutIdx),
      ),
    );
  }
  return out;
}

export function detectFallingWedge(b: Bars, swings: readonly Swing[]): ChartPattern[] {
  const out: ChartPattern[] = [];
  for (const [p1, p2, p3, p4] of pivotWindows(swings, ['HIGH', 'LOW', 'HIGH', 'LOW'])) {
    if (p4!.formedIndex - p1!.formedIndex > 150) continue;
    const upperA = pt(p1!);
    const upperB = pt(p3!);
    const lowerA = pt(p2!);
    const lowerB = pt(p4!);
    const slopeUpper = slopeOf(upperA, upperB);
    const slopeLower = slopeOf(lowerA, lowerB);
    if (!(slopeUpper < 0 && slopeLower < 0 && slopeUpper < slopeLower)) continue;
    const breakoutIdx = scanBreakout(
      b,
      p4!.confirmedIndex + 1,
      (i) => b.c[i]! > lineAt(upperA, upperB, i),
      (i) => b.c[i]! < lineAt(lowerA, lowerB, i),
    );
    if (breakoutIdx == null) continue;
    out.push(
      makeChartPattern(
        'falling_wedge',
        'BULLISH',
        [p1!, p2!, p3!, p4!],
        b,
        breakoutIdx,
        lineAt(upperA, upperB, breakoutIdx),
        p1!.price,
        lineAt(lowerA, lowerB, breakoutIdx),
      ),
    );
  }
  return out;
}

export function detectAscendingChannel(b: Bars, swings: readonly Swing[]): ChartPattern[] {
  const a = atr(b, CHART_ATR_PERIOD);
  const out: ChartPattern[] = [];
  for (const [p1, p2, p3, p4] of pivotWindows(swings, ['LOW', 'HIGH', 'LOW', 'HIGH'])) {
    const atrP4 = a[p4!.formedIndex];
    if (atrP4 == null) continue;
    const lowerA = pt(p1!);
    const lowerB = pt(p3!);
    const upperA = pt(p2!);
    const upperB = pt(p4!);
    const slopeLower = slopeOf(lowerA, lowerB);
    const slopeUpper = slopeOf(upperA, upperB);
    if (!(slopeLower > 0 && slopeUpper > 0)) continue;
    if (Math.abs(slopeUpper - slopeLower) > 0.25 * atrP4) continue;
    const breakoutIdx = scanBreakout(
      b,
      p4!.confirmedIndex + 1,
      (i) => b.c[i]! < lineAt(lowerA, lowerB, i),
      () => false,
    );
    if (breakoutIdx == null) continue;
    out.push(
      makeChartPattern(
        'ascending_channel',
        'BEARISH',
        [p1!, p2!, p3!, p4!],
        b,
        breakoutIdx,
        lineAt(lowerA, lowerB, breakoutIdx),
        null,
        null,
      ),
    );
  }
  return out;
}

export function detectDescendingChannel(b: Bars, swings: readonly Swing[]): ChartPattern[] {
  const a = atr(b, CHART_ATR_PERIOD);
  const out: ChartPattern[] = [];
  for (const [p1, p2, p3, p4] of pivotWindows(swings, ['HIGH', 'LOW', 'HIGH', 'LOW'])) {
    const atrP4 = a[p4!.formedIndex];
    if (atrP4 == null) continue;
    const upperA = pt(p1!);
    const upperB = pt(p3!);
    const lowerA = pt(p2!);
    const lowerB = pt(p4!);
    const slopeUpper = slopeOf(upperA, upperB);
    const slopeLower = slopeOf(lowerA, lowerB);
    if (!(slopeUpper < 0 && slopeLower < 0)) continue;
    if (Math.abs(slopeUpper - slopeLower) > 0.25 * atrP4) continue;
    const breakoutIdx = scanBreakout(
      b,
      p4!.confirmedIndex + 1,
      (i) => b.c[i]! > lineAt(upperA, upperB, i),
      () => false,
    );
    if (breakoutIdx == null) continue;
    out.push(
      makeChartPattern(
        'descending_channel',
        'BULLISH',
        [p1!, p2!, p3!, p4!],
        b,
        breakoutIdx,
        lineAt(upperA, upperB, breakoutIdx),
        null,
        null,
      ),
    );
  }
  return out;
}

export function detectRectangle(b: Bars, swings: readonly Swing[]): ChartPattern[] {
  const a = atr(b, CHART_ATR_PERIOD);
  const out: ChartPattern[] = [];
  for (const [p1, p2, p3, p4] of pivotWindows(swings, ['HIGH', 'LOW', 'HIGH', 'LOW'])) {
    const atrP4 = a[p4!.formedIndex];
    if (atrP4 == null) continue;
    if (p4!.formedIndex - p1!.formedIndex > 200) continue;
    if (Math.abs(p1!.price - p3!.price) > 0.4 * atrP4) continue;
    if (Math.abs(p2!.price - p4!.price) > 0.4 * atrP4) continue;
    const top = p3!.price;
    const bottom = p4!.price;
    if (top - bottom < 1.5 * atrP4) continue;
    const brk = scanDirectionalBreakout(
      b,
      p4!.confirmedIndex + 1,
      (i) => b.c[i]! > top,
      (i) => b.c[i]! < bottom,
      () => false,
    );
    if (brk == null) continue;
    const height = top - bottom;
    const ref = brk.direction === 'BULLISH' ? top : bottom;
    const target = brk.direction === 'BULLISH' ? top + height : bottom - height;
    out.push(
      makeChartPattern(
        'rectangle',
        brk.direction,
        [p1!, p2!, p3!, p4!],
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

export function detectBroadening(b: Bars, swings: readonly Swing[]): ChartPattern[] {
  const a = atr(b, CHART_ATR_PERIOD);
  const out: ChartPattern[] = [];
  for (const [p1, p2, p3, p4, p5] of pivotWindows(swings, ['HIGH', 'LOW', 'HIGH', 'LOW', 'HIGH'])) {
    if (a[p5!.formedIndex] == null) continue;
    if (!(p3!.price > p1!.price && p5!.price > p3!.price)) continue;
    if (!(p4!.price < p2!.price)) continue;
    const upperA = pt(p3!);
    const upperB = pt(p5!);
    const lowerA = pt(p2!);
    const lowerB = pt(p4!);
    const brk = scanDirectionalBreakout(
      b,
      p5!.confirmedIndex + 1,
      (i) => b.c[i]! > lineAt(upperA, upperB, i),
      (i) => b.c[i]! < lineAt(lowerA, lowerB, i),
      () => false,
    );
    if (brk == null) continue;
    const ref =
      brk.direction === 'BULLISH'
        ? lineAt(upperA, upperB, brk.index)
        : lineAt(lowerA, lowerB, brk.index);
    out.push(
      makeChartPattern(
        'broadening',
        brk.direction,
        [p1!, p2!, p3!, p4!, p5!],
        b,
        brk.index,
        ref,
        null,
        null,
      ),
    );
  }
  return out;
}
