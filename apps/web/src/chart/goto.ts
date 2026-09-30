import { localToUtc, type IanaTz, type UtcMs } from '@trw/engine';

/** Index of the first time >= target (binary search); the last index if all are earlier. */
export function indexAtOrAfter(times: ArrayLike<number>, target: UtcMs): number {
  let lo = 0;
  let hi = times.length - 1;
  if (hi < 0) return -1;
  if (times[hi]! < target) return hi;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (times[mid]! < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** "YYYY-MM-DD" from a date input → 00:00 in the display zone, as UTC ms. */
export function startOfLocalDay(value: string, tz: IanaTz): UtcMs | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  try {
    const res = localToUtc(
      { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]), hour: 0, minute: 0 },
      tz,
    );
    if (res.kind === 'OK') return res.utc;
    if (res.kind === 'AMBIGUOUS') return res.earlier;
    return null;
  } catch {
    return null;
  }
}
