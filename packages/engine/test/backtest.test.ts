import { describe, expect, it } from 'vitest';
import { runBacktest, type BacktestConfig, type BacktestInput } from '../src/backtest/run';
import { seriesFromRows } from '../src/data/columnar';
import { resample } from '../src/data/resample';
import type { FeatureSet } from '../src/features/compute';
import type { Swing } from '../src/features/types';
import { defaultSpec, type StrategySpec } from '../src/strategy/schema';
import { LONDON_SWEEP } from './helpers/strategies';
import { EUR, MIN, syntheticDataset } from './helpers/synthetic-minutes';

// SYNTHETIC: 1m bars from Tue 2026-01-06 10:00Z, prices in pips around 1.1000. The strategy runs
// on 1m so candles and base bars coincide; detections are hand-written swings.
const T0 = Date.parse('2026-01-06T10:00:00Z');
const at = (i: number) => T0 + i * MIN;
const P = (pips: number) => Math.round((1.1 + pips / 10_000) * 1e5) / 1e5;
type Bar = [number, number, number, number];

function input(
  path: Bar[],
  swingLows: number[],
  spec: Partial<StrategySpec> = {},
  config: Partial<BacktestConfig> = {},
  skipMinutes: number[] = [],
): BacktestInput {
  const rows = path
    .map(([o, h, l, c], i) => ({ t: at(i), o: P(o), h: P(h), l: P(l), c: P(c) }))
    .filter((_, i) => !skipMinutes.includes(i));
  const series = seriesFromRows(rows, false);
  const asOf = rows[rows.length - 1]!.t + MIN;
  const candles = resample(series, EUR, '1m', { asOf });
  const index = (t: number) => candles.findIndex((c) => c.t === t);
  const swings: Swing[] = swingLows.map((i) => ({
    id: `sw${i}`,
    defVersion: 'v1',
    type: 'SWING',
    kind: 'LOW',
    price: P(path[i]![2]),
    formedAt: at(i),
    formedIndex: index(at(i)),
    confirmedAt: at(i + 2), // pretend right = 1
    confirmedIndex: index(at(i + 1)),
  }));
  const features: FeatureSet = { swings, fvgs: [], breaks: [], sweeps: [], periods: [] };
  return {
    spec: {
      ...defaultSpec(),
      timeframe: '1m',
      steps: [{ id: 'low', type: 'SWING', kind: 'LOW' }],
      entry: { type: 'MARKET' },
      stop: { type: 'FIXED_PIPS', pips: 10 },
      target: { type: 'R_MULTIPLE', r: 2 },
      risk: { percentPerTrade: 1 },
      ...spec,
    },
    inst: EUR,
    series,
    baseMs: MIN,
    candles,
    features,
    config: {
      range: { from: T0, to: asOf },
      costs: { spreadPips: 0, slippagePips: 0, commissionPerLotPerSide: 0 },
      ambiguity: 'STOP_FIRST',
      startEquity: 10_000,
      lots: { lotStep: 0.01, minLot: 0.01 },
      ...config,
    },
  };
}

const flat = (n: number, p = 0): Bar[] => Array.from({ length: n }, () => [p, p + 1, p - 1, p]);

describe('runBacktest', () => {
  it('trades a market setup with lots from the risk and records costs and R', () => {
    // Swing low at bar 1, known at the close of bar 2 → market entry at bar 3 open (0 + spread 1).
    const path: Bar[] = [...flat(3), [0, 2, -1, 1], [1, 25, 0, 22], ...flat(2, 22)];
    const res = runBacktest(
      input(
        path,
        [1],
        {},
        { costs: { spreadPips: 1, slippagePips: 0, commissionPerLotPerSide: 3.5 } },
      ),
    );
    expect(res.setupsFound).toBe(1);
    const [t] = res.trades;
    // Planned: entry 0 (last close), stop −10, target +20; 1 % of 10 000 = 100 USD / 100 USD per lot.
    expect(t).toMatchObject({
      lots: 1,
      riskAmount: 100,
      entryAt: at(3),
      entryPrice: P(1),
      exit: 'TP',
      exitPrice: P(20),
      commission: 7,
    });
    // 19 pips × 10 USD − 7 commission = 183 USD = 1.83 R.
    expect(t!.pnl).toBe(183);
    expect(t!.r).toBe(1.83);
    expect(t!.priceR).toBeCloseTo(19 / 11, 6);
    expect(res.endEquity).toBe(10_183);
    expect(res.costs).toEqual({ spread: 10, slippage: 0, commission: 7, total: 17 });
  });

  it('takes one position at a time and honours the daily limit', () => {
    // Two swing lows; the second setup appears while the first trade is still open.
    const path: Bar[] = [
      ...flat(3),
      ...flat(4, 1),
      [1, 30, 0, 25],
      ...flat(4, 25),
      [25, 26, 24, 25],
      ...flat(3, 25),
      [25, 50, 24, 48],
    ];
    const res = runBacktest(input(path, [1, 4]));
    expect(res.trades).toHaveLength(1);
    expect(res.skipped.POSITION_OPEN).toBe(1);

    const limited = runBacktest(input(path, [1, 9, 14], { maxTradesPerDay: 1 }));
    expect(limited.trades).toHaveLength(1);
    expect(limited.skipped.DAILY_LIMIT).toBeGreaterThanOrEqual(1);
  });

  it('skips invalid orders, too-small sizes and setups over missing data', () => {
    const path: Bar[] = [...flat(3), ...flat(6, 1)];
    // Stop "beyond" a reference above the entry for a long: invalid.
    const invalid = runBacktest(
      input(path, [1], { stop: { type: 'BEYOND_REF', ref: 'low.price', bufferPips: -20 } }),
    );
    expect(invalid.skipped.INVALID_ORDER).toBe(1);
    const small = runBacktest(input(path, [1], {}, { startEquity: 50 }));
    expect(small.skipped.SIZE_TOO_SMALL).toBe(1);
    // Minute 1 is missing while the market was open, inside the setup's bars.
    const gap = runBacktest(input(path, [2], {}, {}, [1]));
    expect(gap.skipped.DATA_GAP).toBe(1);
    expect(gap.trades).toEqual([]);
  });

  it('counts expired limit orders and closes open trades at the end of the range', () => {
    const path: Bar[] = [...flat(3), ...flat(10, 3)];
    const expired = runBacktest(
      input(path, [1], {
        steps: [{ id: 'low', type: 'SWING', kind: 'LOW' }],
        entry: { type: 'LIMIT_AT', ref: 'low.price', expireBars: 3 },
      }),
    );
    // Limit at the swing low (−1), price never comes back below 2.
    expect(expired.expiredOrders).toBe(1);

    const open = runBacktest(input(path, [1]));
    expect(open.trades[0]).toMatchObject({ exit: 'END_OF_RANGE', exitAt: at(12) });
  });

  it('flags same-bar stop and target and applies the pessimistic rule', () => {
    // Market fill at the bar 3 open; bar 4 reaches both the stop (−10) and the target (+20).
    const later: Bar[] = [...flat(4), [0, 25, -15, 0], ...flat(2)];
    const amb = runBacktest(input(later, [1]));
    expect(amb.trades[0]).toMatchObject({ exit: 'SL', ambiguous: true });
    expect(amb.ambiguousTrades).toBe(1);
    const optimistic = runBacktest(input(later, [1], {}, { ambiguity: 'TARGET_FIRST' }));
    expect(optimistic.trades[0]).toMatchObject({ exit: 'TP' });
  });

  it('is deterministic on generated data with a multi-step strategy', () => {
    const ds = syntheticDataset('2026-01-04T22:00:00Z', '2026-01-16T22:00:00Z', 5);
    const spec: StrategySpec = {
      ...LONDON_SWEEP,
      window: null,
      steps: [
        { id: 'sweep', type: 'LIQUIDITY_SWEEP', direction: 'BULLISH' },
        { id: 'mss', type: 'STRUCTURE_BREAK', direction: 'BULLISH', maxBars: 12 },
      ],
      entry: { type: 'MARKET' },
      timeframe: '5m',
    };
    const full = ds.at(ds.end, '5m', spec.features);
    const make = (): BacktestInput => ({
      spec,
      inst: EUR,
      series: ds.series,
      baseMs: MIN,
      candles: full.candles,
      features: full.features,
      config: {
        range: { from: Date.parse('2026-01-05T00:00:00Z'), to: ds.end },
        costs: { spreadPips: 0.2, slippagePips: 0.1, commissionPerLotPerSide: 3.5 },
        ambiguity: 'STOP_FIRST',
        startEquity: 10_000,
        lots: { lotStep: 0.01, minLot: 0.01 },
      },
    });
    const a = runBacktest(make());
    const b = runBacktest(make());
    expect(a).toEqual(b);
    expect(a.trades.length).toBeGreaterThan(5);
    // Trades never overlap and equity follows the P/L.
    for (let i = 1; i < a.trades.length; i++)
      expect(a.trades[i]!.signalAt).toBeGreaterThan(a.trades[i - 1]!.exitAt);
    const sum = a.trades.reduce((s, t) => s + t.pnl, 0);
    expect(a.endEquity).toBeCloseTo(10_000 + sum, 6);
  });
});
