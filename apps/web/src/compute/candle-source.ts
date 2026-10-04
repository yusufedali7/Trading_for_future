import {
  allSessionDefs,
  backtestStats,
  bucketStart,
  canonicalJson,
  findSetups,
  runBacktest,
  toBars,
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
  type BacktestConfig,
  type BacktestResult,
  type BacktestStats,
  type CandleSeries,
  type DataSetMeta,
  type FeatureSet,
  type PeriodLevel,
  type ResampledCandle,
  type SessionDefinition,
  type SessionLevels,
  type Setup,
  type StrategySpec,
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

export interface BacktestOutcome {
  result: BacktestResult;
  stats: BacktestStats;
}

/** Supplies chart data for a dataset; heavy work may run in a worker. */
export interface CandleSource {
  /** `userSessions`: the user's own session definitions (D35), shown and used next to the built-in ones. */
  load(meta: DataSetMeta, tf: Timeframe, userSessions?: SessionDefinition[]): Promise<ChartData>;
  replay(
    meta: DataSetMeta,
    tf: Timeframe,
    cursor: UtcMs,
    userSessions?: SessionDefinition[],
  ): Promise<ReplayTail>;
  simulate(meta: DataSetMeta, order: TradeOrder, opts: SimulateOptions): Promise<SimResult>;
  /** Deterministic backtest of a strategy version on this dataset (D32). */
  backtest(meta: DataSetMeta, spec: StrategySpec, config: BacktestConfig): Promise<BacktestOutcome>;
  /** Every setup of a strategy on the whole dataset (for the chart). */
  setups(meta: DataSetMeta, spec: StrategySpec): Promise<Setup[]>;
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

function computeSessions(
  meta: DataSetMeta,
  series: CandleSeries,
  defs: readonly SessionDefinition[],
): SessionLevels[] {
  const first = series.t[0];
  const last = series.t[series.length - 1];
  if (first === undefined || last === undefined) return [];
  const inst = getInstrument(meta.instrument);
  const asOf = last + timeframeMs(meta.baseTimeframe);
  const instances = defs.flatMap((def) => sessionInstances(def, inst, first, asOf));
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
    periods: PeriodLevel[];
    /** Session levels per set of definitions (canonical JSON). */
    sessions: Map<string, SessionLevels[]>;
  } | null = null;
  const get = async (meta: DataSetMeta) => {
    const key = `${meta.id}:${meta.contentHash}`;
    if (cached?.key !== key) {
      const series = await repo.loadSeries(meta.id);
      cached = {
        key,
        series,
        periods: computePeriods(meta, series),
        sessions: new Map(),
      };
    }
    return cached;
  };
  const sessionsFor = (
    meta: DataSetMeta,
    c: NonNullable<typeof cached>,
    defs: readonly SessionDefinition[],
  ) => {
    const key = canonicalJson(defs);
    let levels = c.sessions.get(key);
    if (!levels) {
      levels = computeSessions(meta, c.series, defs);
      if (c.sessions.size >= 4) c.sessions.clear();
      c.sessions.set(key, levels);
    }
    return levels;
  };
  // Candles and features of one strategy's timeframe and detector parameters.
  let strategyCache: {
    key: string;
    candles: ResampledCandle[];
    features: FeatureSet;
    defs: SessionDefinition[];
  } | null = null;
  const forStrategy = async (meta: DataSetMeta, spec: StrategySpec) => {
    if (spec.instrument !== meta.instrument)
      throw new Error(`strategy is for ${spec.instrument}, dataset is ${meta.instrument}`);
    const c = await get(meta);
    const defs = allSessionDefs(spec.sessions ?? []);
    const key = `${c.key}:${spec.timeframe}:${canonicalJson(spec.features)}:${canonicalJson(defs)}`;
    if (strategyCache?.key !== key) {
      const candles = await candlesFor(meta, c.series, spec.timeframe);
      const features = computeFeatures(
        {
          candles,
          inst: getInstrument(meta.instrument),
          tf: spec.timeframe,
          periods: c.periods,
          sessions: sessionsFor(meta, c, defs),
          sessionDefs: defs,
        },
        spec.features,
      );
      strategyCache = { key, candles, features, defs };
    }
    return { c, ...strategyCache };
  };
  return {
    async load(meta, tf, userSessions = []) {
      const c = await get(meta);
      const defs = allSessionDefs(userSessions);
      const sessions = sessionsFor(meta, c, defs);
      const candles = await candlesFor(meta, c.series, tf);
      const features = computeFeatures({
        candles,
        inst: getInstrument(meta.instrument),
        tf,
        periods: c.periods,
        sessions,
        sessionDefs: defs,
      });
      return { candles, sessions, features };
    },
    async replay(meta, tf, cursor, userSessions = []) {
      const c = await get(meta);
      const all = sessionsFor(meta, c, allSessionDefs(userSessions));
      const baseMs = timeframeMs(meta.baseTimeframe);
      const inst = getInstrument(meta.instrument);
      const visible = seriesUpTo(c.series, cursor, baseMs);
      const runningInstances = all.filter((s) => s.startUtc < cursor && cursor < s.endUtc);
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
    async backtest(meta, spec, config) {
      const { c, candles, features, defs } = await forStrategy(meta, spec);
      const inst = getInstrument(meta.instrument);
      const result = runBacktest({
        spec,
        inst,
        series: c.series,
        baseMs: timeframeMs(meta.baseTimeframe),
        candles,
        features,
        config,
      });
      return { result, stats: backtestStats(result, inst, config.range.from, defs) };
    },
    async setups(meta, spec) {
      const { candles, features } = await forStrategy(meta, spec);
      return findSetups(
        spec,
        toBars(candles, getInstrument(meta.instrument), spec.timeframe),
        features,
      );
    },
    dispose() {
      cached = null;
      strategyCache = null;
    },
  };
}

export type CandleRequest =
  | {
      id: number;
      method: 'load';
      meta: DataSetMeta;
      tf: Timeframe;
      userSessions?: SessionDefinition[];
    }
  | {
      id: number;
      method: 'replay';
      meta: DataSetMeta;
      tf: Timeframe;
      cursor: UtcMs;
      userSessions?: SessionDefinition[];
    }
  | { id: number; method: 'simulate'; meta: DataSetMeta; order: TradeOrder; opts: SimulateOptions }
  | {
      id: number;
      method: 'backtest';
      meta: DataSetMeta;
      spec: StrategySpec;
      config: BacktestConfig;
    }
  | { id: number; method: 'setups'; meta: DataSetMeta; spec: StrategySpec };

type Response =
  { id: number; ok: true; result: unknown } | { id: number; ok: false; error: string };

function dispatch(source: CandleSource, req: CandleRequest): Promise<unknown> {
  switch (req.method) {
    case 'load':
      return source.load(req.meta, req.tf, req.userSessions);
    case 'replay':
      return source.replay(req.meta, req.tf, req.cursor, req.userSessions);
    case 'simulate':
      return source.simulate(req.meta, req.order, req.opts);
    case 'backtest':
      return source.backtest(req.meta, req.spec, req.config);
    case 'setups':
      return source.setups(req.meta, req.spec);
  }
}

export async function handleCandleRequest(
  source: CandleSource,
  req: CandleRequest,
): Promise<Response> {
  try {
    const result = await dispatch(source, req);
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
    load: (meta, tf, userSessions) => call<ChartData>({ method: 'load', meta, tf, userSessions }),
    replay: (meta, tf, cursor, userSessions) =>
      call<ReplayTail>({ method: 'replay', meta, tf, cursor, userSessions }),
    simulate: (meta, order, opts) => call<SimResult>({ method: 'simulate', meta, order, opts }),
    backtest: (meta, spec, config) =>
      call<BacktestOutcome>({ method: 'backtest', meta, spec, config }),
    setups: (meta, spec) => call<Setup[]>({ method: 'setups', meta, spec }),
    dispose: () => worker.terminate(),
  };
}
