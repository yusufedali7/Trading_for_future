import {
  BUILTIN_SESSIONS,
  bucketStart,
  computeFeatures,
  featuresAsOf,
  previousPeriods,
  getInstrument,
  resample,
  seriesUpTo,
  sessionInstances,
  sessionLevels,
  simulateTrade,
  timeframeMs,
  type CandleSeries,
  type DataSetMeta,
  type FeatureSet,
  type PeriodLevel,
  type ResampledCandle,
  type SessionLevels,
  type SimOptions,
  type SimResult,
  type Timeframe,
  type TradeOrder,
  type UtcMs,
} from '@trw/engine';
import type { MarketRepo } from '../storage/market-repo';
import { candlesFor } from './resample-for-display';

/** Everything the chart needs for one dataset + timeframe. */
export interface ChartData {
  candles: ResampledCandle[];
  /** Built-in sessions with levels from the base bars, as of the last stored bar's close. */
  sessions: SessionLevels[];
  /** Engine candidates (M4) on this timeframe, as of the last stored bar. */
  features: FeatureSet;
}

/**
 * What changes when the replay cursor moves: the last (possibly still forming) bucket and the
 * sessions running at the cursor. Closed buckets and finished sessions are reused from ChartData.
 */
export interface ReplayTail {
  tailStart: UtcMs | null;
  tail: ResampledCandle[];
  running: SessionLevels[];
}

export type SimulateOptions = Omit<SimOptions, 'baseMs'>;

/** Supplies chart data for a dataset; heavy work may run in a worker. */
export interface CandleSource {
  load(meta: DataSetMeta, tf: Timeframe): Promise<ChartData>;
  replay(meta: DataSetMeta, tf: Timeframe, cursor: UtcMs): Promise<ReplayTail>;
  simulate(meta: DataSetMeta, order: TradeOrder, opts: SimulateOptions): Promise<SimResult>;
  dispose(): void;
}

/** Chart data as known at the replay cursor (no bar or session level from after it). */
export function composeReplay(full: ChartData, tail: ReplayTail, cursor: UtcMs): ChartData {
  const head = tail.tailStart === null ? [] : full.candles.filter((c) => c.t < tail.tailStart!);
  const finished = full.sessions.filter((s) => s.endUtc <= cursor);
  const sessions = [...finished, ...tail.running].sort(
    (a, b) => a.startUtc - b.startUtc || a.sessionId.localeCompare(b.sessionId),
  );
  return {
    candles: [...head, ...tail.tail],
    sessions,
    features: featuresAsOf(full.features, cursor),
  };
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

function computePeriods(meta: DataSetMeta, series: CandleSeries): PeriodLevel[] {
  const last = series.t[series.length - 1];
  if (last === undefined) return [];
  const asOf = last + timeframeMs(meta.baseTimeframe);
  return previousPeriods(series, getInstrument(meta.instrument), asOf, meta.baseTimeframe);
}

/** Keeps the most recently used dataset (and its sessions) in memory between requests. */
export function createInProcessCandleSource(repo: MarketRepo): CandleSource {
  let cached: {
    key: string;
    series: CandleSeries;
    sessions: SessionLevels[];
    periods: PeriodLevel[];
  } | null = null;
  const get = async (meta: DataSetMeta) => {
    const key = `${meta.id}:${meta.contentHash}`;
    if (cached?.key !== key) {
      const series = await repo.loadSeries(meta.id);
      cached = {
        key,
        series,
        sessions: computeSessions(meta, series),
        periods: computePeriods(meta, series),
      };
    }
    return cached;
  };
  return {
    async load(meta, tf) {
      const c = await get(meta);
      const candles = await candlesFor(meta, c.series, tf);
      const features = computeFeatures({
        candles,
        inst: getInstrument(meta.instrument),
        tf,
        periods: c.periods,
        sessions: c.sessions,
      });
      return { candles, sessions: c.sessions, features };
    },
    async replay(meta, tf, cursor) {
      const c = await get(meta);
      const baseMs = timeframeMs(meta.baseTimeframe);
      const inst = getInstrument(meta.instrument);
      const visible = seriesUpTo(c.series, cursor, baseMs);
      const runningInstances = c.sessions.filter((s) => s.startUtc < cursor && cursor < s.endUtc);
      const running = sessionLevels(c.series, runningInstances, cursor, baseMs);
      if (visible.length === 0) return { tailStart: null, tail: [], running };
      const tailStart = bucketStart(inst, tf, visible.t[visible.length - 1]!);
      let from = visible.length - 1;
      while (from > 0 && visible.t[from - 1]! >= tailStart) from--;
      const sub: CandleSeries = {
        length: visible.length - from,
        t: visible.t.subarray(from),
        o: visible.o.subarray(from),
        h: visible.h.subarray(from),
        l: visible.l.subarray(from),
        c: visible.c.subarray(from),
        v: visible.v ? visible.v.subarray(from) : null,
        contentHash: visible.contentHash,
      };
      const tail = resample(sub, inst, tf, { asOf: cursor, baseTimeframe: meta.baseTimeframe });
      return { tailStart, tail, running };
    },
    async simulate(meta, order, opts) {
      const c = await get(meta);
      return simulateTrade(order, c.series, { ...opts, baseMs: timeframeMs(meta.baseTimeframe) });
    },
    dispose() {
      cached = null;
    },
  };
}

export type CandleRequest =
  | { id: number; method: 'load'; meta: DataSetMeta; tf: Timeframe }
  | { id: number; method: 'replay'; meta: DataSetMeta; tf: Timeframe; cursor: UtcMs }
  | { id: number; method: 'simulate'; meta: DataSetMeta; order: TradeOrder; opts: SimulateOptions };

type Response =
  { id: number; ok: true; result: unknown } | { id: number; ok: false; error: string };

export async function handleCandleRequest(
  source: CandleSource,
  req: CandleRequest,
): Promise<Response> {
  try {
    const result =
      req.method === 'load'
        ? await source.load(req.meta, req.tf)
        : req.method === 'replay'
          ? await source.replay(req.meta, req.tf, req.cursor)
          : await source.simulate(req.meta, req.order, req.opts);
    return { id: req.id, ok: true, result };
  } catch (err) {
    return { id: req.id, ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

type WithoutId<T> = T extends unknown ? Omit<T, 'id'> : never;

/** Runs loading, replay and simulation in a Web Worker that reads IndexedDB itself. */
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
  const call = <T>(req: WithoutId<CandleRequest>) =>
    new Promise<T>((resolve, reject) => {
      const id = nextId++;
      pending.set(id, (r) => (r.ok ? resolve(r.result as T) : reject(new Error(r.error))));
      worker.postMessage({ ...req, id } as CandleRequest);
    });
  return {
    load: (meta, tf) => call<ChartData>({ method: 'load', meta, tf }),
    replay: (meta, tf, cursor) => call<ReplayTail>({ method: 'replay', meta, tf, cursor }),
    simulate: (meta, order, opts) => call<SimResult>({ method: 'simulate', meta, order, opts }),
    dispose: () => worker.terminate(),
  };
}
