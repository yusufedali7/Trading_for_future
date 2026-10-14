import { describe, expect, it } from 'vitest';
import { getInstrument } from '../src/instruments/registry';
import type { BacktestResult, BacktestTrade } from '../src/backtest/run';
import type { StoredBacktest } from '../src/backtest/record';
import { tradeStats } from '../src/user/journal';
import {
  interpretRun,
  randomBaselineParams,
  randomComparison,
  type Finding,
} from '../src/research/interpret';

const EUR = getInstrument('EURUSD');

/** SYNTHETIC: a long trade with a planned 10-pip stop and 20-pip target, closing at `r`. */
function trade(r: number, extra: Partial<BacktestTrade> = {}): BacktestTrade {
  return {
    setupId: `s${r}`,
    signalAt: 0,
    order: {
      direction: 'LONG',
      type: 'MARKET',
      placedAt: 0,
      referencePrice: 1.1,
      stop: 1.099,
      target: 1.102,
      expiresAt: null,
    },
    lots: 1,
    riskAmount: 100,
    entryAt: 0,
    entryPrice: 1.1,
    exitAt: 1,
    exitPrice: 1.1,
    exit: r > 0 ? 'TP' : 'SL',
    priceR: r,
    commission: 0,
    pnl: r * 100,
    r,
    maeR: 0,
    mfeR: 0,
    barsHeld: 1,
    ambiguous: false,
    equityAfter: 0,
    ...extra,
  };
}

function result(trades: BacktestTrade[], costsTotal = 0): BacktestResult {
  return {
    setupsFound: trades.length,
    trades,
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
    ambiguousTrades: trades.filter((t) => t.ambiguous).length,
    costs: { spread: costsTotal, slippage: 0, commission: 0, total: costsTotal },
    startEquity: 10_000,
    endEquity: 10_000,
  };
}

function stored(
  rs: number[],
  o: {
    role?: 'FULL' | 'IN_SAMPLE' | 'OUT_OF_SAMPLE';
    trial?: number | null;
    costs?: number;
    ambiguous?: number;
    random?: StoredBacktest['random'];
  } = {},
): StoredBacktest {
  const trades = rs.map((r, i) => trade(r, { ambiguous: i < (o.ambiguous ?? 0) }));
  const res = result(trades, o.costs ?? 0);
  const netPnl = trades.reduce((s, t) => s + t.pnl, 0);
  return {
    run: {
      split: { role: o.role ?? 'FULL', boundary: null },
      inSampleTrial: o.trial ?? null,
    } as StoredBacktest['run'],
    result: res,
    stats: {
      summary: tradeStats(trades.map((t) => ({ r: t.r, ambiguous: t.ambiguous }))),
      netPnl,
    } as StoredBacktest['stats'],
    ...(o.random ? { random: o.random } : {}),
  };
}

const codes = (fs: Finding[]) => fs.map((f) => f.code);
const many = (n: number, r: number) => Array.from({ length: n }, () => r);

describe('randomBaselineParams', () => {
  it('matches the real trades: count, average planned stop in pips, average planned target R', () => {
    const wide = trade(1, {
      order: { ...trade(1).order, stop: 1.098, target: 1.106 }, // 20 pip stop, 3R
    });
    expect(randomBaselineParams(EUR, [trade(-1), wide])).toEqual({
      count: 2,
      stopPips: 15,
      targetR: 2.5,
    });
  });

  it('uses the trigger price of limit/stop orders as the planned entry', () => {
    const limit = trade(1, {
      order: { ...trade(1).order, type: 'LIMIT', price: 1.099, stop: 1.098, target: 1.101 },
    });
    expect(randomBaselineParams(EUR, [limit])).toEqual({ count: 1, stopPips: 10, targetR: 2 });
  });

  it('has nothing to compare without trades', () => {
    expect(randomBaselineParams(EUR, [])).toBeNull();
  });
});

describe('randomComparison', () => {
  it('reports the edge over random entries with a seeded bootstrap interval', () => {
    const real = result([...many(20, 2), ...many(20, -1)].map((r) => trade(r)));
    const rand = result([...many(10, 2), ...many(30, -1)].map((r) => trade(r)));
    const p = { seed: 1, stopPips: 10, targetR: 2 };
    const a = randomComparison(real, rand, p);
    expect(a).toMatchObject({ seed: 1, stopPips: 10, targetR: 2, trades: 40, avgR: -0.25 });
    expect(a.edgeR).toBeCloseTo(0.75, 9);
    expect(a.edgeCI!.low).toBeLessThan(0.75);
    expect(a.edgeCI!.high).toBeGreaterThan(0.75);
    expect(randomComparison(real, rand, p)).toEqual(a);
  });

  it('has no interval when the random side produced no trades', () => {
    const c = randomComparison(result([trade(1)]), result([]), {
      seed: 1,
      stopPips: 10,
      targetR: 2,
    });
    expect(c.edgeCI).toBeNull();
    expect(c.trades).toBe(0);
  });
});

describe('interpretRun (reading notes from measured numbers only)', () => {
  it('stops at "no trades" when there is nothing to read', () => {
    expect(codes(interpretRun({ b: stored([]) }))).toEqual(['NO_TRADES']);
  });

  it('flags a small sample', () => {
    const f = interpretRun({ b: stored(many(12, 1)) });
    expect(f.find((x) => x.code === 'LOW_SAMPLE')).toEqual({
      code: 'LOW_SAMPLE',
      severity: 'WARN',
      params: { trades: 12 },
    });
    expect(codes(interpretRun({ b: stored(many(30, 1)) }))).not.toContain('LOW_SAMPLE');
  });

  it('reminds that results on the tuning data are optimistic until tested out of sample', () => {
    expect(codes(interpretRun({ b: stored(many(30, 1)) }))).toContain('NO_OUT_OF_SAMPLE');
    expect(codes(interpretRun({ b: stored(many(30, 1), { role: 'IN_SAMPLE' }) }))).toContain(
      'NO_OUT_OF_SAMPLE',
    );
    expect(
      codes(interpretRun({ b: stored(many(30, 1), { role: 'OUT_OF_SAMPLE' }) })),
    ).not.toContain('NO_OUT_OF_SAMPLE');
  });

  it('compares an out-of-sample run with its in-sample run', () => {
    const is = stored([...many(20, 2), ...many(20, -1)]); // avgR 0.5
    const worse = stored([...many(12, 2), ...many(28, -1)], { role: 'OUT_OF_SAMPLE' }); // -0.1
    const held = stored([...many(18, 2), ...many(22, -1)], { role: 'OUT_OF_SAMPLE' }); // 0.35
    const d = interpretRun({ b: worse, inSample: is }).find((x) => x.code === 'OOS_DEGRADATION')!;
    expect(d.severity).toBe('CAUTION');
    expect(d.params.isAvgR).toBeCloseTo(0.5, 9);
    expect(d.params.oosAvgR).toBeCloseTo(-0.1, 9);
    expect(codes(interpretRun({ b: held, inSample: is }))).toContain('OOS_HELD');
    expect(codes(interpretRun({ b: held, inSample: null }))).not.toContain('OOS_HELD');
  });

  it('warns when many in-sample trials were made', () => {
    const f = interpretRun({ b: stored(many(30, 1), { role: 'IN_SAMPLE', trial: 6 }) });
    expect(f.find((x) => x.code === 'MANY_TRIALS')!.params).toEqual({ trials: 6 });
    expect(
      codes(interpretRun({ b: stored(many(30, 1), { role: 'IN_SAMPLE', trial: 2 }) })),
    ).not.toContain('MANY_TRIALS');
  });

  it('notes when a large share of trades hit stop and target in the same bar', () => {
    const f = interpretRun({ b: stored(many(30, 1), { ambiguous: 6 }) });
    expect(f.find((x) => x.code === 'AMBIGUOUS_SHARE')!.params).toEqual({ count: 6, pct: 20 });
    expect(codes(interpretRun({ b: stored(many(30, 1), { ambiguous: 2 }) }))).not.toContain(
      'AMBIGUOUS_SHARE',
    );
  });

  it('notes when costs eat a large share of the gross result', () => {
    // net 30 × 100 = 3000 USD, costs 3000 → gross 6000, costs are 50% of it.
    const f = interpretRun({ b: stored(many(30, 1), { costs: 3000 }) });
    expect(f.find((x) => x.code === 'COSTS_HEAVY')!.params).toEqual({ pct: 50 });
    expect(codes(interpretRun({ b: stored(many(30, 1), { costs: 100 }) }))).not.toContain(
      'COSTS_HEAVY',
    );
  });

  it('reads the random-entry comparison by whether its interval excludes zero', () => {
    const base = { seed: 1, stopPips: 10, targetR: 2, trades: 30, avgR: 0 };
    const read = (low: number, high: number) =>
      interpretRun({
        b: stored(many(30, 1), {
          random: { ...base, edgeR: (low + high) / 2, edgeCI: { low, high } },
        }),
      }).find((x) => x.code.includes('RANDOM'))!;
    expect(read(0.1, 0.5)).toMatchObject({ code: 'RANDOM_EDGE', severity: 'INFO' });
    expect(read(-0.2, 0.4)).toMatchObject({ code: 'NO_EDGE_VS_RANDOM', severity: 'CAUTION' });
    expect(read(-0.6, -0.1)).toMatchObject({ code: 'WORSE_THAN_RANDOM', severity: 'WARN' });
    expect(read(0.1, 0.5).params).toEqual({ edgeR: 0.3, low: 0.1, high: 0.5 });
  });

  it('is deterministic: same run, same notes', () => {
    const b = stored(many(12, 1), { ambiguous: 4, costs: 900 });
    expect(interpretRun({ b })).toEqual(interpretRun({ b }));
  });
});
