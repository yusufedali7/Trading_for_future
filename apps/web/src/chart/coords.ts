import type { UtcMs } from '@trw/engine';

/**
 * Conversions between UTC time and the chart's logical position. In Lightweight Charts bar i is
 * centred on logical i, so it spans i-0.5 … i+0.5. Drawings and session boxes are stored in UTC and
 * placed with these helpers, so they stay put when the timeframe changes and can extend past the
 * last bar.
 */

function lastAtOrBefore(times: ArrayLike<number>, t: number): number {
  let lo = 0;
  let hi = times.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (times[mid]! <= t) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export function timeToPosition(times: ArrayLike<number>, tfMs: number, t: UtcMs): number {
  const n = times.length;
  if (n === 0) return NaN;
  if (t < times[0]!) return -0.5 + (t - times[0]!) / tfMs;
  const i = lastAtOrBefore(times, t);
  const d = t - times[i]!;
  // Inside the bar, or past the last bar: proportional. Inside a data gap: right edge of bar i.
  if (i === n - 1 || d < tfMs) return i - 0.5 + d / tfMs;
  return i + 0.5;
}

export function positionToTime(times: ArrayLike<number>, tfMs: number, p: number): UtcMs {
  const n = times.length;
  if (n === 0) return NaN;
  const i = Math.floor(p + 0.5);
  let t: number;
  if (i < 0) t = times[0]! + (p + 0.5) * tfMs;
  else if (i > n - 1) t = times[n - 1]! + (p - (n - 1) + 0.5) * tfMs;
  else t = times[i]! + (p - (i - 0.5)) * tfMs;
  return Math.round(t);
}
