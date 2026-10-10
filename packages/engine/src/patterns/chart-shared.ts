import type { Bars } from '../features/bars';
import type { SwingParams } from '../features/types';
import type { Swing } from '../features/types';
import type { ChartPattern, ChartPatternPivot } from './types';

/** The catalog's pivot settings for every chart pattern (not the swing engine's own 3/3 default). */
export const CHART_PIVOT_PARAMS: SwingParams = { left: 5, right: 5 };
export const CHART_ATR_PERIOD = 14;

function orderedSwings(swings: readonly Swing[]): Swing[] {
  return [...swings].sort((x, y) => x.formedIndex - y.formedIndex);
}

/** Every consecutive run of `kinds.length` swings (in formation order) whose kinds match exactly. */
export function pivotWindows(
  swings: readonly Swing[],
  kinds: readonly ('HIGH' | 'LOW')[],
): Swing[][] {
  const sorted = orderedSwings(swings);
  const out: Swing[][] = [];
  for (let i = 0; i + kinds.length <= sorted.length; i++) {
    const window = sorted.slice(i, i + kinds.length);
    if (window.every((s, k) => s.kind === kinds[k])) out.push(window);
  }
  return out;
}

/**
 * Scans forward from `from` for the first bar whose close trips `invalid` or `confirm` (CLAUDE.md
 * rule 3: nothing here is knowable before a bar closes). Invalid wins a same-bar tie - a candidate
 * that breaks its invalidation level is dead even if the confirmation level is also hit. Returns
 * the triggering bar index, or null if neither happens before the data ends (an unconfirmed
 * candidate is not a result - CLAUDE.md rule 1/"aday" convention).
 */
export function scanBreakout(
  b: Bars,
  from: number,
  confirm: (i: number) => boolean,
  invalid: (i: number) => boolean,
): number | null {
  for (let i = from; i < b.length; i++) {
    if (invalid(i)) return null;
    if (confirm(i)) return i;
  }
  return null;
}

export type LinePoint = { index: number; price: number };

/** A swing's bar index and price as a plain `{ index, price }` line point. */
export function pt(s: Swing): LinePoint {
  return { index: s.formedIndex, price: s.price };
}

/** Price change per bar of the line through `p1`/`p2`. */
export function slopeOf(p1: LinePoint, p2: LinePoint): number {
  return p2.index === p1.index ? 0 : (p2.price - p1.price) / (p2.index - p1.index);
}

/** Value of the line through `p1`/`p2` (by bar index) at bar `i`; flat if they share an index. */
export function lineAt(p1: LinePoint, p2: LinePoint, i: number): number {
  return p1.price + slopeOf(p1, p2) * (i - p1.index);
}

/**
 * The (fractional) bar index where line A (through `a1`/`a2`) crosses line B (through `b1`/`b2`) -
 * a symmetrical triangle's apex. Null if the lines are parallel (never cross).
 */
export function lineIntersection(
  a1: LinePoint,
  a2: LinePoint,
  b1: LinePoint,
  b2: LinePoint,
): number | null {
  const sa = slopeOf(a1, a2);
  const sb = slopeOf(b1, b2);
  if (sa === sb) return null;
  const ca = a1.price - sa * a1.index;
  const cb = b1.price - sb * b1.index;
  return (cb - ca) / (sa - sb);
}

/**
 * Like `scanBreakout`, but for patterns whose breakout can go either way (triangle/rectangle/
 * broadening): checks `invalid`, then `up` (BULLISH), then `down` (BEARISH), in that order per
 * bar. Null if neither side ever breaks before the data ends.
 */
export function scanDirectionalBreakout(
  b: Bars,
  from: number,
  up: (i: number) => boolean,
  down: (i: number) => boolean,
  invalid: (i: number) => boolean,
): { index: number; direction: 'BULLISH' | 'BEARISH' } | null {
  for (let i = from; i < b.length; i++) {
    if (invalid(i)) return null;
    if (up(i)) return { index: i, direction: 'BULLISH' };
    if (down(i)) return { index: i, direction: 'BEARISH' };
  }
  return null;
}

function solve3x3(
  m: readonly (readonly number[])[],
  v: readonly number[],
): [number, number, number] | null {
  const det3 = (r: readonly (readonly number[])[]) =>
    r[0]![0]! * (r[1]![1]! * r[2]![2]! - r[1]![2]! * r[2]![1]!) -
    r[0]![1]! * (r[1]![0]! * r[2]![2]! - r[1]![2]! * r[2]![0]!) +
    r[0]![2]! * (r[1]![0]! * r[2]![1]! - r[1]![1]! * r[2]![0]!);
  const d = det3(m);
  if (Math.abs(d) < 1e-12) return null;
  const withCol = (col: number) => m.map((row, i) => row.map((x, j) => (j === col ? v[i]! : x)));
  return [det3(withCol(0)) / d, det3(withCol(1)) / d, det3(withCol(2)) / d];
}

/**
 * How well the closes over `[i0, i1]` fit a parabola (least-squares, bar index normalized to
 * [0, 1] for numerical stability) - the catalog's "roundness score" for Cup and Handle / Rounding
 * Bottom (`catalog/patterns/chart.json`, `roundness_min`), whose own spec says only "a simple
 * curve-fit score is enough for v1" with no formula. `a` is the fitted curve's own-value
 * coefficient (positive = opens upward, a bowl; negative = opens downward, a dome) and `r2` is
 * the fit quality (1 = perfect parabola, 0 = no better than a flat average). Not a validated
 * definition of "roundness" - a reasonable, documented choice for an admittedly subjective
 * measure (see D57).
 */
export function roundness(b: Bars, i0: number, i1: number): { a: number; r2: number } {
  const n = i1 - i0 + 1;
  if (n < 5) return { a: 0, r2: 0 };
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = i0; i <= i1; i++) {
    xs.push((i - i0) / (i1 - i0));
    ys.push(b.c[i]!);
  }
  let s0 = 0,
    s1 = 0,
    s2 = 0,
    s3 = 0,
    s4 = 0,
    sy = 0,
    sxy = 0,
    sx2y = 0;
  for (let k = 0; k < n; k++) {
    const x = xs[k]!;
    const y = ys[k]!;
    const x2 = x * x;
    s0 += 1;
    s1 += x;
    s2 += x2;
    s3 += x2 * x;
    s4 += x2 * x2;
    sy += y;
    sxy += x * y;
    sx2y += x2 * y;
  }
  const solved = solve3x3(
    [
      [s4, s3, s2],
      [s3, s2, s1],
      [s2, s1, s0],
    ],
    [sx2y, sxy, sy],
  );
  if (solved == null) return { a: 0, r2: 0 };
  const [a, bCoef, c] = solved;
  const meanY = sy / n;
  let ssRes = 0;
  let ssTot = 0;
  for (let k = 0; k < n; k++) {
    const x = xs[k]!;
    const y = ys[k]!;
    const pred = a * x * x + bCoef * x + c;
    ssRes += (y - pred) ** 2;
    ssTot += (y - meanY) ** 2;
  }
  return { a, r2: ssTot === 0 ? 1 : 1 - ssRes / ssTot };
}

function pivotRecord(s: Swing): ChartPatternPivot {
  return { at: s.formedAt, index: s.formedIndex, price: s.price, kind: s.kind };
}

export function makeChartPattern(
  patternId: string,
  direction: 'BULLISH' | 'BEARISH',
  pivots: readonly Swing[],
  b: Bars,
  breakoutIndex: number,
  confirmationRef: number,
  targetPrice: number | null,
  invalidationRef: number | null,
): ChartPattern {
  const last = pivots[pivots.length - 1]!;
  return {
    id: `CHART:v1:${patternId}:${pivots[0]!.formedAt}:${last.formedAt}`,
    type: 'PATTERN_EVENT',
    patternId,
    defVersion: 'v1',
    direction,
    pivots: pivots.map(pivotRecord),
    formedAt: last.formedAt,
    formedIndex: last.formedIndex,
    confirmedAt: b.end[breakoutIndex]!,
    confirmedIndex: breakoutIndex,
    confirmationRef,
    targetPrice,
    invalidationRef,
  };
}
