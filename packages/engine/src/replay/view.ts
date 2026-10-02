import { timeframeMs, type Timeframe } from '../core/timeframe';
import type { UtcMs } from '../core/types';
import type { CandleSeries } from '../data/columnar';
import { bucketStart, resample, type ResampledCandle } from '../data/resample';
import type { Instrument } from '../instruments/registry';

/** Index of the first element whose key is >= target. */
function lowerBound<T>(xs: ArrayLike<T>, target: number, key: (x: T) => number): number {
  let lo = 0;
  let hi = xs.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (key(xs[mid]!) < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

const num = (x: number) => x;

/**
 * The base series as it was known at `cutoff`: only bars that had closed (t + baseMs <= cutoff).
 * Shares memory with the input (subarray views), so it is cheap to call on every replay step.
 */
export function seriesUpTo(series: CandleSeries, cutoff: UtcMs, baseMs: number): CandleSeries {
  const n = lowerBound(series.t, cutoff - baseMs + 1, num);
  return {
    length: n,
    t: series.t.subarray(0, n),
    o: series.o.subarray(0, n),
    h: series.h.subarray(0, n),
    l: series.l.subarray(0, n),
    c: series.c.subarray(0, n),
    v: series.v ? series.v.subarray(0, n) : null,
    contentHash: `${series.contentHash}@${cutoff}`,
  };
}

/**
 * Chart candles during replay: identical to resampling the data truncated at `cutoff`
 * (no future bar, the last bar flagged as still forming), but cheap: closed buckets come from
 * the precomputed full-data candles and only the last bucket is rebuilt from base bars.
 */
export function replayCandles(
  full: readonly ResampledCandle[],
  series: CandleSeries,
  inst: Instrument,
  tf: Timeframe,
  cutoff: UtcMs,
  baseTimeframe: Timeframe = '1m',
): ResampledCandle[] {
  const visible = seriesUpTo(series, cutoff, timeframeMs(baseTimeframe));
  if (visible.length === 0) return [];
  const lastStart = bucketStart(inst, tf, visible.t[visible.length - 1]!);
  const head = full.slice(
    0,
    lowerBound(full, lastStart, (c) => c.t),
  );
  const from = lowerBound(visible.t, lastStart, num);
  const tailSeries: CandleSeries = {
    length: visible.length - from,
    t: visible.t.subarray(from),
    o: visible.o.subarray(from),
    h: visible.h.subarray(from),
    l: visible.l.subarray(from),
    c: visible.c.subarray(from),
    v: visible.v ? visible.v.subarray(from) : null,
    contentHash: visible.contentHash,
  };
  return [...head, ...resample(tailSeries, inst, tf, { asOf: cutoff, baseTimeframe })];
}
