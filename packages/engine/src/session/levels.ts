import type { UtcMs } from '../core/types';
import type { CandleSeries } from '../data/columnar';
import type { SessionInstance } from './sessions';

export interface SessionLevels extends SessionInstance {
  high: number | null;
  /** Open time of the first bar that printed the high. */
  highAt: UtcMs | null;
  low: number | null;
  lowAt: UtcMs | null;
  /** Base bars that were closed by asOf and fell inside the session. 0 = data gap. */
  barCount: number;
  /** True once the session has ended by asOf: only then are high/low final. */
  complete: boolean;
  /** When these levels were known: the session end if complete, otherwise asOf. */
  knownAt: UtcMs;
}

function lowerBound(ts: Float64Array, target: number): number {
  let lo = 0;
  let hi = ts.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (ts[mid]! < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * High/low of each session from base bars, using only bars closed by `asOf` (no lookahead,
 * CLAUDE.md rule 3). Sessions that have not started by asOf are omitted. Computed from the base
 * series, so the levels are identical whichever timeframe the chart shows.
 */
export function sessionLevels(
  series: CandleSeries,
  instances: readonly SessionInstance[],
  asOf: UtcMs,
  baseMs = 60_000,
): SessionLevels[] {
  const out: SessionLevels[] = [];
  for (const s of instances) {
    if (s.startUtc >= asOf) continue;
    let high: number | null = null;
    let low: number | null = null;
    let highAt: UtcMs | null = null;
    let lowAt: UtcMs | null = null;
    let barCount = 0;
    for (let i = lowerBound(series.t, s.startUtc); i < series.length; i++) {
      const t = series.t[i]!;
      if (t >= s.endUtc || t + baseMs > asOf) break;
      const h = series.h[i]!;
      const l = series.l[i]!;
      if (high === null || h > high) {
        high = h;
        highAt = t;
      }
      if (low === null || l < low) {
        low = l;
        lowAt = t;
      }
      barCount++;
    }
    const complete = s.endUtc <= asOf;
    out.push({
      ...s,
      high,
      highAt,
      low,
      lowAt,
      barCount,
      complete,
      knownAt: complete ? s.endUtc : asOf,
    });
  }
  return out;
}
