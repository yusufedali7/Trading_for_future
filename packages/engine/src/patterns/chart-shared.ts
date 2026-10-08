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

/** Value of the line through `p1`/`p2` (by bar index) at bar `i`; flat if they share an index. */
export function lineAt(
  p1: { index: number; price: number },
  p2: { index: number; price: number },
  i: number,
): number {
  if (p2.index === p1.index) return p1.price;
  const slope = (p2.price - p1.price) / (p2.index - p1.index);
  return p1.price + slope * (i - p1.index);
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
