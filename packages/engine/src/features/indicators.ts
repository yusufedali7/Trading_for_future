import type { Bars } from './bars';

/**
 * M8: common indicators. Each value at index i uses only bars[0..i] (rule 3, no lookahead);
 * before `period` bars exist the value is null.
 */

export function sma(b: Bars, period: number): (number | null)[] {
  const out: (number | null)[] = new Array(b.length).fill(null);
  let sum = 0;
  for (let i = 0; i < b.length; i++) {
    sum += b.c[i]!;
    if (i >= period) sum -= b.c[i - period]!;
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

/** Seeded with the SMA of the first `period` closes (standard convention). */
export function ema(b: Bars, period: number): (number | null)[] {
  const out: (number | null)[] = new Array(b.length).fill(null);
  const k = 2 / (period + 1);
  let prev: number | null = null;
  let sum = 0;
  for (let i = 0; i < b.length; i++) {
    sum += b.c[i]!;
    if (i < period - 1) continue;
    if (i === period - 1) prev = sum / period;
    else prev = b.c[i]! * k + prev! * (1 - k);
    out[i] = prev;
  }
  return out;
}

/** Wilder's RSI: seeded with the average gain/loss of the first `period` changes, then smoothed. */
export function rsi(b: Bars, period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(b.length).fill(null);
  if (b.length < period + 1) return out;
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const change = b.c[i]! - b.c[i - 1]!;
    if (change > 0) avgGain += change;
    else avgLoss -= change;
  }
  avgGain /= period;
  avgLoss /= period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < b.length; i++) {
    const change = b.c[i]! - b.c[i - 1]!;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

/** True range: vs. the previous close for bar 0's neighbours; bar 0 uses its own high-low. */
function trueRange(b: Bars, i: number): number {
  if (i === 0) return b.h[0]! - b.l[0]!;
  const prevClose = b.c[i - 1]!;
  return Math.max(b.h[i]! - b.l[i]!, Math.abs(b.h[i]! - prevClose), Math.abs(b.l[i]! - prevClose));
}

/** Wilder's ATR: seeded with the simple average of the first `period` true ranges. */
export function atr(b: Bars, period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(b.length).fill(null);
  if (b.length < period) return out;
  let sum = 0;
  for (let i = 0; i < period; i++) sum += trueRange(b, i);
  let prev = sum / period;
  out[period - 1] = prev;
  for (let i = period; i < b.length; i++) {
    prev = (prev * (period - 1) + trueRange(b, i)) / period;
    out[i] = prev;
  }
  return out;
}

/** EMA of an arbitrary (possibly leading-null) series: seeds once `period` values have arrived. */
function emaOfSeries(values: readonly (number | null)[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  const k = 2 / (period + 1);
  let prev: number | null = null;
  let sum = 0;
  let count = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v === null) continue;
    count++;
    if (count <= period) sum += v;
    if (count < period) continue;
    prev = count === period ? sum / period : v * k + prev! * (1 - k);
    out[i] = prev;
  }
  return out;
}

export interface Macd {
  line: (number | null)[];
  signal: (number | null)[];
  histogram: (number | null)[];
}

/** Standard MACD: fast EMA minus slow EMA, then its own EMA as the signal line. */
export function macd(b: Bars, fast = 12, slow = 26, signalPeriod = 9): Macd {
  const fastE = ema(b, fast);
  const slowE = ema(b, slow);
  const line = fastE.map((f, i) => (f === null || slowE[i] === null ? null : f - slowE[i]!));
  const signal = emaOfSeries(line, signalPeriod);
  const histogram = line.map((l, i) => (l === null || signal[i] === null ? null : l - signal[i]!));
  return { line, signal, histogram };
}

export interface Bollinger {
  middle: (number | null)[];
  upper: (number | null)[];
  lower: (number | null)[];
}

/** Bollinger Bands: SMA middle band, ± k population standard deviations of the same window. */
export function bollinger(b: Bars, period = 20, k = 2): Bollinger {
  const middle = sma(b, period);
  const upper: (number | null)[] = new Array(b.length).fill(null);
  const lower: (number | null)[] = new Array(b.length).fill(null);
  for (let i = period - 1; i < b.length; i++) {
    const mean = middle[i]!;
    let sumSq = 0;
    for (let j = i - period + 1; j <= i; j++) sumSq += (b.c[j]! - mean) ** 2;
    const sd = Math.sqrt(sumSq / period);
    upper[i] = mean + k * sd;
    lower[i] = mean - k * sd;
  }
  return { middle, upper, lower };
}

/**
 * Anchored VWAP from the start of `b` (no session reset in v1): cumulative (typical price ×
 * volume) / cumulative volume. Null where no volume has been seen yet (honest "no data", not 0).
 */
export function vwap(b: Bars): (number | null)[] {
  const out: (number | null)[] = new Array(b.length).fill(null);
  let pv = 0;
  let vol = 0;
  for (let i = 0; i < b.length; i++) {
    const typical = (b.h[i]! + b.l[i]! + b.c[i]!) / 3;
    pv += typical * b.v[i]!;
    vol += b.v[i]!;
    out[i] = vol > 0 ? pv / vol : null;
  }
  return out;
}
