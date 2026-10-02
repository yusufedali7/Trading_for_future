import { timeframeMs } from '../core/timeframe';
import type { UtcMs } from '../core/types';
import type { CandleSeries } from '../data/columnar';
import { bucketStart, type ResampledCandle } from '../data/resample';
import {
  orderProblem,
  simulateTrade,
  type AmbiguityRule,
  type SimResult,
  type TradeOrder,
} from '../execution/trade-sim';
import { toBars, type Bars } from '../features/bars';
import type { FeatureSet } from '../features/compute';
import { marketState } from '../instruments/hours';
import { pipsToPrice, roundToTick, type Instrument } from '../instruments/registry';
import { positionSize, quoteToUsd, tradePnl, type LotRules } from '../risk/sizing';
import { findSetups, type Setup } from '../strategy/matcher';
import type { StrategySpec } from '../strategy/schema';

export interface BacktestCosts {
  spreadPips: number;
  slippagePips: number;
  /** USD per lot per side (charged on entry and on exit). */
  commissionPerLotPerSide: number;
}

export interface BacktestConfig {
  /** Setups whose signal is known in [from, to) are traded; open trades are closed at `to`. */
  range: { from: UtcMs; to: UtcMs };
  costs: BacktestCosts;
  ambiguity: AmbiguityRule;
  startEquity: number;
  lots: LotRules;
}

export interface BacktestInput {
  spec: StrategySpec;
  inst: Instrument;
  /** Base (1m) series: fills and exits are simulated on it (D26). */
  series: CandleSeries;
  baseMs: number;
  /** Candles of `spec.timeframe` and the features computed on them with `spec.features`. */
  candles: readonly ResampledCandle[];
  features: FeatureSet;
  config: BacktestConfig;
}

export type SkipReason =
  'DATA_GAP' | 'INVALID_ORDER' | 'SIZE_TOO_SMALL' | 'CROSS_PAIR' | 'POSITION_OPEN' | 'DAILY_LIMIT';

export const SKIP_REASONS: readonly SkipReason[] = [
  'DATA_GAP',
  'INVALID_ORDER',
  'SIZE_TOO_SMALL',
  'CROSS_PAIR',
  'POSITION_OPEN',
  'DAILY_LIMIT',
];

export type BacktestExit = 'SL' | 'TP' | 'END_OF_RANGE';

export interface BacktestTrade {
  setupId: string;
  signalAt: UtcMs;
  order: TradeOrder;
  lots: number;
  /** USD that a stop-out at the planned prices would lose. */
  riskAmount: number;
  entryAt: UtcMs;
  entryPrice: number;
  exitAt: UtcMs;
  exitPrice: number;
  exit: BacktestExit;
  /** Result in R from prices (spread and slippage included, commission not). */
  priceR: number;
  commission: number;
  /** USD after spread, slippage and commission. */
  pnl: number;
  /** pnl / riskAmount: what the statistics use. */
  r: number;
  maeR: number;
  mfeR: number;
  barsHeld: number;
  ambiguous: boolean;
  equityAfter: number;
}

export interface BacktestResult {
  setupsFound: number;
  trades: BacktestTrade[];
  skipped: Record<SkipReason, number>;
  /** Limit/stop orders that were not filled before they expired. */
  expiredOrders: number;
  /** Orders still waiting at the end of the range. */
  unfilledAtEnd: number;
  ambiguousTrades: number;
  costs: { spread: number; slippage: number; commission: number; total: number };
  startEquity: number;
  endEquity: number;
}

const r2 = (x: number) => Math.round(x * 100) / 100;

/** Bars between the first step and the signal miss data while the market was open. */
function hasDataGap(
  inst: Instrument,
  b: Bars,
  candles: readonly ResampledCandle[],
  s: Setup,
): boolean {
  // From two bars before the first step (patterns span up to three bars) to the signal.
  const first = Math.max(0, s.steps[0]!.confirmedIndex - 2);
  for (let i = first; i <= s.signalIndex; i++) {
    const c = candles[i]!;
    if (c.sourceCount * 2 < c.expectedCount) return true;
    if (i < s.signalIndex && b.t[i + 1]! > b.end[i]! && marketState(inst, b.end[i]!) === 'OPEN')
      return true;
  }
  return false;
}

/** The order a setup produces, or null if its prices make no sense (stop on the wrong side). */
export function orderFor(
  spec: StrategySpec,
  inst: Instrument,
  s: Setup,
  lastClose: number,
): TradeOrder | null {
  const long = spec.direction === 'LONG';
  const dir = long ? 1 : -1;
  const pip = (n: number) => pipsToPrice(inst, n);
  const entry = spec.entry;
  const market = entry.type === 'MARKET';
  const price = entry.type === 'MARKET' ? undefined : s.refs[entry.ref];
  const expireBars = entry.type === 'MARKET' ? 0 : entry.expireBars;
  if (!market && price === undefined) return null;
  const entryRef = market ? lastClose : price!;
  const stop =
    spec.stop.type === 'BEYOND_REF'
      ? (s.refs[spec.stop.ref] ?? NaN) - dir * pip(spec.stop.bufferPips)
      : entryRef - dir * pip(spec.stop.pips);
  const t = spec.target;
  const target =
    t.type === 'R_MULTIPLE'
      ? entryRef + dir * t.r * Math.abs(entryRef - stop)
      : t.type === 'FIXED_PIPS'
        ? entryRef + dir * pip(t.pips)
        : (s.refs[t.ref] ?? NaN) - dir * pip(t.bufferPips);
  const order: TradeOrder = {
    direction: spec.direction,
    type: market ? 'MARKET' : entry.type === 'LIMIT_AT' ? 'LIMIT' : 'STOP',
    placedAt: s.signalAt,
    referencePrice: lastClose,
    ...(market ? {} : { price: roundToTick(inst, price!) }),
    stop: roundToTick(inst, stop),
    target: roundToTick(inst, target),
    expiresAt: market ? null : s.signalAt + expireBars * timeframeMs(spec.timeframe),
  };
  return orderProblem(order) === null ? order : null;
}

/**
 * Deterministic backtest of one strategy version (D32): setups from the shared feature engine,
 * fills and exits from the shared simulator on 1m bars, one position at a time, lots from the
 * current equity. Same input → identical result.
 */
export function runBacktest(input: BacktestInput): BacktestResult {
  const { spec, inst, series, baseMs, candles, features, config } = input;
  const { from, to } = config.range;
  const b = toBars(candles, inst, spec.timeframe);
  const setups = findSetups(spec, b, features).filter((s) => s.signalAt >= from && s.signalAt < to);
  const spread = pipsToPrice(inst, config.costs.spreadPips);
  const slippage = pipsToPrice(inst, config.costs.slippagePips);
  const skipped = Object.fromEntries(SKIP_REASONS.map((r) => [r, 0])) as Record<SkipReason, number>;
  const trades: BacktestTrade[] = [];
  const perDay = new Map<number, number>();
  const costs = { spread: 0, slippage: 0, commission: 0, total: 0 };
  let equity = config.startEquity;
  let busyUntil = -Infinity;
  let expiredOrders = 0;
  let unfilledAtEnd = 0;

  for (const s of setups) {
    if (s.signalAt < busyUntil) {
      skipped.POSITION_OPEN++;
      continue;
    }
    if (hasDataGap(inst, b, candles, s)) {
      skipped.DATA_GAP++;
      continue;
    }
    const day = bucketStart(inst, '1D', s.signalAt);
    if (spec.maxTradesPerDay !== null && (perDay.get(day) ?? 0) >= spec.maxTradesPerDay) {
      skipped.DAILY_LIMIT++;
      continue;
    }
    const order = orderFor(spec, inst, s, b.c[s.signalIndex]!);
    if (!order) {
      skipped.INVALID_ORDER++;
      continue;
    }
    const plannedEntry = order.type === 'MARKET' ? order.referencePrice : order.price!;
    const size = positionSize(
      inst,
      equity,
      spec.risk.percentPerTrade,
      plannedEntry,
      order.stop,
      config.lots,
    );
    if (!size.ok) {
      if (size.reason === 'CROSS_PAIR') skipped.CROSS_PAIR++;
      else skipped.SIZE_TOO_SMALL++;
      continue;
    }
    const sim: SimResult = simulateTrade(order, series, {
      baseMs,
      cutoff: to,
      costs: { spread, slippage },
      ambiguity: config.ambiguity,
      closeAt: to,
    });
    if (sim.status === 'EXPIRED') {
      expiredOrders++;
      busyUntil = order.expiresAt ?? busyUntil;
      continue;
    }
    if (sim.status !== 'CLOSED') {
      // Still pending at the end of the range (cancelled there).
      unfilledAtEnd++;
      busyUntil = to;
      continue;
    }
    perDay.set(day, (perDay.get(day) ?? 0) + 1);
    const lots = size.lots;
    const conv = quoteToUsd(inst, sim.exitPrice!) ?? 0;
    const money = (priceMove: number) => priceMove * inst.contractSize * lots * conv;
    const gross = tradePnl(inst, order.direction, lots, sim.entryPrice!, sim.exitPrice!) ?? 0;
    const commission = r2(2 * lots * config.costs.commissionPerLotPerSide);
    const pnl = r2(gross - commission);
    equity = r2(equity + pnl);
    const slipped =
      (order.type !== 'LIMIT' ? 1 : 0) +
      (sim.exitReason === 'SL' || sim.exitReason === 'MANUAL' ? 1 : 0);
    costs.spread += money(spread);
    costs.slippage += money(slippage) * slipped;
    costs.commission += commission;
    trades.push({
      setupId: s.id,
      signalAt: s.signalAt,
      order,
      lots,
      riskAmount: size.riskAmount,
      entryAt: sim.entryAt!,
      entryPrice: sim.entryPrice!,
      exitAt: sim.exitAt!,
      exitPrice: sim.exitPrice!,
      exit: sim.exitReason === 'MANUAL' ? 'END_OF_RANGE' : sim.exitReason!,
      priceR: sim.r!,
      commission,
      pnl,
      r: Math.round((pnl / size.riskAmount) * 1e6) / 1e6,
      maeR: sim.maeR,
      mfeR: sim.mfeR,
      barsHeld: sim.barsHeld,
      ambiguous: sim.ambiguous,
      equityAfter: equity,
    });
    busyUntil = sim.exitAt! + baseMs;
  }

  costs.spread = r2(costs.spread);
  costs.slippage = r2(costs.slippage);
  costs.commission = r2(costs.commission);
  costs.total = r2(costs.spread + costs.slippage + costs.commission);
  return {
    setupsFound: setups.length,
    trades,
    skipped,
    expiredOrders,
    unfilledAtEnd,
    ambiguousTrades: trades.filter((t) => t.ambiguous).length,
    costs,
    startEquity: config.startEquity,
    endEquity: equity,
  };
}
