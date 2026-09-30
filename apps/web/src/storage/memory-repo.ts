import type { CandleSeries, DataSetMeta } from '@trw/engine';
import type { MarketRepo } from './market-repo';

/** Non-persistent repo for tests and as a fallback when IndexedDB is unavailable. */
export function createMemoryRepo(): MarketRepo {
  const metas = new Map<string, DataSetMeta>();
  const series = new Map<string, CandleSeries>();
  return {
    listDatasets: async () => [...metas.values()],
    loadSeries: async (id) => {
      const s = series.get(id);
      if (!s) throw new Error(`Dataset not found: ${id}`);
      return s;
    },
    saveDataset: async (meta, s) => {
      metas.set(meta.id, meta);
      series.set(meta.id, s);
    },
    deleteDataset: async (id) => {
      metas.delete(id);
      series.delete(id);
    },
  };
}
