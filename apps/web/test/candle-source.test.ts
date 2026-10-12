import { describe, expect, it, vi } from 'vitest';
import {
  computeFeatures,
  defaultSpec,
  runBacktest,
  getInstrument,
  previousPeriods,
  replayCandles,
  resample,
  seriesFromRows,
  seriesUpTo,
  sessionLevels,
  simulateTrade,
  type DataSetMeta,
} from '@trw/engine';
import { composeReplay, createInProcessCandleSource } from '../src/compute/candle-source';
import { createMemoryRepo } from '../src/storage/memory-repo';

// SYNTHETIC: 30 hand-generated 1m bars, 15:00-15:29 UTC on a Tuesday (inside London and NY).
const rows = Array.from({ length: 30 }, (_, i) => ({
  t: Date.parse('2026-01-06T15:00:00Z') + i * 60_000,
  o: 1 + i,
  h: 1.5 + i,
  l: 0.5 + i,
  c: 1.25 + i,
  v: 1,
}));
const series = seriesFromRows(rows, true);
const meta = { id: 'd1', instrument: 'EURUSD', baseTimeframe: '1m' } as DataSetMeta;
const asOf = rows[29]!.t + 60_000;

async function source() {
  const repo = createMemoryRepo();
  await repo.saveDataset({ ...meta, contentHash: series.contentHash } as DataSetMeta, series);
  return { repo, source: createInProcessCandleSource(repo) };
}

describe('in-process candle source', () => {
  it('returns the same candles as the engine resampler, as of the last bar close', async () => {
    const { source: s } = await source();
    const { candles } = await s.load(meta, '15m');
    expect(candles).toEqual(resample(series, getInstrument('EURUSD'), '15m', { asOf }));
    expect(candles.map((c) => c.complete)).toEqual([true, true]);
  });

  it('includes session levels computed from the base bars, still running at the data end', async () => {
    const { source: s } = await source();
    const { sessions } = await s.load(meta, '1h');
    expect(sessions.map((x) => [x.sessionId, x.date])).toEqual([
      ['LONDON', '2026-01-06'],
      ['NEW_YORK', '2026-01-06'],
    ]);
    expect(sessions[0]).toMatchObject({
      high: 30.5,
      low: 0.5,
      barCount: 30,
      complete: false,
      knownAt: asOf,
    });
  });

  it('loads each dataset from storage only once', async () => {
    const { repo, source: s } = await source();
    const spy = vi.spyOn(repo, 'loadSeries');
    await s.load(meta, '15m');
    await s.load(meta, '1h');
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe('replay through the candle source', () => {
  // SYNTHETIC: two hours of 1m bars inside London + New York.
  const many = Array.from({ length: 120 }, (_, i) => {
    const mid = 1.1 + ((i * 7) % 11) / 10_000;
    return {
      t: Date.parse('2026-01-06T13:00:00Z') + i * 60_000,
      o: mid,
      h: mid + 0.0002,
      l: mid - 0.0003,
      c: mid + 0.0001,
      v: 1,
    };
  });
  const s2 = seriesFromRows(many, true);
  const meta2 = {
    id: 'd2',
    instrument: 'EURUSD',
    baseTimeframe: '1m',
    contentHash: s2.contentHash,
  } as DataSetMeta;

  async function source2() {
    const repo = createMemoryRepo();
    await repo.saveDataset(meta2, s2);
    return createInProcessCandleSource(repo);
  }

  it('composes exactly what the engine computes on data truncated at the cursor', async () => {
    const src = await source2();
    const full = await src.load(meta2, '15m');
    for (const cursor of [
      '2026-01-06T13:15:00Z',
      '2026-01-06T13:37:00Z',
      '2026-01-06T14:30:00Z',
    ].map(Date.parse)) {
      const view = composeReplay(full, await src.replay(meta2, '15m', cursor), cursor);
      expect(view.candles).toEqual(
        replayCandles(full.candles, s2, getInstrument('EURUSD'), '15m', cursor),
      );
      const instances = full.sessions.map(({ sessionId, version, date, startUtc, endUtc }) => ({
        sessionId,
        version,
        date,
        startUtc,
        endUtc,
      }));
      expect(view.sessions).toEqual(sessionLevels(s2, instances, cursor));
    }
  });

  it('shows only the candidates known at the cursor (same as computing on cut data)', async () => {
    const src = await source2();
    const full = await src.load(meta2, '1m');
    expect(full.features.swings.length).toBeGreaterThan(2);
    const inst = getInstrument('EURUSD');
    for (const cursor of [
      '2026-01-06T13:42:00Z',
      '2026-01-06T14:10:00Z',
      '2026-01-06T14:59:00Z',
    ].map(Date.parse)) {
      const view = composeReplay(full, await src.replay(meta2, '1m', cursor), cursor);
      const cut = seriesUpTo(s2, cursor, 60_000);
      expect(view.features).toEqual(
        computeFeatures({
          candles: view.candles,
          inst,
          tf: '1m',
          periods: previousPeriods(cut, inst, cursor),
          sessions: view.sessions,
        }),
      );
    }
  });

  it('runs a strategy backtest and lists its setups with the shared engine', async () => {
    const src = await source2();
    const spec = {
      ...defaultSpec(),
      timeframe: '1m' as const,
      steps: [{ id: 'low', type: 'SWING' as const, kind: 'LOW' as const }],
      stop: { type: 'FIXED_PIPS' as const, pips: 3 },
    };
    const config = {
      range: { from: many[0]!.t, to: many[many.length - 1]!.t + 60_000 },
      costs: { spreadPips: 0.2, slippagePips: 0, commissionPerLotPerSide: 3 },
      ambiguity: 'STOP_FIRST' as const,
      startEquity: 10_000,
      lots: { lotStep: 0.01, minLot: 0.01 },
    };
    const out = await src.backtest(meta2, spec, config);
    const inst = getInstrument('EURUSD');
    const candles = resample(s2, inst, '1m', { asOf: config.range.to });
    const features = computeFeatures({
      candles,
      inst,
      tf: '1m',
      periods: previousPeriods(s2, inst, config.range.to),
      sessions: (await src.load(meta2, '1m')).sessions,
    });
    const direct = runBacktest({
      spec,
      inst,
      series: s2,
      baseMs: 60_000,
      candles,
      features,
      config,
    });
    expect(out.result).toEqual(direct);
    expect(out.result.trades.length).toBeGreaterThan(0);
    expect(out.stats.summary.trades).toBe(direct.trades.length);
    expect((await src.setups(meta2, spec)).length).toBe(direct.setupsFound);
    await expect(src.backtest(meta2, { ...spec, instrument: 'XAUUSD' }, config)).rejects.toThrow();
  });

  it('draftsSince (D70) only turns setups confirmed after the watch start into drafts', async () => {
    const src = await source2();
    const spec = {
      ...defaultSpec(),
      timeframe: '1m' as const,
      steps: [{ id: 'low', type: 'SWING' as const, kind: 'LOW' as const }],
      stop: { type: 'FIXED_PIPS' as const, pips: 3 },
    };
    const all = await src.setups(meta2, spec);
    expect(all.length).toBeGreaterThan(1);
    const lots = { lotStep: 0.01, minLot: 0.01 };

    const fromStart = await src.draftsSince(meta2, spec, 'strat1', 1, 0, 10_000, lots);
    expect(fromStart.drafts.length).toBeGreaterThan(0);
    expect(fromStart.drafts.length + fromStart.skipped).toBe(all.length);
    expect(
      fromStart.drafts.every((d) => d.strategyId === 'strat1' && d.strategyVersion === 1),
    ).toBe(true);

    const afterAll = await src.draftsSince(
      meta2,
      spec,
      'strat1',
      1,
      all[all.length - 1]!.signalAt,
      10_000,
      lots,
    );
    expect(afterAll.drafts).toEqual([]);
    expect(afterAll.skipped).toBe(0);

    if (all.length > 1) {
      const midSince = all[0]!.signalAt;
      const partial = await src.draftsSince(meta2, spec, 'strat1', 1, midSince, 10_000, lots);
      expect(partial.drafts.length + partial.skipped).toBeLessThan(all.length);
    }
  });

  it('simulates a trade with the series it holds, never past the cursor', async () => {
    const src = await source2();
    const order = {
      direction: 'LONG' as const,
      type: 'MARKET' as const,
      placedAt: Date.parse('2026-01-06T13:10:00Z'),
      referencePrice: 1.1,
      stop: 1.099,
      target: 1.102,
      expiresAt: null,
    };
    const opts = {
      cutoff: Date.parse('2026-01-06T13:30:00Z'),
      costs: { spread: 0, slippage: 0 },
      ambiguity: 'STOP_FIRST' as const,
    };
    expect(await src.simulate(meta2, order, opts)).toEqual(
      simulateTrade(order, s2, { ...opts, baseMs: 60_000 }),
    );
  });
});
