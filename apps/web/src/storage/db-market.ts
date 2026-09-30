import Dexie, { type Table } from 'dexie';
import type { CandleSeries, DataSetMeta } from '@trw/engine';
import type { MarketRepo } from './market-repo';

/** One slice of a dataset's columns. Typed arrays are stored as-is (structured clone). */
interface CandleChunk {
  datasetId: string;
  index: number;
  t: Float64Array;
  o: Float64Array;
  h: Float64Array;
  l: Float64Array;
  c: Float64Array;
  v: Float64Array | null;
}

class MarketDb extends Dexie {
  datasets!: Table<DataSetMeta, string>;
  chunks!: Table<CandleChunk, [string, number]>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      datasets: 'id, instrument, source.importedAt',
      chunks: '[datasetId+index], datasetId',
    });
  }
}

const DEFAULT_CHUNK = 50_000;

function concat(parts: Float64Array[], total: number): Float64Array {
  const out = new Float64Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

/** IndexedDB-backed market data store ("trw-market" domain). */
export function createDexieMarketRepo(
  options: { dbName?: string; chunkSize?: number } = {},
): MarketRepo {
  const db = new MarketDb(options.dbName ?? 'trw-market');
  const chunkSize = options.chunkSize ?? DEFAULT_CHUNK;

  return {
    async listDatasets() {
      const all = await db.datasets.toArray();
      return all.sort((a, b) => b.source.importedAt - a.source.importedAt);
    },

    async loadSeries(id) {
      const meta = await db.datasets.get(id);
      if (!meta) throw new Error(`Dataset not found: ${id}`);
      const chunks = await db.chunks.where('datasetId').equals(id).sortBy('index');
      const n = chunks.reduce((sum, ch) => sum + ch.t.length, 0);
      if (n !== meta.candleCount) {
        throw new Error(`Dataset ${id} is incomplete: ${n} of ${meta.candleCount} candles stored`);
      }
      const hasVolume = chunks.every((ch) => ch.v !== null) && chunks.length > 0;
      const series: CandleSeries = {
        length: n,
        t: concat(
          chunks.map((ch) => ch.t),
          n,
        ),
        o: concat(
          chunks.map((ch) => ch.o),
          n,
        ),
        h: concat(
          chunks.map((ch) => ch.h),
          n,
        ),
        l: concat(
          chunks.map((ch) => ch.l),
          n,
        ),
        c: concat(
          chunks.map((ch) => ch.c),
          n,
        ),
        v: hasVolume
          ? concat(
              chunks.map((ch) => ch.v!),
              n,
            )
          : null,
        contentHash: meta.contentHash,
      };
      return series;
    },

    async saveDataset(meta, series) {
      if (meta.contentHash !== series.contentHash) {
        throw new Error('Refusing to save: metadata hash does not match the series content hash');
      }
      const chunks: CandleChunk[] = [];
      for (let start = 0, index = 0; start < series.length; start += chunkSize, index++) {
        const end = Math.min(start + chunkSize, series.length);
        chunks.push({
          datasetId: meta.id,
          index,
          t: series.t.slice(start, end),
          o: series.o.slice(start, end),
          h: series.h.slice(start, end),
          l: series.l.slice(start, end),
          c: series.c.slice(start, end),
          v: series.v ? series.v.slice(start, end) : null,
        });
      }
      await db.transaction('rw', db.datasets, db.chunks, async () => {
        await db.chunks.where('datasetId').equals(meta.id).delete();
        await db.chunks.bulkAdd(chunks);
        await db.datasets.put(meta);
      });
    },

    async deleteDataset(id) {
      await db.transaction('rw', db.datasets, db.chunks, async () => {
        await db.chunks.where('datasetId').equals(id).delete();
        await db.datasets.delete(id);
      });
    },
  };
}
