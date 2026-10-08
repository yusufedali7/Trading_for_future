// SYNTHETIC test data helpers: hand-written bars and a seeded random walk. Never used outside tests.
import type { Bars } from '../../src/features/bars';

export const BAR_MS = 15 * 60_000;
export const T0 = Date.parse('2026-01-06T08:00:00Z');

/** Bars from [open, high, low, close] tuples, 15 minutes apart from T0. */
export function bars(
  ohlc: readonly (readonly [number, number, number, number])[],
  volumes?: readonly number[],
): Bars {
  const t = ohlc.map((_, i) => T0 + i * BAR_MS);
  return {
    length: ohlc.length,
    t,
    o: ohlc.map((x) => x[0]),
    h: ohlc.map((x) => x[1]),
    l: ohlc.map((x) => x[2]),
    c: ohlc.map((x) => x[3]),
    end: t.map((x) => x + BAR_MS),
    v: volumes ?? ohlc.map(() => 0),
  };
}

/** Bars from [high, low] pairs; open = low, close = high (only highs/lows matter). */
export function hl(pairs: readonly (readonly [number, number])[]): Bars {
  return bars(pairs.map(([h, l]) => [l, h, l, h] as const));
}

/**
 * A smooth piecewise-linear price path through `points` ([barIndex, price], sorted by index),
 * with a tiny constant wick on every bar - gentle and slow enough that each bar's own true range
 * stays far below the deliberately large (multi-ATR) tolerances used in chart-pattern tests, so
 * the exact ATR value never has to be computed by hand. Used for the multi-pivot chart pattern
 * family (`patterns/chart.ts`, `patterns/chart-lines.ts`), whose pivots are 10-100+ bars apart.
 */
export function pathBars(points: readonly (readonly [number, number])[]): Bars {
  const last = points[points.length - 1]!;
  const n = last[0] + 1;
  const priceAt = (i: number) => {
    let k = 0;
    while (k < points.length - 2 && points[k + 1]![0] <= i) k++;
    const [i0, p0] = points[k]!;
    const [i1, p1] = points[k + 1]!;
    const t = i1 === i0 ? 0 : (i - i0) / (i1 - i0);
    return p0 + (p1 - p0) * t;
  };
  const eps = 0.0001;
  const rows: [number, number, number, number][] = [];
  let prevClose = priceAt(0);
  for (let i = 0; i < n; i++) {
    const c = priceAt(i);
    const o = i === 0 ? c : prevClose;
    rows.push([o, Math.max(o, c) + eps, Math.min(o, c) - eps, c]);
    prevClose = c;
  }
  return bars(rows);
}

/** Deterministic random walk (LCG, fixed seed), prices rounded to 1e-5. */
export function randomWalk(n: number, seed = 42, start = 1.1, stepPips = 3): Bars {
  let s = seed >>> 0;
  const rnd = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
  const r5 = (x: number) => Math.round(x * 1e5) / 1e5;
  const rows: [number, number, number, number][] = [];
  const volumes: number[] = [];
  let price = start;
  for (let i = 0; i < n; i++) {
    const o = price;
    const c = r5(o + (rnd() - 0.5) * 2 * stepPips * 1e-4);
    const h = r5(Math.max(o, c) + rnd() * stepPips * 1e-4);
    const l = r5(Math.min(o, c) - rnd() * stepPips * 1e-4);
    rows.push([o, h, l, c]);
    volumes.push(Math.round(rnd() * 1000) + 1); // never 0, so cumulative volume always grows
    price = c;
  }
  return bars(rows, volumes);
}
