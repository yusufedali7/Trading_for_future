import { mulberry32, randomInt } from '../core/rng';
import type { UtcMs } from '../core/types';
import type { CandleSeries } from '../data/columnar';
import {
  orderProblem,
  simulateTrade,
  type AmbiguityRule,
  type Direction,
  type TradeOrder,
} from '../execution/trade-sim';
import { pipsToPrice, roundToTick, type Instrument } from '../instruments/registry';
import { positionSize, quoteToUsd, tradePnl, type LotRules } from '../risk/sizing';
import type { BacktestCosts, BacktestResult, BacktestTrade, SkipReason } from './run';

/**
 * `catalog/strategies/baseline_random_entry.json`: "every strategy's mandatory comparison" -
 * same stop distance, target R-multiple, risk and roughly the same trade count as the real
 * strategy being tested, but entries land on uniformly random bars instead of a detected setup.
 * This answers "do the rules beat doing nothing in particular?" (Adım 8's "Rastgele giriş tabanını
 * yenmesi"), not "is the strategy profitable" on its own.
 *
 * **A simplification, not a literal translation of the real strategy's stop/target rules:** the
 * engine's `StopRule`/`TargetRule` (`BEYOND_REF`/`AT_REF`) are defined relative to a detected
 * event's price - a random entry has no such event to reference. Caller passes a single
 * `stopPips` (typically the real strategy's average realised stop distance) and `targetR`
 * instead, which the catalog's own "aynı stop, hedef" wording doesn't resolve more precisely
 * than this.
 */
export interface RandomBaselineInput {
  inst: Instrument;
  /** Base (1m) series: entries are sampled from its bars, same as real fills (D26). */
  series: CandleSeries;
  baseMs: number;
  range: { from: UtcMs; to: UtcMs };
  direction: Direction;
  /** How many trades to generate (normally the real strategy's trade count on the same range). */
  count: number;
  stopPips: number;
  targetR: number;
  risk: { percentPerTrade: number };
  costs: BacktestCosts;
  ambiguity: AmbiguityRule;
  startEquity: number;
  lots: LotRules;
  /** Recorded alongside results (CLAUDE.md rule 5: randomness needs a saved seed). */
  seed: number;
}

/** First index with `t[i] >= x`. */
function lowerBound(t: Float64Array, from: number, to: number, x: number): number {
  let lo = from;
  let hi = to;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (t[mid]! < x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

const r2 = (x: number) => Math.round(x * 100) / 100;

export function randomEntryBaseline(input: RandomBaselineInput): BacktestResult {
  const {
    inst,
    series,
    baseMs,
    range,
    direction,
    count,
    stopPips,
    targetR,
    risk,
    costs,
    ambiguity,
    startEquity,
    lots,
    seed,
  } = input;
  const rng = mulberry32(seed);
  const spread = pipsToPrice(inst, costs.spreadPips);
  const slippage = pipsToPrice(inst, costs.slippagePips);
  const stopDist = pipsToPrice(inst, stopPips);
  const dir = direction === 'LONG' ? 1 : -1;
  const skipped: Record<SkipReason, number> = {
    DATA_GAP: 0,
    INVALID_ORDER: 0,
    SIZE_TOO_SMALL: 0,
    CROSS_PAIR: 0,
    POSITION_OPEN: 0,
    DAILY_LIMIT: 0,
  };
  const trades: BacktestTrade[] = [];
  const costSums = { spread: 0, slippage: 0, commission: 0, total: 0 };
  let equity = startEquity;
  let cursor = range.from;
  const toIdx = lowerBound(series.t, 0, series.length, range.to);

  for (let i = 0; i < count; i++) {
    const fromIdx = lowerBound(series.t, 0, toIdx, cursor);
    if (fromIdx >= toIdx) break;
    // Draw from a window sized to this trade's fair share of what's left, not the whole
    // remaining range - otherwise an early draw can by chance consume most of it, starving
    // later trades (a classic stick-breaking bias) and silently under-filling `count`.
    const share = Math.max(1, Math.round((toIdx - fromIdx) / (count - i)));
    const windowEnd = Math.min(toIdx, fromIdx + share);
    const idx = fromIdx + randomInt(rng, windowEnd - fromIdx);
    const refPrice = series.c[idx]!;
    const stop = refPrice - dir * stopDist;
    const target = refPrice + dir * targetR * stopDist;
    const order: TradeOrder = {
      direction,
      type: 'MARKET',
      placedAt: series.t[idx]!,
      referencePrice: refPrice,
      stop: roundToTick(inst, stop),
      target: roundToTick(inst, target),
      expiresAt: null,
    };
    if (orderProblem(order) !== null) {
      skipped.INVALID_ORDER++;
      cursor = series.t[idx]! + baseMs;
      continue;
    }
    const size = positionSize(inst, equity, risk.percentPerTrade, refPrice, order.stop, lots);
    if (!size.ok) {
      if (size.reason === 'CROSS_PAIR') skipped.CROSS_PAIR++;
      else skipped.SIZE_TOO_SMALL++;
      cursor = series.t[idx]! + baseMs;
      continue;
    }
    const sim = simulateTrade(order, series, {
      baseMs,
      cutoff: range.to,
      costs: { spread, slippage },
      ambiguity,
      closeAt: range.to,
    });
    if (sim.status !== 'CLOSED') break;
    const lotCount = size.lots;
    const conv = quoteToUsd(inst, sim.exitPrice!) ?? 0;
    const money = (priceMove: number) => priceMove * inst.contractSize * lotCount * conv;
    const gross = tradePnl(inst, direction, lotCount, sim.entryPrice!, sim.exitPrice!) ?? 0;
    const commission = r2(2 * lotCount * costs.commissionPerLotPerSide);
    const pnl = r2(gross - commission);
    equity = r2(equity + pnl);
    const slipped = 1 + (sim.exitReason === 'SL' || sim.exitReason === 'MANUAL' ? 1 : 0);
    costSums.spread += money(spread);
    costSums.slippage += money(slippage) * slipped;
    costSums.commission += commission;
    trades.push({
      setupId: `RANDOM:${seed}:${i}`,
      signalAt: order.placedAt,
      order,
      lots: lotCount,
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
    cursor = sim.exitAt! + baseMs;
  }

  costSums.spread = r2(costSums.spread);
  costSums.slippage = r2(costSums.slippage);
  costSums.commission = r2(costSums.commission);
  costSums.total = r2(costSums.spread + costSums.slippage + costSums.commission);
  return {
    setupsFound: trades.length,
    trades,
    skipped,
    expiredOrders: 0,
    unfilledAtEnd: 0,
    ambiguousTrades: trades.filter((t) => t.ambiguous).length,
    costs: costSums,
    startEquity,
    endEquity: equity,
  };
}
