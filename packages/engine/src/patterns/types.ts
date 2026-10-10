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
  /** Discriminant shared with `strategy/matcher.ts`'s `AnyDetection` union (D63). */
  type: 'PATTERN_EVENT';
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

/** A harmonic pattern's labelled swing point (X, A, B, C, or D). */
export interface HarmonicPatternPivot extends ChartPatternPivot {
  label: 'X' | 'A' | 'B' | 'C' | 'D';
}

/**
 * Harmonic (XABCD) patterns, `catalog/patterns/harmonic.json`. Unlike the chart-pattern family,
 * the pattern itself *is* the signal - known as soon as D is confirmed, with no later breakout
 * to wait for (CLAUDE.md's "aday" framing: D is the candidate reversal zone, not a prediction).
 */
export interface HarmonicPattern {
  id: string;
  /** `catalog/patterns/harmonic.json` id, e.g. "gartley". */
  patternId: string;
  /** Which of the pattern's `ratio_sets` matched (there can be more than one per id). */
  ratioSetSource: string;
  defVersion: 'v1';
  /** BULLISH: D is a low (potential reversal up). BEARISH: D is a high. */
  direction: 'BULLISH' | 'BEARISH';
  pivots: HarmonicPatternPivot[];
  /** = D's own formed bar. */
  formedAt: UtcMs;
  formedIndex: number;
  /** = D's own confirmation bar (the pattern needs nothing past that). */
  confirmedAt: UtcMs;
  confirmedIndex: number;
  /** The actually-measured ratios (e.g. `{ AB_XA: 0.61, ... }`), for display/debugging. */
  ratios: Record<string, number>;
}
