import { describe, expect, it, vi } from 'vitest';
import { getInstrument, resample, seriesFromRows, type DataSetMeta } from '@trw/engine';
import { createInProcessCandleSource } from '../src/compute/candle-source';
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
