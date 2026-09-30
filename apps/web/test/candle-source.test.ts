import { describe, expect, it, vi } from 'vitest';
import { getInstrument, resample, seriesFromRows, type DataSetMeta } from '@trw/engine';
import { createInProcessCandleSource } from '../src/compute/candle-source';
import { createMemoryRepo } from '../src/storage/memory-repo';

// SYNTHETIC: 30 hand-generated 1m bars.
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

describe('in-process candle source', () => {
  it('returns the same candles as the engine resampler, as of the last bar close', async () => {
    const repo = createMemoryRepo();
    await repo.saveDataset({ ...meta, contentHash: series.contentHash } as DataSetMeta, series);
    const source = createInProcessCandleSource(repo);
    const out = await source.candles(meta, '15m');
    expect(out).toEqual(
      resample(series, getInstrument('EURUSD'), '15m', { asOf: rows[29]!.t + 60_000 }),
    );
    expect(out.map((c) => c.complete)).toEqual([true, true]);
  });

  it('loads each dataset from storage only once', async () => {
    const repo = createMemoryRepo();
    await repo.saveDataset({ ...meta, contentHash: series.contentHash } as DataSetMeta, series);
    const spy = vi.spyOn(repo, 'loadSeries');
    const source = createInProcessCandleSource(repo);
    await source.candles(meta, '15m');
    await source.candles(meta, '1h');
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
