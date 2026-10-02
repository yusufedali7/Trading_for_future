// SYNTHETIC test data: a seeded random walk of 1m EURUSD bars on market-open minutes only.
import type { Timeframe } from '../../src/core/timeframe';
import { seriesFromRows, type CandleRow, type CandleSeries } from '../../src/data/columnar';
import { resample, type ResampledCandle } from '../../src/data/resample';
import {
  FEATURE_DEFAULTS,
  computeFeatures,
  previousPeriods,
  type FeatureParams,
  type FeatureSet,
} from '../../src/features/compute';
import { marketState } from '../../src/instruments/hours';
import { getInstrument } from '../../src/instruments/registry';
import { seriesUpTo } from '../../src/replay/view';
import { sessionLevels } from '../../src/session/levels';
import { BUILTIN_SESSIONS, sessionInstances } from '../../src/session/sessions';

export const MIN = 60_000;
export const EUR = getInstrument('EURUSD');

export function syntheticMinutes(
  from: string,
  to: string,
  seed: number,
  stepPips = 2,
): CandleRow[] {
  let s = seed >>> 0;
  const rnd = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
  const r5 = (x: number) => Math.round(x * 1e5) / 1e5;
  const rows: CandleRow[] = [];
  let price = 1.1;
  const step = stepPips * 1e-4;
  for (let t = Date.parse(from); t < Date.parse(to); t += MIN) {
    if (marketState(EUR, t) !== 'OPEN') continue;
    const o = price;
    const c = r5(o + (rnd() - 0.5) * step);
    rows.push({
      t,
      o,
      h: r5(Math.max(o, c) + rnd() * step * 0.5),
      l: r5(Math.min(o, c) - rnd() * step * 0.5),
      c,
    });
    price = c;
  }
  return rows;
}

/** A dataset fixture with a helper that computes everything as known at `asOf`. */
export function syntheticDataset(from: string, to: string, seed: number) {
  const rows = syntheticMinutes(from, to, seed);
  const series = seriesFromRows(rows, false);
  const instances = BUILTIN_SESSIONS.flatMap((d) =>
    sessionInstances(d, EUR, Date.parse(from), Date.parse(to)),
  ).sort((a, b) => a.startUtc - b.startUtc || a.sessionId.localeCompare(b.sessionId));
  const end = rows[rows.length - 1]!.t + MIN;

  function at(
    asOf: number,
    tf: Timeframe,
    params: FeatureParams = FEATURE_DEFAULTS,
  ): { series: CandleSeries; candles: ResampledCandle[]; features: FeatureSet } {
    const cut = seriesUpTo(series, asOf, MIN);
    const candles = resample(cut, EUR, tf, { asOf });
    const features = computeFeatures(
      {
        candles,
        inst: EUR,
        tf,
        periods: previousPeriods(cut, EUR, asOf),
        sessions: sessionLevels(cut, instances, asOf, MIN),
      },
      params,
    );
    return { series: cut, candles, features };
  }
  return { rows, series, instances, end, at };
}
