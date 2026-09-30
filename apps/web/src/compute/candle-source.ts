import type { CandleSeries, DataSetMeta, ResampledCandle, Timeframe } from '@trw/engine';
import type { MarketRepo } from '../storage/market-repo';
import { candlesFor } from './resample-for-display';

/** Supplies display candles for a dataset and timeframe; heavy work may run in a worker. */
export interface CandleSource {
  candles(meta: DataSetMeta, tf: Timeframe): Promise<ResampledCandle[]>;
  dispose(): void;
}

/** Keeps the most recently used dataset in memory so timeframe switches don't hit storage. */
export function createInProcessCandleSource(repo: MarketRepo): CandleSource {
  let cached: { key: string; series: CandleSeries } | null = null;
  return {
    async candles(meta, tf) {
      const key = `${meta.id}:${meta.contentHash}`;
      if (cached?.key !== key) cached = { key, series: await repo.loadSeries(meta.id) };
      return candlesFor(meta, cached.series, tf);
    },
    dispose() {
      cached = null;
    },
  };
}

type Request = { id: number; meta: DataSetMeta; tf: Timeframe };
type Response =
  { id: number; ok: true; result: ResampledCandle[] } | { id: number; ok: false; error: string };

export async function handleCandleRequest(source: CandleSource, req: Request): Promise<Response> {
  try {
    return { id: req.id, ok: true, result: await source.candles(req.meta, req.tf) };
  } catch (err) {
    return { id: req.id, ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Runs loading + resampling in a Web Worker that reads IndexedDB itself (no big copies). */
export function createWorkerCandleSource(): CandleSource {
  const worker = new Worker(new URL('../workers/compute.worker.ts', import.meta.url), {
    type: 'module',
  });
  let nextId = 1;
  const pending = new Map<number, (r: Response) => void>();
  worker.onmessage = (e: MessageEvent<Response>) => {
    pending.get(e.data.id)?.(e.data);
    pending.delete(e.data.id);
  };
  return {
    candles: (meta, tf) =>
      new Promise((resolve, reject) => {
        const id = nextId++;
        pending.set(id, (r) => (r.ok ? resolve(r.result) : reject(new Error(r.error))));
        worker.postMessage({ id, meta, tf } satisfies Request);
      }),
    dispose: () => worker.terminate(),
  };
}

export type { Request as CandleRequest };
