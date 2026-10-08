import type { UtcMs } from '../core/types';
import type { Bars } from './bars';
import { atr } from './indicators';
import type { CandidateSr, CandidateSrParams, Swing } from './types';

export const CANDIDATE_SR_DEFAULTS: CandidateSrParams = {
  clusterToleranceAtr: 0.3,
  minTouches: 3,
  lookbackBars: 500,
  atrPeriod: 14,
};

interface Cluster {
  prices: number[];
  swingIds: string[];
  firstFormedAt: UtcMs;
  firstFormedIndex: number;
  lastFormedIndex: number;
  emitted: boolean;
}

const clusterPrice = (c: Cluster) => c.prices.reduce((sum, x) => sum + x, 0) / c.prices.length;

/**
 * Candidate support/resistance zones, definition v1 (docs/definitions/candidate-sr-v1.md). Both
 * swing highs and lows feed the same clustering (a level can act as either). A single pass over
 * confirmed swings: each one joins the nearest existing cluster within `clusterToleranceAtr` x
 * the ATR at its own bar, or starts a new one; a cluster whose newest member is more than
 * `lookbackBars` older than the swing being processed is no longer matched against. One entry is
 * emitted per cluster, the moment it first reaches `minTouches` - growing further afterwards is
 * not re-emitted.
 */
export function detectCandidateSr(
  b: Bars,
  swings: readonly Swing[],
  p: CandidateSrParams = CANDIDATE_SR_DEFAULTS,
): CandidateSr[] {
  const atrSeries = atr(b, p.atrPeriod);
  const byConfirm = [...swings].sort(
    (x, y) => x.confirmedIndex - y.confirmedIndex || x.formedIndex - y.formedIndex,
  );
  const clusters: Cluster[] = [];
  const out: CandidateSr[] = [];
  for (const s of byConfirm) {
    const a = atrSeries[s.confirmedIndex];
    if (a === null || a === undefined) continue;
    const tol = p.clusterToleranceAtr * a;
    let best: Cluster | null = null;
    let bestDist = Infinity;
    for (const c of clusters) {
      if (s.formedIndex - c.lastFormedIndex > p.lookbackBars) continue;
      const dist = Math.abs(s.price - clusterPrice(c));
      if (dist <= tol && dist < bestDist) {
        best = c;
        bestDist = dist;
      }
    }
    const cluster =
      best ??
      (() => {
        const created: Cluster = {
          prices: [],
          swingIds: [],
          firstFormedAt: s.formedAt,
          firstFormedIndex: s.formedIndex,
          lastFormedIndex: s.formedIndex,
          emitted: false,
        };
        clusters.push(created);
        return created;
      })();
    cluster.prices.push(s.price);
    cluster.swingIds.push(s.id);
    cluster.lastFormedIndex = s.formedIndex;
    if (!cluster.emitted && cluster.prices.length >= p.minTouches) {
      cluster.emitted = true;
      out.push({
        id: `CANDIDATE_SR:v1:${cluster.swingIds.join(',')}`,
        defVersion: 'v1',
        type: 'CANDIDATE_SR',
        top: Math.max(...cluster.prices),
        bottom: Math.min(...cluster.prices),
        price: clusterPrice(cluster),
        touches: cluster.prices.length,
        swingIds: [...cluster.swingIds],
        formedAt: cluster.firstFormedAt,
        formedIndex: cluster.firstFormedIndex,
        confirmedAt: s.confirmedAt,
        confirmedIndex: s.confirmedIndex,
      });
    }
  }
  return out;
}
