import type { Timeframe } from '../core/timeframe';
import type { UtcMs } from '../core/types';
import { pipsToPrice, priceToPips, roundToTick, type Instrument } from '../instruments/registry';

/** A point on the chart: UTC time + price. Independent of the timeframe it was drawn on. */
export interface Anchor {
  t: UtcMs;
  p: number;
}

export type DrawingKind =
  'HLINE' | 'TRENDLINE' | 'RECT' | 'PRICE_RANGE' | 'POSITION_LONG' | 'POSITION_SHORT';

/**
 * Anchors per tool. Positions: [entry (start time), stop (end time), target (end time)].
 * HLINE uses only the price; its time marks where it was drawn.
 */
export const ANCHOR_COUNT: Record<DrawingKind, number> = {
  HLINE: 1,
  TRENDLINE: 2,
  RECT: 2,
  PRICE_RANGE: 2,
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

export type DrawingProblem = 'NOT_USER' | 'ANCHOR_COUNT' | 'NON_FINITE';

export function validateDrawing(d: Drawing): DrawingProblem[] {
  const problems: DrawingProblem[] = [];
  if (d.source !== 'USER') problems.push('NOT_USER');
  if (d.anchors.length !== ANCHOR_COUNT[d.kind]) problems.push('ANCHOR_COUNT');
  if (d.anchors.some((a) => !Number.isFinite(a.t) || !Number.isFinite(a.p))) {
    problems.push('NON_FINITE');
  }
  return problems;
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
