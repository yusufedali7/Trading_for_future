import { utcToLocal } from '../core/tz';
import type { UtcMs } from '../core/types';
import type { Instrument } from './registry';

export type MarketState = 'OPEN' | 'WEEKEND' | 'DAILY_BREAK';

const DAY_MIN = 1440;
/** Minutes from Monday 00:00 for each supported week-boundary day. */
const DAY_OFFSET = { SUN: 6 * DAY_MIN, FRI: 4 * DAY_MIN } as const;

function minuteOfDay(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Whether the instrument trades at instant t, judged in the exchange's own time zone (DST-aware). */
export function marketState(inst: Instrument, t: UtcMs): MarketState {
  const hours = inst.tradingHours;
  if (hours.kind === 'ALWAYS') return 'OPEN';

  const local = utcToLocal(t, hours.weekOpen.tz);
  const minuteOfWeek = (local.weekday - 1) * DAY_MIN + local.hour * 60 + local.minute;
  const open = DAY_OFFSET[hours.weekOpen.day] + minuteOfDay(hours.weekOpen.time);
  const close = DAY_OFFSET[hours.weekClose.day] + minuteOfDay(hours.weekClose.time);
  // The trading week wraps around Monday 00:00 (opens Sunday, closes Friday).
  const inWeek =
    open > close
      ? minuteOfWeek >= open || minuteOfWeek < close
      : minuteOfWeek >= open && minuteOfWeek < close;
  if (!inWeek) return 'WEEKEND';

  if (inst.dailyBreak) {
    const b = inst.dailyBreak;
    const l = b.tz === hours.weekOpen.tz ? local : utcToLocal(t, b.tz);
    const m = l.hour * 60 + l.minute;
    if (m >= minuteOfDay(b.start) && m < minuteOfDay(b.end)) return 'DAILY_BREAK';
  }
  return 'OPEN';
}
