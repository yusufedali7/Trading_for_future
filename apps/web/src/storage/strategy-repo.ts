import Dexie, { type Table } from 'dexie';
import {
  setVersionStatus,
  type AmbiguityRule,
  type BacktestCosts,
  type ConceptExcursionReport,
  type FeatureDirection,
  type Hypothesis,
  type LotRules,
  type OutcomeConcept,
  type StoredBacktest,
  type Strategy,
  type StrategyStatus,
  type StrategyVersion,
  type Timeframe,
  type UtcMs,
} from '@trw/engine';

/** Strategy domain ("trw-strategy"): names and their immutable versions (D6). */
export interface StrategyRepo {
  listStrategies(): Promise<Strategy[]>;
  listVersions(strategyId: string): Promise<StrategyVersion[]>;
  /** Stores a new strategy with its first version. */
  createStrategy(s: Strategy, first: StrategyVersion): Promise<void>;
  /** Adds the next version; an existing version number is never overwritten. */
  addVersion(v: StrategyVersion, at: number): Promise<Strategy>;
  rename(id: string, name: string, description: string, at: number): Promise<void>;
  /** Backup restore: adds the strategy as stored; an existing id is left untouched. */
  importStrategy(s: Strategy): Promise<void>;
  /**
   * Backup restore: adds the version as stored (status history included) unless that number
   * exists; raises the strategy's latest version so the next new version follows it.
   */
  importVersion(v: StrategyVersion): Promise<void>;
  /** The only change allowed on a saved version. */
  setStatus(
    strategyId: string,
    version: number,
    status: StrategyStatus,
    at: number,
    note?: string,
  ): Promise<StrategyVersion>;
}

/** Research domain ("trw-research"): backtest runs with their full results. */
export interface ResearchRepo {
  saveRun(b: StoredBacktest): Promise<void>;
  /** Newest first. */
  listRuns(strategyId?: string): Promise<StoredBacktest[]>;
  deleteRun(id: string): Promise<void>;
  /** In-sample runs stored for a strategy (all versions). */
  countInSample(strategyId: string): Promise<number>;
  /** Runs made inside one hypothesis, newest first. */
  listHypothesisRuns(hypothesisId: string): Promise<StoredBacktest[]>;
  listHypotheses(): Promise<Hypothesis[]>;
  saveHypothesis(h: Hypothesis): Promise<void>;
  listPaperSessions(): Promise<PaperSession[]>;
  savePaperSession(p: PaperSession): Promise<void>;
  /** Newest-scanned first; `datasetId` narrows to one dataset+timeframe scan. */
  listEvents(datasetId?: string): Promise<EventRecord[]>;
  /** Upserts by id (deterministic per dataset+timeframe+detection, D66) - re-scanning replaces. */
  saveEvents(events: readonly EventRecord[]): Promise<void>;
}

/**
 * One detection's MFE/MAE scan result, kept so it survives a page reload (D66's "event store" -
 * `research/excursion.ts`'s `detectionExcursions()` output plus enough metadata to display and
 * re-find it). `id` is deterministic (`datasetId:timeframe:detectionId`) so re-scanning the same
 * data upserts instead of accumulating duplicates.
 */
export interface EventRecord {
  id: string;
  datasetId: string;
  instrument: string;
  timeframe: Timeframe;
  concept: OutcomeConcept;
  direction: FeatureDirection;
  formedAt: UtcMs;
  confirmedAt: UtcMs;
  horizons: number[];
  excursions: ConceptExcursionReport['excursions'];
  control: ConceptExcursionReport['control'];
  /** The seed `batchExcursions` was run with for this scan (rule 5). */
  controlSeed: number;
  engineVersion: string;
  scannedAt: UtcMs;
}

/**
 * A forward (paper) test of one strategy version on a broker feed (M6.3): only setups confirmed
 * after `startedAt` count; nothing is sent to the broker (rule 7).
 */
export interface PaperSession {
  id: string;
  strategyId: string;
  strategyName: string;
  strategyVersion: number;
  datasetId: string;
  startedAt: number;
  stoppedAt: number | null;
  costs: BacktestCosts;
  ambiguity: AmbiguityRule;
  startEquity: number;
  lots: LotRules;
  createdAt: number;
}

const versionKey = (strategyId: string, version: number) => `${strategyId}#${version}`;
type VersionRow = StrategyVersion & { key: string };
type RunRow = StoredBacktest & {
  id: string;
  strategyId: string;
  runAt: number;
  hypothesisId?: string;
};

const newestRunFirst = (a: StoredBacktest, b: StoredBacktest) =>
  b.run.runAt - a.run.runAt || a.run.id.localeCompare(b.run.id);

class StrategyDb extends Dexie {
  strategies!: Table<Strategy, string>;
  versions!: Table<VersionRow, string>;
  constructor(name: string) {
    super(name);
    this.version(1).stores({ strategies: 'id', versions: 'key, strategyId' });
  }
}

class ResearchDb extends Dexie {
  runs!: Table<RunRow, string>;
  hypotheses!: Table<Hypothesis, string>;
  paperSessions!: Table<PaperSession, string>;
  events!: Table<EventRecord, string>;
  constructor(name: string) {
    super(name);
    this.version(1).stores({ runs: 'id, strategyId, runAt' });
    // v2 (M6.2): hypotheses; runs can belong to one.
    this.version(2).stores({
      runs: 'id, strategyId, runAt, hypothesisId',
      hypotheses: 'id, strategyId',
    });
    // v3 (M6.3): paper trading sessions.
    this.version(3).stores({
      runs: 'id, strategyId, runAt, hypothesisId',
      hypotheses: 'id, strategyId',
      paperSessions: 'id',
    });
    // v4 (D66): event store - MFE/MAE scan results per detection.
    this.version(4).stores({
      runs: 'id, strategyId, runAt, hypothesisId',
      hypotheses: 'id, strategyId',
      paperSessions: 'id',
      events: 'id, datasetId, concept',
    });
  }
}

const strip = ({ key: _key, ...v }: VersionRow): StrategyVersion => v;

export function createDexieStrategyRepo(dbName = 'trw-strategy'): StrategyRepo {
  const db = new StrategyDb(dbName);
  return {
    listStrategies: async () =>
      (await db.strategies.toArray()).sort((a, b) => a.createdAt - b.createdAt),
    async listVersions(strategyId) {
      const rows = await db.versions.where('strategyId').equals(strategyId).toArray();
      return rows.map(strip).sort((a, b) => a.version - b.version);
    },
    async createStrategy(s, first) {
      await db.transaction('rw', db.strategies, db.versions, async () => {
        await db.strategies.add({ ...s, latestVersion: first.version });
        await db.versions.add({ ...first, key: versionKey(s.id, first.version) });
      });
    },
    async addVersion(v, at) {
      return db.transaction('rw', db.strategies, db.versions, async () => {
        const s = await db.strategies.get(v.strategyId);
        if (!s) throw new Error(`unknown strategy ${v.strategyId}`);
        if (v.version !== s.latestVersion + 1) throw new Error('version out of sequence');
        await db.versions.add({ ...v, key: versionKey(v.strategyId, v.version) }); // add: never overwrite
        const next = { ...s, latestVersion: v.version, updatedAt: at };
        await db.strategies.put(next);
        return next;
      });
    },
    async rename(id, name, description, at) {
      await db.strategies.update(id, { name, description, updatedAt: at });
    },
    async importStrategy(s) {
      await db.transaction('rw', db.strategies, async () => {
        if (!(await db.strategies.get(s.id))) await db.strategies.add(s);
      });
    },
    async importVersion(v) {
      await db.transaction('rw', db.strategies, db.versions, async () => {
        const key = versionKey(v.strategyId, v.version);
        if (await db.versions.get(key)) return;
        await db.versions.add({ ...v, key });
        const s = await db.strategies.get(v.strategyId);
        if (s && s.latestVersion < v.version) {
          await db.strategies.update(s.id, { latestVersion: v.version });
        }
      });
    },
    async setStatus(strategyId, version, status, at, note) {
      return db.transaction('rw', db.versions, async () => {
        const row = await db.versions.get(versionKey(strategyId, version));
        if (!row) throw new Error('unknown version');
        const next = setVersionStatus(strip(row), status, at, note);
        await db.versions.update(row.key, {
          status: next.status,
          statusHistory: next.statusHistory,
        });
        return next;
      });
    },
  };
}

export function createDexieResearchRepo(dbName = 'trw-research'): ResearchRepo {
  const db = new ResearchDb(dbName);
  const fromRow = ({
    id: _id,
    strategyId: _s,
    runAt: _r,
    hypothesisId: _h,
    ...b
  }: RunRow): StoredBacktest => b;
  return {
    async saveRun(b) {
      const hypothesisId = b.run.research?.hypothesisId;
      await db.runs.put({
        ...b,
        id: b.run.id,
        strategyId: b.run.strategy.id,
        runAt: b.run.runAt,
        ...(hypothesisId ? { hypothesisId } : {}),
      });
    },
    async listRuns(strategyId) {
      const rows = strategyId
        ? await db.runs.where('strategyId').equals(strategyId).toArray()
        : await db.runs.toArray();
      return rows.map(fromRow).sort(newestRunFirst);
    },
    async deleteRun(id) {
      await db.runs.delete(id);
    },
    async countInSample(strategyId) {
      const rows = await db.runs.where('strategyId').equals(strategyId).toArray();
      return rows.filter((r) => r.run.split.role === 'IN_SAMPLE').length;
    },
    async listHypothesisRuns(hypothesisId) {
      const rows = await db.runs.where('hypothesisId').equals(hypothesisId).toArray();
      return rows.map(fromRow).sort(newestRunFirst);
    },
    listHypotheses: async () =>
      (await db.hypotheses.toArray()).sort(
        (a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id),
      ),
    async saveHypothesis(h) {
      await db.hypotheses.put(h);
    },
    listPaperSessions: async () =>
      (await db.paperSessions.toArray()).sort(
        (a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id),
      ),
    async savePaperSession(p) {
      await db.paperSessions.put(p);
    },
    async listEvents(datasetId) {
      const rows = datasetId
        ? await db.events.where('datasetId').equals(datasetId).toArray()
        : await db.events.toArray();
      return rows.sort((a, b) => b.scannedAt - a.scannedAt || a.id.localeCompare(b.id));
    },
    async saveEvents(events) {
      await db.events.bulkPut(events as EventRecord[]);
    },
  };
}

export function createMemoryStrategyRepo(): StrategyRepo {
  const strategies = new Map<string, Strategy>();
  const versions = new Map<string, StrategyVersion>();
  return {
    listStrategies: async () => [...strategies.values()].sort((a, b) => a.createdAt - b.createdAt),
    listVersions: async (id) =>
      [...versions.values()]
        .filter((v) => v.strategyId === id)
        .sort((a, b) => a.version - b.version),
    async createStrategy(s, first) {
      if (strategies.has(s.id)) throw new Error('exists');
      strategies.set(s.id, { ...s, latestVersion: first.version });
      versions.set(versionKey(s.id, first.version), first);
    },
    async addVersion(v, at) {
      const s = strategies.get(v.strategyId);
      if (!s) throw new Error(`unknown strategy ${v.strategyId}`);
      const key = versionKey(v.strategyId, v.version);
      if (versions.has(key) || v.version !== s.latestVersion + 1)
        throw new Error('version out of sequence');
      versions.set(key, v);
      const next = { ...s, latestVersion: v.version, updatedAt: at };
      strategies.set(s.id, next);
      return next;
    },
    async rename(id, name, description, at) {
      const s = strategies.get(id);
      if (s) strategies.set(id, { ...s, name, description, updatedAt: at });
    },
    async importStrategy(s) {
      if (!strategies.has(s.id)) strategies.set(s.id, s);
    },
    async importVersion(v) {
      const key = versionKey(v.strategyId, v.version);
      if (versions.has(key)) return;
      versions.set(key, v);
      const s = strategies.get(v.strategyId);
      if (s && s.latestVersion < v.version)
        strategies.set(s.id, { ...s, latestVersion: v.version });
    },
    async setStatus(strategyId, version, status, at, note) {
      const key = versionKey(strategyId, version);
      const v = versions.get(key);
      if (!v) throw new Error('unknown version');
      const next = setVersionStatus(v, status, at, note);
      versions.set(key, next);
      return next;
    },
  };
}

export function createMemoryResearchRepo(): ResearchRepo {
  const runs = new Map<string, StoredBacktest>();
  const hypotheses = new Map<string, Hypothesis>();
  const papers = new Map<string, PaperSession>();
  const events = new Map<string, EventRecord>();
  return {
    saveRun: async (b) => {
      runs.set(b.run.id, b);
    },
    listRuns: async (strategyId) =>
      [...runs.values()]
        .filter((b) => !strategyId || b.run.strategy.id === strategyId)
        .sort(newestRunFirst),
    deleteRun: async (id) => {
      runs.delete(id);
    },
    countInSample: async (strategyId) =>
      [...runs.values()].filter(
        (b) => b.run.strategy.id === strategyId && b.run.split.role === 'IN_SAMPLE',
      ).length,
    listHypothesisRuns: async (id) =>
      [...runs.values()].filter((b) => b.run.research?.hypothesisId === id).sort(newestRunFirst),
    listHypotheses: async () =>
      [...hypotheses.values()].sort(
        (a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id),
      ),
    saveHypothesis: async (h) => {
      hypotheses.set(h.id, h);
    },
    listPaperSessions: async () =>
      [...papers.values()].sort((a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id)),
    savePaperSession: async (p) => {
      papers.set(p.id, p);
    },
    listEvents: async (datasetId) =>
      [...events.values()]
        .filter((e) => !datasetId || e.datasetId === datasetId)
        .sort((a, b) => b.scannedAt - a.scannedAt || a.id.localeCompare(b.id)),
    saveEvents: async (list) => {
      for (const e of list) events.set(e.id, e);
    },
  };
}
