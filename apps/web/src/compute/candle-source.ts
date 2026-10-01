import {
  BUILTIN_SESSIONS,
  getInstrument,
  sessionInstances,
  sessionLevels,
  timeframeMs,
  type CandleSeries,
  type DataSetMeta,
  type ResampledCandle,
  type SessionLevels,
  type Timeframe,
} from '@trw/engine';
import type { MarketRepo } from '../storage/market-repo';
import { candlesFor } from './resample-for-display';

/** Everything the chart needs for one dataset + timeframe. */
export interface ChartData {
  candles: ResampledCandle[];
  /** Built-in sessions with levels from the base bars, as of the last stored bar's close. */
  sessions: SessionLevels[];
}

/** Supplies chart data for a dataset and timeframe; heavy work may run in a worker. */
export interface CandleSource {
  load(meta: DataSetMeta, tf: Timeframe): Promise<ChartData>;
  dispose(): void;
}

function computeSessions(meta: DataSetMeta, series: CandleSeries): SessionLevels[] {
  const first = series.t[0];
  const last = series.t[series.length - 1];
  if (first === undefined || last === undefined) return [];
  const inst = getInstrument(meta.instrument);
  const asOf = last + timeframeMs(meta.baseTimeframe);
  const instances = BUILTIN_SESSIONS.flatMap((def) => sessionInstances(def, inst, first, asOf));
  instances.sort((a, b) => a.startUtc - b.startUtc || a.sessionId.localeCompare(b.sessionId));
  return sessionLevels(series, instances, asOf, timeframeMs(meta.baseTimeframe));
}

/** Keeps the most recently used dataset (and its sessions) in memory between timeframe switches. */
export function createInProcessCandleSource(repo: MarketRepo): CandleSource {
  let cached: { key: string; series: CandleSeries; sessions: SessionLevels[] } | null = null;
  return {
    async load(meta, tf) {
      const key = `${meta.id}:${meta.contentHash}`;
      if (cached?.key !== key) {
        const series = await repo.loadSeries(meta.id);
        cached = { key, series, sessions: computeSessions(meta, series) };
      }
      return { candles: await candlesFor(meta, cached.series, tf), sessions: cached.sessions };
    },
    dispose() {
      cached = null;
    },
  };
}

type Request = { id: number; meta: DataSetMeta; tf: Timeframe };
type Response =
  { id: number; ok: true; result: ChartData } | { id: number; ok: false; error: string };

export async function handleCandleRequest(source: CandleSource, req: Request): Promise<Response> {
  try {
    return { id: req.id, ok: true, result: await source.load(req.meta, req.tf) };
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
    load: (meta, tf) =>
      new Promise((resolve, reject) => {
        const id = nextId++;
        pending.set(id, (r) => (r.ok ? resolve(r.result) : reject(new Error(r.error))));
        worker.postMessage({ id, meta, tf } satisfies Request);
      }),
    dispose: () => worker.terminate(),
  };
}

export type { Request as CandleRequest };
