import { describe, expect, it } from 'vitest';
import type { BacktestResult, BacktestTrade } from '../src/backtest/run';
import { backtestStats } from '../src/backtest/stats';
import { getInstrument } from '../src/instruments/registry';

const EUR = getInstrument('EURUSD');
const t = (iso: string) => Date.parse(iso);

// SYNTHETIC trades: only the fields the statistics read matter.
function trade(signal: string, r: number, equityAfter: number): BacktestTrade {
  const s = t(signal);
  return {
    setupId: signal,
    signalAt: s,
    order: {} as BacktestTrade['order'],
    lots: 1,
    riskAmount: 100,
    entryAt: s + 60_000,
    entryPrice: 1.1,
    exitAt: s + 3_600_000,
    exitPrice: 1.1,
    exit: r > 0 ? 'TP' : 'SL',
    priceR: r,
    commission: 0,
    pnl: r * 100,
    r,
    maeR: 0,
    mfeR: 0,
    barsHeld: 60,
    ambiguous: false,
    equityAfter,
  };
}

const result: BacktestResult = {
  setupsFound: 4,
  trades: [
    trade('2026-01-06T09:00:00Z', 2, 10_200), // Tue, London
    trade('2026-01-07T14:00:00Z', -1, 10_100), // Wed, London + New York
    trade('2026-01-08T03:00:00Z', -1, 10_000), // Thu, Asia
    trade('2026-02-02T23:00:00Z', 1.25, 10_125), // Mon 18:00 NY, outside sessions
  ],
  skipped: {
    DATA_GAP: 0,
    INVALID_ORDER: 0,
    SIZE_TOO_SMALL: 0,
    CROSS_PAIR: 0,
    POSITION_OPEN: 0,
    DAILY_LIMIT: 0,
  },
  expiredOrders: 0,
  unfilledAtEnd: 0,
  ambiguousTrades: 0,
  costs: { spread: 0, slippage: 0, commission: 0, total: 0 },
  startEquity: 10_000,
  endEquity: 10_125,
};

describe('backtestStats', () => {
  const s = backtestStats(result, EUR, t('2026-01-01T00:00:00Z'));

  it('summarises net R, money and drawdown', () => {
    expect(s.summary).toMatchObject({
      trades: 4,
      wins: 2,
      losses: 2,
      winRate: 0.5,
      avgR: 0.3125,
      lowSample: true,
    });
    expect(s.netPnl).toBe(125);
    expect(s.returnPct).toBe(1.25);
    expect(s.maxDrawdownUsd).toBe(200);
    expect(s.maxDrawdownPct).toBeCloseTo((200 / 10_200) * 100, 2);
    expect(s.equity.map((p) => p.equity)).toEqual([10_000, 10_200, 10_100, 10_000, 10_125]);
  });

  it('buckets R by half units', () => {
    expect(s.rDistribution).toEqual([
      { from: -1, count: 2 },
      { from: 1, count: 1 },
      { from: 2, count: 1 },
    ]);
  });

  it('breaks results down by month, session and weekday', () => {
    expect(s.monthly.map((r) => [r.key, r.trades, r.totalR])).toEqual([
      ['2026-01', 3, 0],
      ['2026-02', 1, 1.25],
    ]);
    expect(s.bySession.map((r) => [r.key, r.trades])).toEqual([
      ['ASIA', 1],
      ['LONDON', 2],
      ['NEW_YORK', 1],
      ['NONE', 1],
    ]);
    // Tue 2, Wed 3, Thu 3 (03:00Z = Wed 22:00 NY), Mon 1.
    expect(s.byWeekday.map((r) => [r.key, r.trades])).toEqual([
      ['1', 1],
      ['2', 1],
      ['3', 2],
    ]);
  });
});
