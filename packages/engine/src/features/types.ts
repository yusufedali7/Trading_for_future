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

export interface DisplacementParams {
  /** Real body must exceed this multiple of the trailing average true range. */
  minBodyAtr: number;
  /** Bars used for the trailing average (strictly before the candidate bar). */
  atrPeriod: number;
}

/**
 * A single unusually strong bar (catalog/patterns/smc.json "displacement"). Not part of
 * `Detection`: unlike a swing/FVG/break/sweep it is not a level or zone that later "holds" or
 * "fails", so it has no natural outcome-tracking failure line (features/outcomes.ts) - it is a
 * per-bar classification, closer to a candlestick pattern than to a level candidate.
 */
export interface Displacement extends DetectionTiming {
  type: 'DISPLACEMENT';
  direction: FeatureDirection;
  body: number;
  /** The trailing average true range it was compared against. */
  atr: number;
}

export interface CisdParams {
  /** Longest opposite-coloured series that still counts (longer runs are a trend, not a pullback). */
  maxSeries: number;
}

/**
 * Change in State of Delivery, v1 (docs/definitions/cisd-v1.md, D77): a close beyond the open of
 * the series of opposite-coloured candles just before it. Like `Displacement`, not part of
 * `Detection` in v1: no outcome-tracking failure line is defined for it yet.
 */
export interface Cisd extends DetectionTiming {
  type: 'CISD';
  direction: FeatureDirection;
  /** Open of the series' first candle - the level the close went beyond. */
  level: number;
  seriesStartIndex: number;
  seriesStartAt: UtcMs;
  seriesLength: number;
}

export interface OrderBlockParams {
  /** BODY: the candle's open-close range; RANGE: its full high-low range. */
  zone: 'BODY' | 'RANGE';
  /** How many bars back from the breaking bar to search for the opposite-coloured candle. */
  lookbackBars: number;
}

export interface OrderBlock extends DetectionTiming {
  type: 'ORDER_BLOCK';
  /** Matches the structure break's direction: BULLISH = support/demand zone, BEARISH = resistance/supply. */
  direction: FeatureDirection;
  top: number;
  bottom: number;
  /** The structure break whose displacement bar this order block supports. */
  breakId: string;
}

/**
 * An FVG fully invalidated by a close through its far edge, then tracked as a zone in the
 * opposite direction (catalog "ifvg"). No params: v1 only models invalidation by close (the
 * catalog's `invalidate_by` has no other value defined yet).
 */
export interface Ifvg extends DetectionTiming {
  type: 'IFVG';
  /** The new expected direction (opposite of the source FVG's). */
  direction: FeatureDirection;
  top: number;
  bottom: number;
  sourceFvgId: string;
}

/**
 * An order block fully invalidated by a close through its far edge, then tracked as a zone in
 * the opposite direction (catalog "breaker"). No params, same reason as `Ifvg`.
 */
export interface Breaker extends DetectionTiming {
  type: 'BREAKER';
  /** The new expected direction (opposite of the source order block's). */
  direction: FeatureDirection;
  top: number;
  bottom: number;
  sourceOrderBlockId: string;
}

export interface EqualLevelsParams {
  /** Price tolerance, as a multiple of the ATR at the newer swing's bar. */
  toleranceAtr: number;
  atrPeriod: number;
}

/**
 * Two confirmed swings of the same kind within price tolerance of each other - a liquidity pool
 * candidate (catalog "equal_highs_lows"). v1 only pairs a new swing with the *nearest preceding*
 * same-kind swing (the catalog's default `min_count` of 2); clustering three or more into one
 * group is not modelled. Not part of `Detection` - it annotates a pair of swings rather than
 * being its own tradeable zone.
 */
export interface EqualLevels extends DetectionTiming {
  type: 'EQUAL_LEVELS';
  side: 'HIGH' | 'LOW';
  /** Average of the two swing prices. */
  price: number;
  swingIds: [string, string];
}

/**
 * The midpoint (and bounds) of the most recently confirmed swing-high/swing-low range (catalog
 * "premium_discount"). Above `equilibrium` is premium, below is discount. A new entry appears
 * every time the reference high or low changes; it is understood to stay active until the next
 * entry's `confirmedAt` (no explicit `validUntil` field - unlike `PeriodLevel`/`LiquidityLevel`,
 * nothing ever retroactively closes it, so a plain, order-dependent list is enough and keeps
 * truncation invariance trivial). Not part of `Detection` - it has no single failure direction.
 */
export interface PremiumDiscountZone extends DetectionTiming {
  type: 'PREMIUM_DISCOUNT';
  top: number;
  bottom: number;
  equilibrium: number;
}

export interface OteParams {
  /** Retracement fraction bounds of the impulse, e.g. [0.62, 0.79]. */
  zone: readonly [number, number];
  sweetSpot: number;
}

/**
 * The Optimal Trade Entry retracement zone of an impulse leg between two consecutive,
 * alternating confirmed swings (catalog "ote"). A bullish impulse (LOW then HIGH) expects a
 * retracement down into the zone before continuing up, and symmetrically for bearish.
 */
export interface OteZone extends DetectionTiming {
  type: 'OTE';
  direction: FeatureDirection;
  top: number;
  bottom: number;
  sweetSpot: number;
  startSwingId: string;
  endSwingId: string;
}

export interface CandidateSrParams {
  /** Price tolerance, as a multiple of the ATR at the time a pivot joins a cluster. */
  clusterToleranceAtr: number;
  /** Pivots needed before a cluster becomes a candidate level. */
  minTouches: number;
  /** Pivots older than this many bars (vs. the newest member) drop out of a cluster. */
  lookbackBars: number;
  atrPeriod: number;
}

/**
 * A horizontal zone from `minTouches` or more confirmed swing highs/lows (either kind - a level
 * can act as both support and resistance) clustered within price tolerance (catalog
 * "candidate_sr"). v1 emits one entry per cluster, the moment it first reaches `minTouches`; it
 * is not updated or re-emitted as more pivots join afterwards. Not part of `Detection` - it has
 * no single direction/failure line (support and resistance both apply).
 */
export interface CandidateSr extends DetectionTiming {
  type: 'CANDIDATE_SR';
  top: number;
  bottom: number;
  price: number;
  touches: number;
  swingIds: string[];
}

export type Detection =
  Swing | Fvg | StructureBreak | LiquiditySweep | OrderBlock | Ifvg | Breaker | OteZone;
