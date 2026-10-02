import type { UtcMs } from '../core/types';
import { pipsToPrice, roundToTick, type Instrument } from '../instruments/registry';
import { orderProblem, type Direction, type OrderType, type TradeOrder } from './trade-sim';

export type PriceUnit = 'PIPS' | 'PRICE';

/** What the user typed in the trade panel. */
export interface OrderDraft {
  direction: Direction;
  type: OrderType;
  /** Trigger price for LIMIT/STOP; ignored for MARKET. */
  price: number | null;
  /** PIPS: stop/target are distances from the entry reference; PRICE: absolute prices. */
  unit: PriceUnit;
  stop: number;
  target: number;
  /** LIMIT/STOP: unfilled orders are dropped after this many chart bars; null = never. */
  expireBars: number | null;
}

export interface OrderContext {
  /** Replay cursor. */
  placedAt: UtcMs;
  /** Close of the last bar known at the cursor (BID). */
  lastClose: number;
  /** Chart timeframe length, for expiry. */
  barMs: number;
}

export type DraftProblem = 'NO_PRICE' | 'NOT_POSITIVE' | 'STOP_SIDE' | 'TARGET_SIDE' | 'EXPIRY';

export const DEFAULT_STOP_PIPS = 20;
export const DEFAULT_TARGET_PIPS = 40;
export const DEFAULT_EXPIRE_BARS = 20;

export function defaultDraft(direction: Direction): OrderDraft {
  return {
    direction,
    type: 'MARKET',
    price: null,
    unit: 'PIPS',
    stop: DEFAULT_STOP_PIPS,
    target: DEFAULT_TARGET_PIPS,
    expireBars: DEFAULT_EXPIRE_BARS,
  };
}

/**
 * Turns the panel input into an order. Pip distances are measured from the entry reference: the
 * last close for market orders, the trigger price otherwise. Prices are rounded to the tick.
 */
export function buildOrder(
  inst: Instrument,
  d: OrderDraft,
  ctx: OrderContext,
): { order: TradeOrder } | { problem: DraftProblem } {
  const market = d.type === 'MARKET';
  if (!market && (d.price === null || !Number.isFinite(d.price) || d.price <= 0))
    return { problem: 'NO_PRICE' };
  const ref = market ? ctx.lastClose : d.price!;
  const dir = d.direction === 'LONG' ? 1 : -1;

  if (!(d.stop > 0) || !(d.target > 0)) return { problem: 'NOT_POSITIVE' };
  const pips = d.unit === 'PIPS';
  const stop = roundToTick(inst, pips ? ref - dir * pipsToPrice(inst, d.stop) : d.stop);
  const target = roundToTick(inst, pips ? ref + dir * pipsToPrice(inst, d.target) : d.target);

  let expiresAt: UtcMs | null = null;
  if (!market && d.expireBars !== null) {
    if (!Number.isInteger(d.expireBars) || d.expireBars < 1) return { problem: 'EXPIRY' };
    expiresAt = ctx.placedAt + d.expireBars * ctx.barMs;
  }

  const order: TradeOrder = {
    direction: d.direction,
    type: d.type,
    placedAt: ctx.placedAt,
    referencePrice: ctx.lastClose,
    ...(market ? {} : { price: roundToTick(inst, d.price!) }),
    stop,
    target,
    expiresAt,
  };
  const problem = orderProblem(order);
  return problem ? { problem } : { order };
}
