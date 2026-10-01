import { timeframeMs, type Timeframe } from '../core/timeframe';
import { localToUtc, utcToLocal } from '../core/tz';
import type { UtcMs } from '../core/types';
import { marketState } from '../instruments/hours';
import type { Instrument } from '../instruments/registry';
import type { CandleSeries } from './columnar';

export interface ResampledCandle {
  /** Bucket open time (UTC). */
  t: UtcMs;
  o: number;
  h: number;
  l: number;
  c: number;
  v?: number;
  /** Base bars that fell into the bucket. */
  sourceCount: number;
  /** Base bars the bucket would hold if every market-open slot had data. */
  expectedCount: number;
  /** False while the bucket has not closed yet at `asOf` (still forming). */
  complete: boolean;
}

interface Range {
  start: UtcMs;
  end: UtcMs;
}


/** UTC instant of the daily-close wall time on the given local calendar date. */
function closeOn(inst: Instrument, year: number, month: number, day: number): UtcMs {
  const [hh, mm] = inst.dailyClose.time.split(':').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  const res = localToUtc(
    {
      year: d.getUTCFullYear(),
      month: d.getUTCMonth() + 1,
      day: d.getUTCDate(),
      hour: hh ?? 0,
      minute: mm ?? 0,
    },
    inst.dailyClose.tz,
  );
  // A daily close inside a DST gap/overlap would be a misconfiguration; fail loudly.
  if (res.kind !== 'OK') {
    throw new Error(`Daily close ${inst.dailyClose.time} is ${res.kind} on ${year}-${month}-${day}`);
  }
  return res.utc;
}

/** Trading day containing t: from the previous daily close (inclusive) to the next one. */
function tradingDay(inst: Instrument, t: UtcMs): Range {
  const local = utcToLocal(t, inst.dailyClose.tz);
  const [hh, mm] = inst.dailyClose.time.split(':').map(Number);
  const afterClose = local.hour * 60 + local.minute >= (hh ?? 0) * 60 + (mm ?? 0);
  const dayOffset = afterClose ? 0 : -1;
  return {
    start: closeOn(inst, local.year, local.month, local.day + dayOffset),
    end: closeOn(inst, local.year, local.month, local.day + dayOffset + 1),
  };
}

/** Trading week containing t: Sunday daily close to the next Sunday daily close. */
function tradingWeek(inst: Instrument, t: UtcMs): Range {
  const day = tradingDay(inst, t);
  // The trading day starting at `day.start` is named after its start date; walk back to Sunday.
  const startLocal = utcToLocal(day.start, inst.dailyClose.tz);
  const back = startLocal.weekday % 7; // Sunday (7) → 0, Monday → 1, …, Saturday → 6
  const y = startLocal.year;
  const m = startLocal.month;
  const d = startLocal.day - back;
  return { start: closeOn(inst, y, m, d), end: closeOn(inst, y, m, d + 7) };
}

/** `day` may be passed when the caller already knows the trading day containing t. */
function bucketRange(inst: Instrument, tf: Timeframe, t: UtcMs, knownDay?: Range): Range {
  if (tf === '1W') return tradingWeek(inst, t);
  const day = knownDay && t >= knownDay.start && t < knownDay.end ? knownDay : tradingDay(inst, t);
  if (tf === '1D') return day;
  // Intraday: elapsed time from the trading-day start. DST shifts happen at weekends for FX,
  // so on trading days this matches wall-clock alignment (17, 21, 01, 05, 09, 13 NY for 4H).
  const step = timeframeMs(tf);
  const start = day.start + Math.floor((t - day.start) / step) * step;
  return { start, end: Math.min(start + step, day.end) };
}

/** Open time of the bucket of timeframe `tf` that contains instant t. */
export function bucketStart(inst: Instrument, tf: Timeframe, t: UtcMs): UtcMs {
  return bucketRange(inst, tf, t).start;
}

function openSlots(inst: Instrument, from: UtcMs, to: UtcMs, step: number): number {
  let n = 0;
  for (let s = from; s < to; s += step) if (marketState(inst, s) === 'OPEN') n++;
  return n;
}

/**
 * Aggregates base bars into `tf` buckets aligned to the instrument's daily close.
 * Empty buckets are not created; missing base bars show up as sourceCount < expectedCount.
 * `asOf` is the instant up to which data is known (the engine never reads the clock).
 */
export function resample(
  series: CandleSeries,
  inst: Instrument,
  tf: Timeframe,
  options: { asOf: UtcMs; baseTimeframe?: Timeframe },
): ResampledCandle[] {
  const baseMs = timeframeMs(options.baseTimeframe ?? '1m');
  const out: ResampledCandle[] = [];
  let range: Range | null = null;
  let day: Range | undefined;
  let cur: ResampledCandle | null = null;

  const finish = () => {
    if (!cur || !range) return;
    cur.expectedCount = openSlots(inst, range.start, range.end, baseMs);
    cur.complete =
      range.end <= options.asOf || openSlots(inst, options.asOf, range.end, baseMs) === 0;
    out.push(cur);
  };

  for (let i = 0; i < series.length; i++) {
    const t = series.t[i]!;
    if (!range || t >= range.end || t < range.start) {
      finish();
      if (!day || t < day.start || t >= day.end) day = tradingDay(inst, t);
      range = bucketRange(inst, tf, t, day);
      cur = {
        t: range.start,
        o: series.o[i]!,
        h: series.h[i]!,
        l: series.l[i]!,
        c: series.c[i]!,
        sourceCount: 0,
        expectedCount: 0,
        complete: false,
      };
      if (series.v) cur.v = 0;
    }
    const c = cur!;
    c.h = Math.max(c.h, series.h[i]!);
    c.l = Math.min(c.l, series.l[i]!);
    c.c = series.c[i]!;
    if (series.v) c.v = (c.v ?? 0) + series.v[i]!;
    c.sourceCount++;
  }
  finish();
  return out;
}

