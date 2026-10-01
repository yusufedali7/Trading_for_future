import { TIMEFRAMES, timeframeMs, type Timeframe } from '../core/timeframe';
import { localToUtc, type LocalDateTime } from '../core/tz';
import type { IanaTz, UtcMs } from '../core/types';
import { marketState, type MarketState } from '../instruments/hours';
import type { Instrument } from '../instruments/registry';
import type { RawRecord } from './csv-rows';

/** A parsed record whose time is resolved to UTC. `t` is the bar's open time. */
export interface TimedRecord {
  row: number;
  t: UtcMs;
  o: number;
  h: number;
  l: number;
  c: number;
  v?: number;
}

export interface DstIssue {
  row: number;
  local: string;
  kind: 'AMBIGUOUS' | 'NONEXISTENT';
}

export interface ValidationReport {
  recordCount: number;
  inferredTimeframe: Timeframe | null;
  duplicates: { t: UtcMs; identical: boolean; rows: number[] }[];
  outOfOrder: { row: number; t: UtcMs }[];
  /** Gaps containing bars that should exist (market open). `from`/`to` are the bars around the gap. */
  gaps: { from: UtcMs; to: UtcMs; missingBars: number }[];
  /** Gaps fully explained by market closure (weekends, daily breaks). Not a problem. */
  closedMarketGaps: number;
  closedMarketCandles: { row: number; t: UtcMs; reason: Exclude<MarketState, 'OPEN'> }[];
  nonPositive: { row: number; field: 'o' | 'h' | 'l' | 'c' | 'v' }[];
  ohlcInconsistent: { row: number; t: UtcMs }[];
  precisionOverflow: { row: number }[];
}

const pad = (n: number, w = 2) => String(n).padStart(w, '0');

function formatLocal(l: LocalDateTime): string {
  return `${l.year}-${pad(l.month)}-${pad(l.day)} ${pad(l.hour)}:${pad(l.minute)}`;
}

/** Converts parsed records to UTC. DST gaps/overlaps are reported and the rows left out. */
export function resolveTimes(
  records: readonly RawRecord[],
  sourceTz: IanaTz,
): { records: TimedRecord[]; dstIssues: DstIssue[] } {
  const out: TimedRecord[] = [];
  const dstIssues: DstIssue[] = [];
  for (const r of records) {
    let t: UtcMs;
    if (r.time.kind === 'UTC') {
      t = r.time.utc;
    } else {
      const res = localToUtc(r.time.local, sourceTz);
      if (res.kind !== 'OK') {
        dstIssues.push({ row: r.row, local: formatLocal(r.time.local), kind: res.kind });
        continue;
      }
      t = res.utc;
    }
    const rec: TimedRecord = { row: r.row, t, o: r.o, h: r.h, l: r.l, c: r.c };
    if (r.v !== undefined) rec.v = r.v;
    out.push(rec);
  }
  return { records: out, dstIssues };
}

function inferTimeframe(sortedUniqueTimes: readonly UtcMs[]): Timeframe | null {
  const counts = new Map<number, number>();
  for (let i = 1; i < sortedUniqueTimes.length; i++) {
    const d = sortedUniqueTimes[i]! - sortedUniqueTimes[i - 1]!;
    counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  let best: number | undefined;
  let bestCount = 0;
  for (const [d, n] of counts) {
    if (n > bestCount || (n === bestCount && best !== undefined && d < best)) {
      best = d;
      bestCount = n;
    }
  }
  if (best === undefined) return null;
  return TIMEFRAMES.find((tf) => tf !== '1D' && tf !== '1W' && timeframeMs(tf) === best) ?? null;
}

function sameValues(a: TimedRecord, b: TimedRecord): boolean {
  return a.o === b.o && a.h === b.h && a.l === b.l && a.c === b.c && a.v === b.v;
}

/**
 * Checks imported bars and reports every problem found. It never changes, drops or
 * reorders data: fixes are an explicit, recorded user decision (CLAUDE.md "Veri").
 */
export function validateRecords(
  records: readonly TimedRecord[],
  inst: Instrument,
  options: { timeframe?: Timeframe } = {},
): ValidationReport {
  const outOfOrder: ValidationReport['outOfOrder'] = [];
  const closedMarketCandles: ValidationReport['closedMarketCandles'] = [];
  const nonPositive: ValidationReport['nonPositive'] = [];
  const ohlcInconsistent: ValidationReport['ohlcInconsistent'] = [];
  const precisionOverflow: ValidationReport['precisionOverflow'] = [];
  const perUnit = Math.round(1 / inst.tickSize);

  records.forEach((r, i) => {
    const prev = records[i - 1];
    if (prev && r.t < prev.t) outOfOrder.push({ row: r.row, t: r.t });

    const state = marketState(inst, r.t);
    if (state !== 'OPEN') closedMarketCandles.push({ row: r.row, t: r.t, reason: state });

    for (const field of ['o', 'h', 'l', 'c'] as const) {
      if (!(r[field] > 0)) nonPositive.push({ row: r.row, field });
    }
    if (r.v !== undefined && r.v < 0) nonPositive.push({ row: r.row, field: 'v' });

    if (!(r.l <= Math.min(r.o, r.c) && r.h >= Math.max(r.o, r.c) && r.l <= r.h)) {
      ohlcInconsistent.push({ row: r.row, t: r.t });
    }

    const fine = [r.o, r.h, r.l, r.c].some((p) => {
      const ticks = p * perUnit;
      return Math.abs(ticks - Math.round(ticks)) > 1e-6;
    });
    if (fine) precisionOverflow.push({ row: r.row });
  });

  // Duplicates and gaps are judged on time order, on a sorted copy.
  const sorted = [...records].sort((a, b) => a.t - b.t || a.row - b.row);
  const duplicates: ValidationReport['duplicates'] = [];
  const uniqueTimes: UtcMs[] = [];
  for (let i = 0; i < sorted.length; ) {
    let j = i + 1;
    while (j < sorted.length && sorted[j]!.t === sorted[i]!.t) j++;
    const group = sorted.slice(i, j);
    if (group.length > 1) {
      duplicates.push({
        t: group[0]!.t,
        identical: group.every((g) => sameValues(g, group[0]!)),
        rows: group.map((g) => g.row).sort((a, b) => a - b),
      });
    }
    uniqueTimes.push(group[0]!.t);
    i = j;
  }

  const inferredTimeframe = inferTimeframe(uniqueTimes);
  const tf = options.timeframe ?? inferredTimeframe;
  const gaps: ValidationReport['gaps'] = [];
  let closedMarketGaps = 0;
  if (tf) {
    const step = timeframeMs(tf);
    for (let i = 1; i < uniqueTimes.length; i++) {
      const from = uniqueTimes[i - 1]!;
      const to = uniqueTimes[i]!;
      if (to - from <= step) continue;
      let missingBars = 0;
      for (let slot = from + step; slot < to; slot += step) {
        if (marketState(inst, slot) === 'OPEN') missingBars++;
      }
      if (missingBars > 0) gaps.push({ from, to, missingBars });
      else closedMarketGaps++;
    }
  }

  return {
    recordCount: records.length,
    inferredTimeframe,
    duplicates,
    outOfOrder,
    gaps,
    closedMarketGaps,
    closedMarketCandles,
    nonPositive,
    ohlcInconsistent,
    precisionOverflow,
  };
}
