import type { Timeframe } from '../core/timeframe';
import type { UtcMs } from '../core/types';
import { pipsToPrice, priceToPips, roundToTick, type Instrument } from '../instruments/registry';

/** A point on the chart: UTC time + price. Independent of the timeframe it was drawn on. */
export interface Anchor {
  t: UtcMs;
  p: number;
}

export type DrawingKind =
  | 'HLINE'
  | 'HRAY'
  | 'VLINE'
  | 'CROSSLINE'
  | 'TRENDLINE'
  | 'RAY'
  | 'EXTENDED_LINE'
  | 'CHANNEL'
  | 'FIB_RETRACEMENT'
  | 'FIB_EXTENSION'
  | 'RECT'
  | 'ELLIPSE'
  | 'ARROW'
  | 'TEXT'
  | 'ARROW_UP'
  | 'ARROW_DOWN'
  | 'PRICE_RANGE'
  | 'DATE_RANGE'
  | 'DATE_PRICE_RANGE'
  | 'POSITION_LONG'
  | 'POSITION_SHORT';

/**
 * Anchors per tool. HLINE uses only the price, VLINE only the time; their other value marks
 * where they were drawn. CHANNEL: two points of the base line + one point on the parallel line.
 * FIB_EXTENSION: the move (two points) + the point it is projected from.
 * Positions: [entry (start time), stop (end time), target (end time)].
 */
export const ANCHOR_COUNT: Record<DrawingKind, number> = {
  HLINE: 1,
  HRAY: 1,
  VLINE: 1,
  CROSSLINE: 1,
  TRENDLINE: 2,
  RAY: 2,
  EXTENDED_LINE: 2,
  CHANNEL: 3,
  FIB_RETRACEMENT: 2,
  FIB_EXTENSION: 3,
  RECT: 2,
  ELLIPSE: 2,
  ARROW: 2,
  TEXT: 1,
  ARROW_UP: 1,
  ARROW_DOWN: 1,
  PRICE_RANGE: 2,
  DATE_RANGE: 2,
  DATE_PRICE_RANGE: 2,
  POSITION_LONG: 3,
  POSITION_SHORT: 3,
};

/** User-data domain. Engine (source ENGINE) overlays are derived, never stored as drawings. */
export interface Drawing {
  id: string;
  source: 'USER' | 'ENGINE';
  kind: DrawingKind;
  instrument: string;
  createdOnTimeframe: Timeframe;
  anchors: Anchor[];
  style: { color?: string };
  /** Shown on the chart (TEXT tool). */
  text?: string;
  note?: string;
  locked: boolean;
  hidden: boolean;
  createdAt: UtcMs;
  updatedAt: UtcMs;
}

export type LevelKind = 'SUPPORT' | 'RESISTANCE' | 'FLIP';
export type LevelStatus = 'ACTIVE' | 'BROKEN' | 'RETESTED' | 'INVALIDATED';

/**
 * A user's support/resistance level. Its price (HLINE) or zone (RECT) comes from the linked
 * drawing, so moving the drawing moves the level; deleting the drawing deletes the level.
 */
export interface SupportResistanceLevel {
  id: string;
  drawingId: string;
  instrument: string;
  kind: LevelKind;
  timeframe: Timeframe;
  note: string;
  status: LevelStatus;
  statusHistory: { status: LevelStatus; at: UtcMs; note?: string }[];
  createdAt: UtcMs;
  updatedAt: UtcMs;
}

export type DrawingProblem = 'NOT_USER' | 'ANCHOR_COUNT' | 'NON_FINITE' | 'NO_TEXT';

export function validateDrawing(d: Drawing): DrawingProblem[] {
  const problems: DrawingProblem[] = [];
  if (d.source !== 'USER') problems.push('NOT_USER');
  if (d.anchors.length !== ANCHOR_COUNT[d.kind]) problems.push('ANCHOR_COUNT');
  if (d.anchors.some((a) => !Number.isFinite(a.t) || !Number.isFinite(a.p))) {
    problems.push('NON_FINITE');
  }
  if (d.kind === 'TEXT' && !d.text?.trim()) problems.push('NO_TEXT');
  return problems;
}

/** Our default levels (D41); not verified to equal TradingView's defaults. */
export const FIB_RETRACEMENT_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
export const FIB_EXTENSION_LEVELS = [0, 0.618, 1, 1.272, 1.618, 2, 2.618];

/**
 * Fibonacci prices. Retracement (A → B): level 0 at B, 1 at A, price = B − (B − A) × level.
 * Trend-based extension (A → B, then C): price = C + (B − A) × level.
 * Prices are rounded to the instrument's tick; with no instrument (pixel geometry) they are not.
 */
export function fibLevels(
  inst: Instrument | null,
  kind: 'FIB_RETRACEMENT' | 'FIB_EXTENSION',
  anchors: readonly Anchor[],
): { level: number; price: number }[] {
  const [a, b, c] = anchors;
  if (!a || !b) return [];
  const move = b.p - a.p;
  const tick = (p: number) => (inst ? roundToTick(inst, p) : p);
  if (kind === 'FIB_RETRACEMENT') {
    return FIB_RETRACEMENT_LEVELS.map((level) => ({
      level,
      price: tick(b.p - move * level),
    }));
  }
  if (!c) return [];
  return FIB_EXTENSION_LEVELS.map((level) => ({
    level,
    price: tick(c.p + move * level),
  }));
}

/** What the price-range tool shows between two anchors (b relative to a). */
export function priceRangeStats(inst: Instrument, a: Anchor, b: Anchor) {
  const pips = priceToPips(inst, b.p - a.p);
  return {
    diff: pipsToPrice(inst, pips),
    pips,
    percent: Math.round(((b.p - a.p) / a.p) * 100 * 10_000) / 10_000,
    durationMs: Math.abs(b.t - a.t),
  };
}

/** Risk/reward of a long/short position drawing. Not a lot-size calculation (that is M5). */
export function positionStats(
  inst: Instrument,
  kind: 'POSITION_LONG' | 'POSITION_SHORT',
  entry: number,
  stop: number,
  target: number,
) {
  const riskPips = Math.abs(priceToPips(inst, entry - stop));
  const rewardPips = Math.abs(priceToPips(inst, target - entry));
  const valid =
    kind === 'POSITION_LONG' ? stop < entry && target > entry : stop > entry && target < entry;
  return {
    riskPips,
    rewardPips,
    rr: riskPips === 0 ? 0 : Math.round((rewardPips / riskPips) * 100) / 100,
    valid,
  };
}

const DEFAULT_STOP_PIPS = 20;
const DEFAULT_R = 2;
const DEFAULT_WIDTH_BARS = 20;

/** Starting anchors for a new position tool: 20 pip stop, 2R target, 20 bars wide. */
export function defaultPosition(
  inst: Instrument,
  kind: 'POSITION_LONG' | 'POSITION_SHORT',
  entry: Anchor,
  barMs: number,
): Anchor[] {
  const dir = kind === 'POSITION_LONG' ? 1 : -1;
  const risk = pipsToPrice(inst, DEFAULT_STOP_PIPS);
  const end = entry.t + DEFAULT_WIDTH_BARS * barMs;
  return [
    { t: entry.t, p: entry.p },
    { t: end, p: roundToTick(inst, entry.p - dir * risk) },
    { t: end, p: roundToTick(inst, entry.p + dir * risk * DEFAULT_R) },
  ];
}

/** Returns a new level with the status change appended to its history. `at` comes from the app clock. */
export function setLevelStatus(
  level: SupportResistanceLevel,
  status: LevelStatus,
  at: UtcMs,
  note?: string,
): SupportResistanceLevel {
  if (level.status === status) return level;
  const entry = note === undefined ? { status, at } : { status, at, note };
  return { ...level, status, statusHistory: [...level.statusHistory, entry], updatedAt: at };
}
