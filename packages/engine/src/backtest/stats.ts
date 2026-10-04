import { utcToLocal } from '../core/tz';
import type { UtcMs } from '../core/types';
import type { Instrument } from '../instruments/registry';
import { BUILTIN_SESSIONS, type SessionDefinition } from '../session/sessions';
import { activeSessions, tradeStats, type TradeStats } from '../user/journal';
import type { BacktestResult, BacktestTrade } from './run';

export interface BreakdownRow {
  key: string;
  trades: number;
  wins: number;
  winRate: number | null;
  avgR: number | null;
  totalR: number;
}

export interface BacktestStats {
  /** Measured on net R (after all costs), in trade order. */
  summary: TradeStats;
  netPnl: number;
  returnPct: number;
  maxDrawdownUsd: number;
  maxDrawdownPct: number;
  /** Starts at the range start with the starting equity, then one point per closed trade. */
  equity: { t: UtcMs; equity: number }[];
  /** Counts per 0.5 R bucket; `from` is the lower edge. */
  rDistribution: { from: number; count: number }[];
  /** By month (UTC) of the entry. */
  monthly: BreakdownRow[];
  /** By built-in session active at the signal (a trade in an overlap counts in both); NONE = outside. */
  bySession: BreakdownRow[];
  /** By ISO weekday (1 = Monday) of the signal in New York time (the trading-day clock, D11). */
  byWeekday: BreakdownRow[];
}

const round = (x: number, d = 1e6) => Math.round(x * d) / d;

function rows(groups: Map<string, BacktestTrade[]>): BreakdownRow[] {
  return [...groups.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, ts]) => {
      const s = tradeStats(ts.map((t) => ({ r: t.r })));
      return {
        key,
        trades: s.trades,
        wins: s.wins,
        winRate: s.winRate,
        avgR: s.avgR,
        totalR: s.totalR,
      };
    });
}

function group(trades: readonly BacktestTrade[], keys: (t: BacktestTrade) => string[]) {
  const m = new Map<string, BacktestTrade[]>();
  for (const t of trades) for (const k of keys(t)) m.set(k, [...(m.get(k) ?? []), t]);
  return m;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Statistics of one backtest; only measured values, never a predicted probability (rule 6). */
export function backtestStats(
  res: BacktestResult,
  inst: Instrument,
  rangeFrom: UtcMs,
  /** Sessions for the by-session breakdown (built-in + the strategy's user sessions). */
  sessionDefs: readonly SessionDefinition[] = BUILTIN_SESSIONS,
): BacktestStats {
  const trades = res.trades;
  const summary = tradeStats(trades.map((t) => ({ r: t.r, ambiguous: t.ambiguous })));
  const equity = [{ t: rangeFrom, equity: res.startEquity }];
  let peak = res.startEquity;
  let ddUsd = 0;
  let ddPct = 0;
  for (const t of trades) {
    equity.push({ t: t.exitAt, equity: t.equityAfter });
    peak = Math.max(peak, t.equityAfter);
    ddUsd = Math.max(ddUsd, peak - t.equityAfter);
    ddPct = Math.max(ddPct, ((peak - t.equityAfter) / peak) * 100);
  }
  const buckets = new Map<number, number>();
  for (const t of trades) {
    const from = Math.floor(t.r * 2) / 2;
    buckets.set(from, (buckets.get(from) ?? 0) + 1);
  }
  const netPnl = round(res.endEquity - res.startEquity, 100);
  return {
    summary,
    netPnl,
    returnPct: round((netPnl / res.startEquity) * 100, 100),
    maxDrawdownUsd: round(ddUsd, 100),
    maxDrawdownPct: round(ddPct, 100),
    equity,
    rDistribution: [...buckets.entries()]
      .sort(([a], [b]) => a - b)
      .map(([from, count]) => ({ from, count })),
    monthly: rows(
      group(trades, (t) => {
        const d = new Date(t.entryAt);
        return [`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`];
      }),
    ),
    bySession: rows(
      group(trades, (t) => {
        const s = activeSessions(sessionDefs, inst, t.signalAt);
        return s.length ? s : ['NONE'];
      }),
    ),
    byWeekday: rows(
      group(trades, (t) => [String(utcToLocal(t.signalAt, 'America/New_York').weekday)]),
    ),
  };
}
