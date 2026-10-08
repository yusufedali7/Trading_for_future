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
