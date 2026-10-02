import type { UtcMs } from '../core/types';
import type { CandleSeries } from '../data/columnar';

export type Direction = 'LONG' | 'SHORT';
export type OrderType = 'MARKET' | 'LIMIT' | 'STOP';
export type AmbiguityRule = 'STOP_FIRST' | 'TARGET_FIRST';

/** A trade decision. Prices are on the chart's (BID) scale. */
export interface TradeOrder {
  direction: Direction;
  type: OrderType;
  /** Decision time (replay cursor). Only bars opening at or after it are used. */
  placedAt: UtcMs;
  /** Last known price at the decision; validates market orders. */
  referencePrice: number;
  /** Trigger price for LIMIT/STOP. */
  price?: number;
  stop: number;
  target: number;
  /** Unfilled LIMIT/STOP orders are dropped at this time. */
  expiresAt: UtcMs | null;
}

export interface CostModel {
  /** Ask − bid, in price units (constant). */
  spread: number;
  /** Price units added against the trader on market and stop fills. */
  slippage: number;
}

export interface SimOptions {
  baseMs: number;
  /** Only bars closed by this instant are used (the replay cursor). */
  cutoff: UtcMs;
  costs: CostModel;
  ambiguity: AmbiguityRule;
  /** Manual close: exit at the close of the last bar closed by this instant. */
  closeAt?: UtcMs;
}

export type TradeStatus = 'INVALID' | 'PENDING' | 'OPEN' | 'CLOSED' | 'EXPIRED' | 'CANCELLED';
export type ExitReason = 'SL' | 'TP' | 'MANUAL';

export interface SimResult {
  status: TradeStatus;
  entryAt?: UtcMs;
  entryPrice?: number;
  /** Open time of the bar in which the exit happened. */
  exitAt?: UtcMs;
  exitPrice?: number;
  exitReason?: ExitReason;
  /** OPEN trades: exit-side price at the last closed bar. */
  markPrice?: number;
  /** Realised (CLOSED) or unrealised (OPEN) result in R; null before entry. */
  r: number | null;
  /** Maximum adverse / favourable excursion in R, from the entry bar on. */
  maeR: number;
  mfeR: number;
  barsHeld: number;
  /** Stop and target (or stop on a limit/stop entry bar) in the same bar: order unknown. */
  ambiguous: boolean;
}

const fix = (x: number) => Math.round(x * 1e8) / 1e8;
const fixR = (x: number) => Math.round(x * 1e9) / 1e9;

function lowerBound(xs: Float64Array, target: number): number {
  let lo = 0;
  let hi = xs.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (xs[mid]! < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export type OrderProblem = 'NO_PRICE' | 'STOP_SIDE' | 'TARGET_SIDE';

/** Why an order cannot be simulated: missing trigger, or stop/target on the wrong side of entry. */
export function orderProblem(o: TradeOrder): OrderProblem | null {
  const ref = o.type === 'MARKET' ? o.referencePrice : (o.price ?? NaN);
  if (!Number.isFinite(ref)) return 'NO_PRICE';
  const long = o.direction === 'LONG';
  if (!Number.isFinite(o.stop) || (long ? o.stop >= ref : o.stop <= ref)) return 'STOP_SIDE';
  if (!Number.isFinite(o.target) || (long ? o.target <= ref : o.target >= ref))
    return 'TARGET_SIDE';
  return null;
}

/**
 * Replays one manual trade on base (1m) BID bars up to `cutoff`. Pure and deterministic; the
 * same rules will drive the M5 backtest (DECISIONS D8, D26):
 * - market orders fill at the next bar's open; limit/stop orders when touched, at the open on gaps;
 * - longs buy at the ask (bid + spread) and sell at the bid; shorts sell at the bid, buy at the ask;
 * - stop and target in one bar → `ambiguity` rule, flagged; on a limit/stop entry bar only the
 *   stop counts (pessimistic), flagged;
 * - gaps through stop or target exit at the open.
 */
export function simulateTrade(order: TradeOrder, series: CandleSeries, opt: SimOptions): SimResult {
  const base: SimResult = {
    status: 'PENDING',
    r: null,
    maeR: 0,
    mfeR: 0,
    barsHeld: 0,
    ambiguous: false,
  };
  if (orderProblem(order) !== null) return { ...base, status: 'INVALID' };

  const long = order.direction === 'LONG';
  const { spread, slippage } = opt.costs;
  const limit = Math.min(opt.cutoff, opt.closeAt ?? Infinity);

  let status: TradeStatus = 'PENDING';
  let entryAt = 0;
  let entryPrice = 0;
  let risk = 0;
  let worst = 0;
  let best = 0;
  let barsHeld = 0;
  let ambiguous = false;
  let last = -1;
  let exit: { at: UtcMs; price: number; reason: ExitReason } | null = null;

  for (let i = lowerBound(series.t, order.placedAt); i < series.length; i++) {
    const t = series.t[i]!;
    if (t + opt.baseMs > limit) break;
    last = i;
    const o = series.o[i]!;
    const h = series.h[i]!;
    const l = series.l[i]!;
    let entryBar = false;

    if (status === 'PENDING') {
      if (order.expiresAt !== null && t >= order.expiresAt) return { ...base, status: 'EXPIRED' };
      let fill: number | null = null;
      if (order.type === 'MARKET') {
        fill = long ? o + spread + slippage : o - slippage;
      } else if (order.type === 'LIMIT') {
        const p = order.price!;
        if (long && l + spread <= p) fill = Math.min(p, o + spread);
        if (!long && h >= p) fill = Math.max(p, o);
      } else {
        const p = order.price!;
        if (long && h + spread >= p) fill = Math.max(p, o + spread) + slippage;
        if (!long && l <= p) fill = Math.min(p, o) - slippage;
      }
      if (fill === null) continue;
      status = 'OPEN';
      entryAt = t;
      entryPrice = fix(fill);
      risk = Math.abs(entryPrice - order.stop);
      entryBar = order.type !== 'MARKET';
    }

    barsHeld++;
    // Exit side: longs sell at the bid, shorts buy back at the ask.
    const xo = long ? o : o + spread;
    const xh = long ? h : h + spread;
    const xl = long ? l : l + spread;
    const stopHit = long ? xl <= order.stop : xh >= order.stop;
    const targetHit = long ? xh >= order.target : xl <= order.target;
    const gapStop = long ? xo <= order.stop : xo >= order.stop;
    const gapTarget = long ? xo >= order.target : xo <= order.target;

    if (!entryBar && gapStop) exit = { at: t, price: xo, reason: 'SL' };
    else if (!entryBar && gapTarget) exit = { at: t, price: xo, reason: 'TP' };
    else if (entryBar) {
      if (stopHit) {
        exit = { at: t, price: order.stop, reason: 'SL' };
        ambiguous = true;
      }
    } else if (stopHit && targetHit) {
      ambiguous = true;
      exit =
        opt.ambiguity === 'STOP_FIRST'
          ? { at: t, price: order.stop, reason: 'SL' }
          : { at: t, price: order.target, reason: 'TP' };
    } else if (stopHit) exit = { at: t, price: order.stop, reason: 'SL' };
    else if (targetHit) exit = { at: t, price: order.target, reason: 'TP' };

    // Excursions: bar extremes, or only the exit price on the exit bar.
    const adverse = exit ? exit.price : long ? xl : xh;
    const favourable = exit ? exit.price : long ? xh : xl;
    worst = Math.max(worst, long ? entryPrice - adverse : adverse - entryPrice);
    best = Math.max(best, long ? favourable - entryPrice : entryPrice - favourable);
    if (exit) break;
  }

  const resultR = (price: number) => fixR((long ? price - entryPrice : entryPrice - price) / risk);
  const common = {
    entryAt,
    entryPrice,
    maeR: risk > 0 ? fixR(worst / risk) : 0,
    mfeR: risk > 0 ? fixR(best / risk) : 0,
    barsHeld,
    ambiguous,
  };

  if (status === 'PENDING') {
    const closedByUser = opt.closeAt !== undefined && opt.closeAt <= opt.cutoff;
    return { ...base, status: closedByUser ? 'CANCELLED' : 'PENDING' };
  }
  if (exit) {
    const price = fix(exit.price);
    return {
      ...base,
      ...common,
      status: 'CLOSED',
      exitAt: exit.at,
      exitPrice: price,
      exitReason: exit.reason,
      r: resultR(price),
    };
  }
  const markPrice = fix(long ? series.c[last]! : series.c[last]! + spread);
  if (opt.closeAt !== undefined && opt.closeAt <= opt.cutoff) {
    return {
      ...base,
      ...common,
      status: 'CLOSED',
      exitAt: series.t[last]!,
      exitPrice: markPrice,
      exitReason: 'MANUAL',
      r: resultR(markPrice),
    };
  }
  return { ...base, ...common, status: 'OPEN', markPrice, r: resultR(markPrice) };
}
