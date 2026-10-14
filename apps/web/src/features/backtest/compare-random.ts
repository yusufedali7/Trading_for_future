import {
  getInstrument,
  randomBaselineParams,
  randomComparison,
  type DataSetMeta,
  type StoredBacktest,
  type StrategySpec,
} from '@trw/engine';
import type { CandleSource } from '../../compute/candle-source';
import type { ResearchRepo } from '../../storage/strategy-repo';

/** Fixed and stored with the result (CLAUDE.md rule 5). */
export const RANDOM_SEED = 1;

/**
 * Runs the random-entry baseline (D61) with the stored run's own count, average stop, average
 * target, costs, risk and range, then stores the comparison on the run (D72).
 */
export async function compareWithRandom(r: {
  source: CandleSource;
  repo: ResearchRepo;
  meta: DataSetMeta;
  b: StoredBacktest;
  spec: StrategySpec;
}): Promise<StoredBacktest> {
  const { b } = r;
  const params = randomBaselineParams(getInstrument(b.run.data.instrument), b.result.trades);
  if (!params) throw new Error('no trades to compare');
  const random = await r.source.randomBaseline(r.meta, {
    range: { from: b.run.data.from, to: b.run.data.to },
    direction: r.spec.direction,
    count: params.count,
    stopPips: params.stopPips,
    targetR: params.targetR,
    risk: r.spec.risk,
    costs: b.run.costs,
    ambiguity: b.run.ambiguity,
    startEquity: b.run.startEquity,
    lots: b.run.lots,
    seed: RANDOM_SEED,
  });
  const updated: StoredBacktest = {
    ...b,
    random: randomComparison(b.result, random, {
      seed: RANDOM_SEED,
      stopPips: params.stopPips,
      targetR: params.targetR,
    }),
  };
  await r.repo.saveRun(updated);
  return updated;
}
