import type { Timeframe } from '../core/timeframe';
import type { UtcMs } from '../core/types';
import type { AmbiguityRule } from '../execution/trade-sim';
import { FEATURE_DEFINITIONS } from '../features/compute';
import type { LotRules } from '../risk/sizing';
import { ENGINE_VERSION } from '../version';
import type { StrategySpec } from '../strategy/schema';
import type { BacktestCosts, BacktestResult } from './run';
import type { BacktestStats } from './stats';

export type SplitRole = 'FULL' | 'IN_SAMPLE' | 'OUT_OF_SAMPLE';

/** In-sample is before the boundary, out-of-sample from it on (CLAUDE.md data split). */
export function splitRange(
  range: { from: UtcMs; to: UtcMs },
  role: SplitRole,
  boundary: UtcMs | null,
): { from: UtcMs; to: UtcMs } {
  if (role === 'FULL' || boundary === null) return range;
  const b = Math.min(Math.max(boundary, range.from), range.to);
  return role === 'IN_SAMPLE' ? { from: range.from, to: b } : { from: b, to: range.to };
}

/**
 * Everything needed to reproduce a backtest (CLAUDE.md "Tekrarlanabilirlik"): same record +
 * same data hash → identical result.
 */
export interface BacktestRun {
  id: string;
  /** App clock; the engine never reads time. */
  runAt: UtcMs;
  engineVersion: string;
  strategy: { id: string; name: string; version: number; specHash: string };
  definitions: typeof FEATURE_DEFINITIONS;
  data: {
    datasetId: string;
    contentHash: string;
    sourceName: string;
    instrument: string;
    timeframe: Timeframe;
    /** The range actually tested (after the split). */
    from: UtcMs;
    to: UtcMs;
  };
  split: { role: SplitRole; boundary: UtcMs | null };
  costs: BacktestCosts;
  ambiguity: AmbiguityRule;
  startEquity: number;
  lots: LotRules;
  /**
   * In-sample runs of this strategy (all versions) including this one: the more trials, the more
   * likely a good in-sample result is luck (over-fitting is made visible, not prevented).
   */
  inSampleTrial: number | null;
  /** Set for runs made inside a hypothesis (research lab, D37). */
  research?: {
    hypothesisId: string;
    /** Swept parameter values; null for the version's own rules. */
    variant: Record<string, number> | null;
    /**
     * The exact rules run when they differ from the version (a sweep variant); `strategy.specHash`
     * is then the hash of this spec.
     */
    spec?: StrategySpec;
  };
}

/**
 * The run's trades compared with random entries of the same count, stop distance and target R
 * (D72). Seeded and stored with the run (rule 5), so the comparison is reproducible.
 */
export interface RandomComparison {
  seed: number;
  stopPips: number;
  targetR: number;
  /** Random trades actually produced. */
  trades: number;
  avgR: number | null;
  /** Real avgR − random avgR; null without random trades. */
  edgeR: number | null;
  /** 95% bootstrap interval of the edge. */
  edgeCI: { low: number; high: number } | null;
}

export interface StoredBacktest {
  run: BacktestRun;
  result: BacktestResult;
  stats: BacktestStats;
  random?: RandomComparison;
}

export function runRecord(r: Omit<BacktestRun, 'engineVersion' | 'definitions'>): BacktestRun {
  return { ...r, engineVersion: ENGINE_VERSION, definitions: FEATURE_DEFINITIONS };
}
