import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { hashColumns, seriesFromRows, type DataSetMeta } from '@trw/engine';
import { createDexieMarketRepo } from '../src/storage/db-market';

// SYNTHETIC: hand-written bars for storage round-trips only.
const rows = Array.from({ length: 5 }, (_, i) => ({
  t: Date.parse('2026-01-06T15:00:00Z') + i * 60_000,
  o: 1.085 + i / 1e5,
  h: 1.0852 + i / 1e5,
  l: 1.0849 + i / 1e5,
  c: 1.0851 + i / 1e5,
  v: i + 0.5,
}));

function meta(id: string, importedAt: number, series = seriesFromRows(rows, true)): DataSetMeta {
  return {
    id,
    instrument: 'EURUSD',
    baseTimeframe: '1m',
    priceType: 'BID',
    source: {
      name: 'SYNTHETIC',
      fileName: 'SYNTHETIC_test.csv',
      sourceTimezone: 'UTC',
      mapping: {
        hasHeader: true,
        time: { kind: 'SINGLE', column: 0 },
        dateFormat: 'UNIX_MS',
        open: 1,
        high: 2,
        low: 3,
        close: 4,
      },
      importedAt,
    },
    range: { from: series.t[0]!, to: series.t[series.length - 1]! },
    candleCount: series.length,
    contentHash: series.contentHash,
    engineVersion: '0.1.0',
    validation: {
      recordCount: series.length,
      inferredTimeframe: '1m',
      duplicates: [],
      outOfOrder: [],
      gaps: [],
      closedMarketGaps: 0,
      closedMarketCandles: [],
      nonPositive: [],
      ohlcInconsistent: [],
      precisionOverflow: [],
    },
    parseErrors: [],
    dstIssues: [],
    acceptedIssues: [],
    demo: false,
  };
}

let dbCounter = 0;
const freshRepo = (chunkSize?: number) =>
  createDexieMarketRepo({ dbName: `trw-market-test-${dbCounter++}`, chunkSize });

describe('Dexie market repo', () => {
  it('round-trips a series split across several chunks with an identical hash', async () => {
    const repo = freshRepo(2); // 5 bars → chunks of 2, 2, 1
    const series = seriesFromRows(rows, true);
    await repo.saveDataset(meta('a', 1), series);
    const loaded = await repo.loadSeries('a');
    expect(loaded.length).toBe(5);
    expect(Array.from(loaded.t)).toEqual(Array.from(series.t));
    expect(Array.from(loaded.c)).toEqual(Array.from(series.c));
    expect(Array.from(loaded.v!)).toEqual(Array.from(series.v!));
    expect(hashColumns(loaded)).toBe(series.contentHash);
    expect(loaded.contentHash).toBe(series.contentHash);
  });

  it('keeps series without volume volume-less', async () => {
    const repo = freshRepo();
    const series = seriesFromRows(rows, false);
    await repo.saveDataset(meta('nv', 1, series), series);
    expect((await repo.loadSeries('nv')).v).toBeNull();
  });

  it('lists datasets newest import first', async () => {
    const repo = freshRepo();
    const s = seriesFromRows(rows, true);
    await repo.saveDataset(meta('old', 1), s);
    await repo.saveDataset(meta('new', 2), s);
    expect((await repo.listDatasets()).map((m) => m.id)).toEqual(['new', 'old']);
  });

  it('deletes metadata and chunks together', async () => {
    const repo = freshRepo(2);
    const s = seriesFromRows(rows, true);
    await repo.saveDataset(meta('gone', 1), s);
    await repo.deleteDataset('gone');
    expect(await repo.listDatasets()).toEqual([]);
    await expect(repo.loadSeries('gone')).rejects.toThrow(/not found/);
  });

  it('refuses to store a series whose hash does not match its metadata', async () => {
    const repo = freshRepo();
    const s = seriesFromRows(rows, true);
    await expect(repo.saveDataset({ ...meta('bad', 1), contentHash: 'x' }, s)).rejects.toThrow(
      /hash/,
    );
  });
});
