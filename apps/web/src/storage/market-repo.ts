import type { CandleSeries, DataSetMeta } from '@trw/engine';

/** Market-data domain storage. Kept separate from user, strategy and research data. */
export interface MarketRepo {
  listDatasets(): Promise<DataSetMeta[]>;
  loadSeries(id: string): Promise<CandleSeries>;
  saveDataset(meta: DataSetMeta, series: CandleSeries): Promise<void>;
  deleteDataset(id: string): Promise<void>;
}
