import type { UtcMs } from '../core/types';

/**
 * Catalog-driven pattern detections (M9): a separate system from the M4 `features/` candidates
 * (CLAUDE.md "Kavram tanımları" - the catalog is automatic detection, not a manual drawing tool).
 */
export interface CandlePattern {
  id: string;
  /** `catalog/patterns/candlestick.json` id, e.g. "cdldoji". */
  patternId: string;
  defVersion: 'v1';
  direction: 'BULLISH' | 'BEARISH' | null;
  formedAt: UtcMs;
  formedIndex: number;
  /** Known at the close of the pattern's last bar. */
  confirmedAt: UtcMs;
  confirmedIndex: number;
}

export interface ChartPatternPivot {
  at: UtcMs;
  index: number;
  price: number;
  kind: 'HIGH' | 'LOW';
}

/**
 * Multi-bar chart (price-action) patterns, `catalog/patterns/chart.json`. Pivot-based, so
 * `formedAt/Index` is the last required pivot and `confirmedAt/Index` is the breakout bar
 * (whichever is later - see `patterns/chart-shared.ts`).
 */
export interface ChartPattern {
  id: string;
  /** `catalog/patterns/chart.json` id, e.g. "double_top". */
  patternId: string;
  defVersion: 'v1';
  direction: 'BULLISH' | 'BEARISH';
  pivots: ChartPatternPivot[];
  formedAt: UtcMs;
  formedIndex: number;
  confirmedAt: UtcMs;
  confirmedIndex: number;
  /** The neckline/support/resistance/line price the breakout bar closed through. */
  confirmationRef: number;
  /** Measured-move target, or null when the catalog defines no target for this pattern. */
  targetPrice: number | null;
  /** Price level whose close before the breakout would have killed the candidate. */
  invalidationRef: number | null;
}
