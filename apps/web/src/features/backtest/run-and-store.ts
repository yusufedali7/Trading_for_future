import {
  runRecord,
  splitRange,
  type AmbiguityRule,
  type BacktestCosts,
  type BacktestRun,
  type DataSetMeta,
  type LotRules,
  type SplitRole,
  type StoredBacktest,
  type Strategy,
  type StrategySpec,
  type StrategyVersion,
  type UtcMs,
} from '@trw/engine';
import type { CandleSource } from '../../compute/candle-source';
import type { ResearchRepo } from '../../storage/strategy-repo';

export interface RunRequest {
  source: CandleSource;
  repo: ResearchRepo;
  meta: DataSetMeta;
  strategy: Strategy;
  version: StrategyVersion;
  /** The rules to run: the version's own, or a sweep variant of them. */
  spec: StrategySpec;
  specHash: string;
  /** Whole tested range before the split; clipped to the data. */
  range: { from: UtcMs; to: UtcMs };
  role: SplitRole;
  boundary: UtcMs | null;
  costs: BacktestCosts;
  ambiguity: AmbiguityRule;
  startEquity: number;
  lots: LotRules;
  research?: BacktestRun['research'];
  now: () => number;
  newId: () => string;
}

/**
 * Runs one backtest in the worker and stores it with its reproducibility record (D32–D33, D37).
 * In-sample runs are numbered per strategy so the trial count is always visible.
 */
export async function runAndStore(r: RunRequest): Promise<StoredBacktest> {
  const range = splitRange(r.range, r.role, r.boundary);
  const config = {
    range,
    costs: r.costs,
    ambiguity: r.ambiguity,
    startEquity: r.startEquity,
    lots: r.lots,
  };
  const out = await r.source.backtest(r.meta, r.spec, config);
  const trial = r.role === 'IN_SAMPLE' ? (await r.repo.countInSample(r.strategy.id)) + 1 : null;
  const stored: StoredBacktest = {
    run: runRecord({
      id: r.newId(),
      runAt: r.now(),
      strategy: {
        id: r.strategy.id,
        name: r.strategy.name,
        version: r.version.version,
        specHash: r.specHash,
      },
      data: {
        datasetId: r.meta.id,
        contentHash: r.meta.contentHash,
        sourceName: r.meta.source.name,
        instrument: r.meta.instrument,
        timeframe: r.spec.timeframe,
        from: range.from,
        to: range.to,
      },
      split: { role: r.role, boundary: r.role === 'FULL' ? null : r.boundary },
      costs: r.costs,
      ambiguity: r.ambiguity,
      startEquity: r.startEquity,
      lots: r.lots,
      inSampleTrial: trial,
      ...(r.research ? { research: r.research } : {}),
    }),
    ...out,
  };
  await r.repo.saveRun(stored);
  return stored;
}
