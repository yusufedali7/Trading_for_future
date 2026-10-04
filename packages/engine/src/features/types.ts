import type { UtcMs } from '../core/types';

export type FeatureDirection = 'BULLISH' | 'BEARISH';

/**
 * Common timing of every detection (DECISIONS D7, D28). Indices refer to the `Bars` the detector
 * ran on; times are UTC. A detection may only be used from `confirmedAt` on.
 */
export interface DetectionTiming {
  /** Deterministic: type, definition version, side and formation time. */
  id: string;
  defVersion: 'v1';
  /** Open time / index of the bar where the event happened. */
  formedAt: UtcMs;
  formedIndex: number;
  /** Close time / index of the bar after which the event was known. */
  confirmedAt: UtcMs;
  confirmedIndex: number;
}

export interface SwingParams {
  /** Bars on the left that must be strictly lower (for a high). */
  left: number;
  /** Bars on the right that must not be higher; also the confirmation delay. */
  right: number;
}

export interface Swing extends DetectionTiming {
  type: 'SWING';
  kind: 'HIGH' | 'LOW';
  price: number;
}

export interface FvgParams {
  minSizePips: number;
}

export interface Fvg extends DetectionTiming {
  type: 'FVG';
  direction: FeatureDirection;
  top: number;
  bottom: number;
  /** Close time of the first later bar that reached the gap's near edge; null if none (yet). */
  touchedAt: UtcMs | null;
  /** Close time of the first later bar that reached the far edge (gap filled); null if none (yet). */
  filledAt: UtcMs | null;
}

export type BreakBy = 'CLOSE' | 'WICK';

export interface StructureBreakParams {
  breakBy: BreakBy;
}

export interface StructureBreak extends DetectionTiming {
  type: 'STRUCTURE_BREAK';
  direction: FeatureDirection;
  /** BOS: same direction as the previous break (or the first break); CHOCH: direction changed. */
  kind: 'BOS' | 'CHOCH';
  /** The swing price that was broken. */
  level: number;
  swingId: string;
  swingAt: UtcMs;
}

export type PeriodKind = 'DAY' | 'WEEK';

/** High/low of a finished trading day or week, used as a level during the next one. */
export interface PeriodLevel {
  id: string;
  defVersion: 'v1';
  period: PeriodKind;
  /** The period the high/low come from. */
  start: UtcMs;
  end: UtcMs;
  high: number;
  low: number;
  /** = end: the levels are final only when the period has closed. */
  knownAt: UtcMs;
  /** End of the following period: the level is "previous day/week" until then. */
  validUntil: UtcMs;
}

/** Fixed kinds plus one HIGH/LOW pair per session id (built-in or user, e.g. `ICT_ASIA_LOW`). */
export type LiquidityKind =
  'SWING_HIGH' | 'SWING_LOW' | 'PDH' | 'PDL' | 'PWH' | 'PWL' | `${string}_HIGH` | `${string}_LOW`;

/** A price where resting orders are assumed to sit (above highs, below lows). */
export interface LiquidityLevel {
  id: string;
  kind: LiquidityKind;
  side: 'HIGH' | 'LOW';
  price: number;
  /** Usable from bars opening at or after this time. */
  knownAt: UtcMs;
  /** Not used by bars opening at or after this time. */
  validUntil: UtcMs;
}

export interface SweepParams {
  /** Swing levels expire this many bars (of the timeframe) after the swing formed. */
  swingMaxAgeBars: number;
}

export interface LiquiditySweep extends DetectionTiming {
  type: 'LIQUIDITY_SWEEP';
  /** BEARISH: a high was swept (price rejected upward); BULLISH: a low was swept. */
  direction: FeatureDirection;
  levelId: string;
  levelKind: LiquidityKind;
  level: number;
  /** The wick extreme beyond the level. */
  extreme: number;
}

export type Detection = Swing | Fvg | StructureBreak | LiquiditySweep;
