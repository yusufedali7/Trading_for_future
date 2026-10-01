import { createTextHasher } from '../core/hash';

/**
 * Candles stored column-wise (compact, fast to scan and to persist).
 * `t` is each bar's open time in UTC ms; a bar is known only at t + timeframe.
 */
export interface CandleSeries {
  readonly length: number;
  readonly t: Float64Array;
  readonly o: Float64Array;
  readonly h: Float64Array;
  readonly l: Float64Array;
  readonly c: Float64Array;
  /** null when the source had no volume column. */
  readonly v: Float64Array | null;
  /** SHA-256 of the canonical text form; see hashSeries. */
  readonly contentHash: string;
}

export interface CandleRow {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v?: number;
}

const HASH_HEADER = 'trw-candles-v1\n';
const HASH_CHUNK = 10_000;

/**
 * Canonical form: one "t,o,h,l,c,v" line per bar with JS shortest round-trip number
 * formatting. Changing this format changes every hash: bump the header version if you do.
 */
export function hashColumns(cols: Omit<CandleSeries, 'contentHash'>): string {
  const hasher = createTextHasher().update(HASH_HEADER);
  let buf = '';
  for (let i = 0; i < cols.length; i++) {
    const v = cols.v ? String(cols.v[i]) : '';
    buf += `${cols.t[i]},${cols.o[i]},${cols.h[i]},${cols.l[i]},${cols.c[i]},${v}\n`;
    if ((i + 1) % HASH_CHUNK === 0) {
      hasher.update(buf);
      buf = '';
    }
  }
  return hasher.update(buf).hex();
}

export function seriesFromRows(rows: readonly CandleRow[], withVolume: boolean): CandleSeries {
  const n = rows.length;
  const cols = {
    length: n,
    t: new Float64Array(n),
    o: new Float64Array(n),
    h: new Float64Array(n),
    l: new Float64Array(n),
    c: new Float64Array(n),
    v: withVolume ? new Float64Array(n) : null,
  };
  rows.forEach((r, i) => {
    cols.t[i] = r.t;
    cols.o[i] = r.o;
    cols.h[i] = r.h;
    cols.l[i] = r.l;
    cols.c[i] = r.c;
    if (cols.v) cols.v[i] = r.v ?? 0;
  });
  return { ...cols, contentHash: hashColumns(cols) };
}
