import { mulberry32 } from '../core/rng';
import { priceToPips, type Instrument } from '../instruments/registry';
import type { RandomComparison, StoredBacktest } from '../backtest/record';
import type { BacktestResult, BacktestTrade } from '../backtest/run';
import { rankCandidates } from './ranking';

/**
 * "Bu sonuç ne diyor?" (D72): reading notes derived only from a stored run's own measured numbers.
 * The engine returns codes and numbers; the wording lives in the UI's translation file. Nothing
 * here predicts an outcome or recommends a trade (CLAUDE.md rules 6 and 9) - every note points at a
 * number the run itself measured.
 */

export type FindingCode =
  | 'NO_TRADES'
  | 'LOW_SAMPLE'
  | 'NO_OUT_OF_SAMPLE'
  | 'OOS_DEGRADATION'
  | 'OOS_HELD'
  | 'MANY_TRIALS'
  | 'AMBIGUOUS_SHARE'
  | 'COSTS_HEAVY'
  | 'RANDOM_EDGE'
  | 'NO_EDGE_VS_RANDOM'
  | 'WORSE_THAN_RANDOM';

export interface Finding {
  code: FindingCode;
  severity: 'INFO' | 'CAUTION' | 'WARN';
  params: Record<string, number>;
}

/** In-sample trial count from which a good in-sample result is flagged as possibly lucky. */
export const MANY_TRIALS_FROM = 5;
/** Out-of-sample expectancy below this share of the in-sample one counts as a clear drop. */
export const OOS_KEPT_SHARE = 0.5;
/** Share of trades with stop and target in the same bar from which the result leans on the rule. */
export const AMBIGUOUS_SHARE_FROM = 0.1;
/** Share of the gross result taken by costs from which a small cost change could flip it. */
export const COSTS_SHARE_FROM = 0.5;

const r4 = (x: number) => Math.round(x * 1e4) / 1e4;
const pct = (x: number) => Math.round(x * 100);

function plannedEntry(t: BacktestTrade): number {
  return t.order.type === 'MARKET' ? t.order.referencePrice : (t.order.price ?? t.entryPrice);
}

/**
 * Inputs for `randomEntryBaseline` that mirror the real trades: same count, the average planned
 * stop distance and the average planned target in R (the baseline's documented simplification).
 */
export function randomBaselineParams(
  inst: Instrument,
  trades: readonly BacktestTrade[],
): { count: number; stopPips: number; targetR: number } | null {
  if (trades.length === 0) return null;
  let stopPips = 0;
  let targetR = 0;
  for (const t of trades) {
    const entry = plannedEntry(t);
    const stopDist = Math.abs(entry - t.order.stop);
    stopPips += priceToPips(inst, stopDist);
    targetR += Math.abs(t.order.target - entry) / stopDist;
  }
  return {
    count: trades.length,
    stopPips: Math.round((stopPips / trades.length) * 10) / 10,
    targetR: Math.round((targetR / trades.length) * 100) / 100,
  };
}

/** Edge of the real trades over the random ones, with a bootstrap interval seeded by `seed`. */
export function randomComparison(
  real: BacktestResult,
  random: BacktestResult,
  p: { seed: number; stopPips: number; targetR: number },
): RandomComparison {
  const [c] = rankCandidates(
    [
      {
        id: 'real',
        label: '',
        trades: real.trades.map((t) => t.r),
        randomTrades: random.trades.map((t) => t.r),
      },
    ],
    mulberry32(p.seed),
  );
  const hasRandom = random.trades.length > 0;
  return {
    seed: p.seed,
    stopPips: p.stopPips,
    targetR: p.targetR,
    trades: random.trades.length,
    avgR: c!.randomStats?.avgR ?? null,
    edgeR: hasRandom ? c!.edgeR : null,
    edgeCI: hasRandom && c!.edgeCI ? c!.edgeCI : null,
  };
}

export interface InterpretInput {
  b: StoredBacktest;
  /** The latest in-sample run of the same strategy version, when `b` is out-of-sample. */
  inSample?: StoredBacktest | null;
}

export function interpretRun({ b, inSample }: InterpretInput): Finding[] {
  const s = b.stats.summary;
  if (s.trades === 0) return [{ code: 'NO_TRADES', severity: 'WARN', params: {} }];
  const out: Finding[] = [];
  const role = b.run.split.role;

  if (s.lowSample) out.push({ code: 'LOW_SAMPLE', severity: 'WARN', params: { trades: s.trades } });

  if (role !== 'OUT_OF_SAMPLE') {
    out.push({ code: 'NO_OUT_OF_SAMPLE', severity: 'INFO', params: {} });
  } else if (inSample) {
    const isAvgR = inSample.stats.summary.avgR;
    const oosAvgR = s.avgR;
    if (isAvgR !== null && oosAvgR !== null && isAvgR > 0) {
      const params = { isAvgR: r4(isAvgR), oosAvgR: r4(oosAvgR) };
      out.push(
        oosAvgR < isAvgR * OOS_KEPT_SHARE
          ? { code: 'OOS_DEGRADATION', severity: 'CAUTION', params }
          : { code: 'OOS_HELD', severity: 'INFO', params },
      );
    }
  }

  const trials = b.run.inSampleTrial;
  if (trials !== null && trials >= MANY_TRIALS_FROM)
    out.push({ code: 'MANY_TRIALS', severity: 'CAUTION', params: { trials } });

  const ambiguous = b.result.ambiguousTrades;
  if (ambiguous / s.trades >= AMBIGUOUS_SHARE_FROM)
    out.push({
      code: 'AMBIGUOUS_SHARE',
      severity: 'CAUTION',
      params: { count: ambiguous, pct: pct(ambiguous / s.trades) },
    });

  const costs = b.result.costs.total;
  const gross = b.stats.netPnl + costs;
  if (costs > 0 && gross > 0 && costs / gross >= COSTS_SHARE_FROM)
    out.push({ code: 'COSTS_HEAVY', severity: 'CAUTION', params: { pct: pct(costs / gross) } });

  const rnd = b.random;
  if (rnd && rnd.edgeR !== null && rnd.edgeCI) {
    const params = { edgeR: r4(rnd.edgeR), low: r4(rnd.edgeCI.low), high: r4(rnd.edgeCI.high) };
    if (rnd.edgeCI.low > 0) out.push({ code: 'RANDOM_EDGE', severity: 'INFO', params });
    else if (rnd.edgeCI.high < 0) out.push({ code: 'WORSE_THAN_RANDOM', severity: 'WARN', params });
    else out.push({ code: 'NO_EDGE_VS_RANDOM', severity: 'CAUTION', params });
  }
  return out;
}
