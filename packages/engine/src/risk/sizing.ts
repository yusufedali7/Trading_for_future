import type { Direction } from '../execution/trade-sim';
import type { Instrument } from '../instruments/registry';

/**
 * USD value of a price move of 1.0 per unit of base currency, at `price` (account currency is
 * USD, D32). USD-quoted (EURUSD, XAUUSD): 1. USD-based (USDJPY): 1 / price. Crosses (EURGBP)
 * need a second price series and are not supported in v1: null.
 */
export function quoteToUsd(inst: Instrument, price: number): number | null {
  if (inst.quote === 'USD') return 1;
  if (inst.base === 'USD') return 1 / price;
  return null;
}

/** USD value of one pip for one lot at `price`. */
export function pipValuePerLot(inst: Instrument, price: number): number | null {
  const conv = quoteToUsd(inst, price);
  return conv === null ? null : inst.pipSize * inst.contractSize * conv;
}

export interface LotRules {
  lotStep: number;
  minLot: number;
}

export const DEFAULT_LOT_RULES: LotRules = { lotStep: 0.01, minLot: 0.01 };

/** The instrument's own lot rules (D75): metadata lives in one place (CLAUDE.md). */
export function lotRules(inst: Instrument): LotRules {
  return { lotStep: inst.lotStep, minLot: inst.minLot };
}

export type SizeResult =
  | { ok: true; lots: number; riskAmount: number }
  | { ok: false; reason: 'CROSS_PAIR' | 'SIZE_TOO_SMALL' | 'NO_RISK' };

/**
 * Lots so that a stop-out loses at most `riskPct` % of equity, rounded DOWN to the lot step
 * (never risking more than asked). `riskAmount` is the money actually at risk after rounding.
 */
export function positionSize(
  inst: Instrument,
  equity: number,
  riskPct: number,
  entry: number,
  stop: number,
  rules: LotRules = DEFAULT_LOT_RULES,
): SizeResult {
  const conv = quoteToUsd(inst, entry);
  if (conv === null) return { ok: false, reason: 'CROSS_PAIR' };
  const perLot = Math.abs(entry - stop) * inst.contractSize * conv;
  if (!(perLot > 0) || !(equity > 0)) return { ok: false, reason: 'NO_RISK' };
  const budget = (equity * riskPct) / 100;
  // Integer step counting avoids float drift (0.07 / 0.01 = 7.000000000000001).
  const steps = Math.floor(budget / perLot / rules.lotStep + 1e-9);
  const lots = Math.round(steps * rules.lotStep * 1e8) / 1e8;
  if (lots < rules.minLot) return { ok: false, reason: 'SIZE_TOO_SMALL' };
  return { ok: true, lots, riskAmount: Math.round(lots * perLot * 100) / 100 };
}

/** Profit or loss in USD of `lots` from entry to exit (prices already include spread/slippage). */
export function tradePnl(
  inst: Instrument,
  direction: Direction,
  lots: number,
  entry: number,
  exit: number,
): number | null {
  const conv = quoteToUsd(inst, exit);
  if (conv === null) return null;
  const move = direction === 'LONG' ? exit - entry : entry - exit;
  return Math.round(move * inst.contractSize * lots * conv * 100) / 100;
}
