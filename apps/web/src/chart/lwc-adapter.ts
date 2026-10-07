import type {
  CandlestickData,
  HistogramData,
  Time,
  TickMarkType,
  UTCTimestamp,
} from 'lightweight-charts';
import {
  utcToLocal,
  type IanaTz,
  type Instrument,
  type LocalParts,
  type ResampledCandle,
  type Timeframe,
  type UtcMs,
} from '@trw/engine';
import { tr } from '../i18n/tr';

export { TickMarkType as TICK } from 'lightweight-charts';

export interface CandleColors {
  up: string;
  down: string;
  incomplete: string;
}

/**
 * The chart is always fed UTC seconds (DECISIONS D9). Shifting timestamps into a display zone
 * would duplicate times on DST fall-back nights; instead only the labels are localised.
 */
export const toChartTime = (t: UtcMs) => (t / 1000) as UTCTimestamp;

export function fromChartTime(time: Time): UtcMs {
  if (typeof time !== 'number') throw new Error('Expected a UTC timestamp');
  return time * 1000;
}

export function toCandleData(
  candles: readonly ResampledCandle[],
  colors: CandleColors,
): CandlestickData<UTCTimestamp>[] {
  return candles.map((c) => {
    const d: CandlestickData<UTCTimestamp> = {
      time: toChartTime(c.t),
      open: c.o,
      high: c.h,
      low: c.l,
      close: c.c,
    };
    if (!c.complete) {
      d.color = colors.incomplete;
      d.wickColor = colors.incomplete;
      d.borderColor = colors.incomplete;
    }
    return d;
  });
}

export function toVolumeData(
  candles: readonly ResampledCandle[],
  colors: CandleColors,
): HistogramData<UTCTimestamp>[] | null {
  if (candles.length === 0 || candles[0]!.v === undefined) return null;
  return candles.map((c) => ({
    time: toChartTime(c.t),
    value: c.v ?? 0,
    color: !c.complete ? colors.incomplete : c.c >= c.o ? colors.up : colors.down,
  }));
}

const pad = (n: number) => String(n).padStart(2, '0');
const isDaily = (tf: Timeframe) => tf === '1D' || tf === '1W';

/**
 * Daily/weekly buckets open at the previous daily close (17:00 New York). Forex names such a
 * bucket after the day it closes, so the label is the close-zone date one day after the open.
 */
function tradingDate(t: UtcMs, inst: Instrument): LocalParts {
  return utcToLocal(t + 86_400_000, inst.dailyClose.tz);
}

function partsFor(t: UtcMs, tf: Timeframe, tz: IanaTz, inst: Instrument): LocalParts {
  return isDaily(tf) ? tradingDate(t, inst) : utcToLocal(t, tz);
}

/** Crosshair / legend label. */
export function timeLabel(t: UtcMs, tf: Timeframe, tz: IanaTz, inst: Instrument): string {
  const l = partsFor(t, tf, tz, inst);
  const date = `${l.year}-${pad(l.month)}-${pad(l.day)}`;
  return isDaily(tf) ? date : `${date} ${pad(l.hour)}:${pad(l.minute)}`;
}

/** Axis tick label; tick positions are chosen by the library, labels follow the display zone. */
export function tickLabel(
  t: UtcMs,
  type: TickMarkType,
  tf: Timeframe,
  tz: IanaTz,
  inst: Instrument,
): string {
  const l = partsFor(t, tf, tz, inst);
  const month = tr.months[l.month - 1]!;
  switch (type) {
    case 0: // Year
      return String(l.year);
    case 1: // Month
      return month;
    case 2: // DayOfMonth
      return `${l.day} ${month}`;
    default: // Time, TimeWithSeconds
      return `${pad(l.hour)}:${pad(l.minute)}`;
  }
}
