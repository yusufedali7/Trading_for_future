import type { Bars } from '../features/bars';
import type { Swing } from '../features/types';
import { detectBearFlag, detectBullFlag, detectPennant } from './chart-continuation';
import { detectCupAndHandle, detectDiamond, detectRoundingBottom } from './chart-curve';
import {
  detectAscendingChannel,
  detectAscendingTriangle,
  detectBroadening,
  detectDescendingChannel,
  detectDescendingTriangle,
  detectFallingWedge,
  detectRectangle,
  detectRisingWedge,
  detectSymmetricalTriangle,
} from './chart-lines';
import {
  detectDoubleBottom,
  detectDoubleTop,
  detectHeadShouldersBottom,
  detectHeadShouldersTop,
  detectTripleBottom,
  detectTripleTop,
} from './chart';
import type { ChartPattern } from './types';

/**
 * A single lookup for all 21 chart-pattern detectors (M9 7.-10. dilim, D54-D57), used by the
 * strategy engine's `PATTERN_EVENT` step (D63) to resolve a catalog `patternId` (e.g.
 * "double_bottom") to its detector function. Every one of these 21 shares the exact same
 * signature - `(bars, swings) => ChartPattern[]`, with `swings` precomputed once by the caller
 * using `CHART_PIVOT_PARAMS` - so the registry needs no per-pattern adapter.
 *
 * The other two M9 pattern families (`CandlePattern`, `HarmonicPattern`) are NOT in this registry:
 * they don't share this family's `direction` + `invalidationRef`/`targetPrice` shape, so they
 * aren't wired to `PATTERN_EVENT` yet (same reasoning D59/D61 used to leave SMC's non-directional
 * concepts and the catalog's other blocked strategies out of scope - a deliberate, documented gap,
 * not an oversight).
 */
export const CHART_PATTERN_DETECTORS: Record<
  string,
  (b: Bars, swings: readonly Swing[]) => ChartPattern[]
> = {
  double_top: detectDoubleTop,
  double_bottom: detectDoubleBottom,
  triple_top: detectTripleTop,
  triple_bottom: detectTripleBottom,
  head_shoulders_top: detectHeadShouldersTop,
  head_shoulders_bottom: detectHeadShouldersBottom,
  ascending_triangle: detectAscendingTriangle,
  descending_triangle: detectDescendingTriangle,
  symmetrical_triangle: detectSymmetricalTriangle,
  rising_wedge: detectRisingWedge,
  falling_wedge: detectFallingWedge,
  ascending_channel: detectAscendingChannel,
  descending_channel: detectDescendingChannel,
  rectangle: detectRectangle,
  broadening: detectBroadening,
  bull_flag: detectBullFlag,
  bear_flag: detectBearFlag,
  pennant: detectPennant,
  cup_and_handle: detectCupAndHandle,
  rounding_bottom: detectRoundingBottom,
  diamond: detectDiamond,
};

export const CHART_PATTERN_IDS: readonly string[] = Object.keys(CHART_PATTERN_DETECTORS);

/** Every chart-pattern detector run once, concatenated - the `PATTERN_EVENT` candidate source. */
export function detectAllChartPatterns(b: Bars, swings: readonly Swing[]): ChartPattern[] {
  return Object.values(CHART_PATTERN_DETECTORS).flatMap((fn) => fn(b, swings));
}
