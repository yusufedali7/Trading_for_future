import type { Timeframe } from '../core/timeframe';
import type { UtcMs } from '../core/types';
import { bucketEnds, type ResampledCandle } from '../data/resample';
import type { Instrument } from '../instruments/registry';

/**
 * Closed bars of one timeframe, as feature detectors see them. Only complete candles are
 * included: a still-forming bar is never used (rule 3). `end[i]` is when bar i became known.
 */
export interface Bars {
  readonly length: number;
  readonly t: readonly UtcMs[];
  readonly o: readonly number[];
  readonly h: readonly number[];
  readonly l: readonly number[];
  readonly c: readonly number[];
  readonly end: readonly UtcMs[];
  /** Tick/trade volume; 0 where the source candle had none (M8 VWAP). */
  readonly v: readonly number[];
}

export function toBars(candles: readonly ResampledCandle[], inst: Instrument, tf: Timeframe): Bars {
  let n = 0;
  while (n < candles.length && candles[n]!.complete) n++;
  const closed = candles.slice(0, n);
  const t = closed.map((c) => c.t);
  return {
    length: n,
    t,
    o: closed.map((c) => c.o),
    h: closed.map((c) => c.h),
    l: closed.map((c) => c.l),
    c: closed.map((c) => c.c),
    end: bucketEnds(inst, tf, t),
    v: closed.map((c) => c.v ?? 0),
  };
}

/** The first `n` bars (what was known after bar n−1 closed). */
export function sliceBars(b: Bars, n: number): Bars {
  return {
    length: Math.min(n, b.length),
    t: b.t.slice(0, n),
    o: b.o.slice(0, n),
    h: b.h.slice(0, n),
    l: b.l.slice(0, n),
    c: b.c.slice(0, n),
    end: b.end.slice(0, n),
    v: b.v.slice(0, n),
  };
}
