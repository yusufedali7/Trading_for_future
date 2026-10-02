import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import {
  defaultSpec,
  newVersion,
  runRecord,
  type StoredBacktest,
  type Strategy,
} from '@trw/engine';
import {
  createDexieResearchRepo,
  createDexieStrategyRepo,
  createMemoryResearchRepo,
  createMemoryStrategyRepo,
  type ResearchRepo,
  type StrategyRepo,
} from '../src/storage/strategy-repo';

// SYNTHETIC strategy and run records for storage tests.
const base: Strategy = {
  id: 's1',
  name: 'Deneme',
  description: '',
  latestVersion: 0,
  createdAt: 1,
  updatedAt: 1,
};
const run = (id: string, runAt: number, role: 'FULL' | 'IN_SAMPLE' = 'FULL'): StoredBacktest => ({
  run: runRecord({
    id,
    runAt,
    strategy: { id: 's1', name: 'Deneme', version: 1, specHash: 'h' },
    data: {
      datasetId: 'ds',
      contentHash: 'c',
      sourceName: 'SYNTHETIC',
      instrument: 'EURUSD',
      timeframe: '15m',
      from: 0,
      to: 1,
    },
    split: { role, boundary: null },
    costs: { spreadPips: 0, slippagePips: 0, commissionPerLotPerSide: 0 },
    ambiguity: 'STOP_FIRST',
    startEquity: 10_000,
    lots: { lotStep: 0.01, minLot: 0.01 },
    inSampleTrial: null,
  }),
  result: {
    setupsFound: 0,
    trades: [],
    skipped: {
      DATA_GAP: 0,
      INVALID_ORDER: 0,
      SIZE_TOO_SMALL: 0,
      CROSS_PAIR: 0,
      POSITION_OPEN: 0,
      DAILY_LIMIT: 0,
    },
    expiredOrders: 0,
    unfilledAtEnd: 0,
    ambiguousTrades: 0,
    costs: { spread: 0, slippage: 0, commission: 0, total: 0 },
    startEquity: 10_000,
    endEquity: 10_000,
  },
  stats: {} as StoredBacktest['stats'],
});

let n = 0;
const repos: [string, () => { s: StrategyRepo; r: ResearchRepo }][] = [
  ['memory', () => ({ s: createMemoryStrategyRepo(), r: createMemoryResearchRepo() })],
  [
    'dexie',
    () => ({
      s: createDexieStrategyRepo(`trw-strategy-test-${++n}`),
      r: createDexieResearchRepo(`trw-research-test-${n}`),
    }),
  ],
];

describe.each(repos)('%s strategy and research repos', (_name, make) => {
  it('stores versions in sequence and never overwrites one', async () => {
    const { s } = make();
    const v1 = newVersion(base, defaultSpec(), 'ilk', 10);
    await s.createStrategy(base, v1);
    const after = await s.addVersion(
      newVersion({ ...base, latestVersion: 1 }, defaultSpec(), 'ikinci', 20),
      20,
    );
    expect(after.latestVersion).toBe(2);
    await expect(s.addVersion(v1, 30)).rejects.toThrow();
    expect((await s.listVersions('s1')).map((v) => [v.version, v.changeNote])).toEqual([
      [1, 'ilk'],
      [2, 'ikinci'],
    ]);
    expect((await s.listStrategies())[0]).toMatchObject({ id: 's1', latestVersion: 2 });
  });

  it('changes only the status of a saved version, keeping the history', async () => {
    const { s } = make();
    await s.createStrategy(base, newVersion(base, defaultSpec(), '', 10));
    await s.setStatus('s1', 1, 'TESTING', 50, 'backtest');
    const [v] = await s.listVersions('s1');
    expect(v).toMatchObject({ status: 'TESTING', spec: defaultSpec() });
    expect(v!.statusHistory).toEqual([
      { status: 'IDEA', at: 10 },
      { status: 'TESTING', at: 50, note: 'backtest' },
    ]);
  });

  it('keeps backtest runs newest first and counts in-sample trials', async () => {
    const { r } = make();
    await r.saveRun(run('a', 1, 'IN_SAMPLE'));
    await r.saveRun(run('b', 3));
    await r.saveRun(run('c', 2, 'IN_SAMPLE'));
    expect((await r.listRuns('s1')).map((x) => x.run.id)).toEqual(['b', 'c', 'a']);
    expect(await r.countInSample('s1')).toBe(2);
    await r.deleteRun('a');
    expect((await r.listRuns()).map((x) => x.run.id)).toEqual(['b', 'c']);
    expect((await r.listRuns())[0]!.run.engineVersion).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
