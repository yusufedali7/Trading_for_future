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
