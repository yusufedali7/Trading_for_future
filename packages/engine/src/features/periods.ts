import type { Timeframe } from '../core/timeframe';
import type { UtcMs } from '../core/types';
import type { CandleSeries } from '../data/columnar';
import { bucketEnds, resample } from '../data/resample';
import { marketState } from '../instruments/hours';
import type { Instrument } from '../instruments/registry';
import type { PeriodKind, PeriodLevel } from './types';

const HOUR = 3_600_000;
const TF: Record<PeriodKind, Timeframe> = { DAY: '1D', WEEK: '1W' };

function hasOpenHour(inst: Instrument, from: UtcMs, to: UtcMs): boolean {
  for (let t = from; t < to; t += HOUR) if (marketState(inst, t) === 'OPEN') return true;
  return false;
}

/** End of the first period starting at or after `from` in which the market opens. */
function nextTradingPeriodEnd(inst: Instrument, tf: Timeframe, from: UtcMs): UtcMs {
  let start = from;
  for (let guard = 0; guard < 14; guard++) {
    const end = bucketEnds(inst, tf, [start])[0]!;
    if (hasOpenHour(inst, start, end)) return end;
    start = end;
  }
  throw new Error('no trading period found within two weeks');
}

/**
 * Previous day / week high and low, definition v1 (docs/definitions/period-levels-v1.md).
 * Periods follow the instrument's trading day (17:00 New York, D11/D17). Only periods that ended
 * by `asOf` are returned; each is a level from its end until the end of the next period in which
 * the market is open (Friday's levels carry over the weekend to Monday's trading day).
 */
export function periodLevels(
  series: CandleSeries,
  inst: Instrument,
  period: PeriodKind,
  asOf: UtcMs,
  baseTimeframe: Timeframe = '1m',
): PeriodLevel[] {
  const tf = TF[period];
  const candles = resample(series, inst, tf, { asOf, baseTimeframe });
  const ends = bucketEnds(
    inst,
    tf,
    candles.map((c) => c.t),
  );
  const out: PeriodLevel[] = [];
  candles.forEach((c, i) => {
    const end = ends[i]!;
    if (end > asOf) return;
    out.push({
      id: `PERIOD:v1:${period}:${c.t}`,
      defVersion: 'v1',
      period,
      start: c.t,
      end,
      high: c.h,
      low: c.l,
      knownAt: end,
      validUntil: nextTradingPeriodEnd(inst, tf, end),
    });
  });
  return out;
}
