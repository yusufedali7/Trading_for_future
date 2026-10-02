import { describe, expect, it } from 'vitest';
import type { Timeframe } from '../src/core/timeframe';
import { seriesFromRows, type CandleRow } from '../src/data/columnar';
import { resample } from '../src/data/resample';
import { computeFeatures, featuresAsOf, previousPeriods } from '../src/features/compute';
import { marketState } from '../src/instruments/hours';
import { getInstrument } from '../src/instruments/registry';
import { sessionLevels } from '../src/session/levels';
import { BUILTIN_SESSIONS, sessionInstances } from '../src/session/sessions';
import { seriesUpTo } from '../src/replay/view';

// SYNTHETIC: four trading days of 1m EURUSD bars (seeded random walk), Sun 22:00Z → Thu 22:00Z.
const MIN = 60_000;
const EUR = getInstrument('EURUSD');
const from = Date.parse('2026-01-04T22:00:00Z');
const to = Date.parse('2026-01-08T22:00:00Z');
let seed = 1234;
const rnd = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 2 ** 32;
};
const r5 = (x: number) => Math.round(x * 1e5) / 1e5;
const rows: CandleRow[] = [];
let price = 1.1;
for (let t = from; t < to; t += MIN) {
  if (marketState(EUR, t) !== 'OPEN') continue;
  const o = price;
  const c = r5(o + (rnd() - 0.5) * 0.0004);
  rows.push({
    t,
    o,
    h: r5(Math.max(o, c) + rnd() * 0.0002),
    l: r5(Math.min(o, c) - rnd() * 0.0002),
    c,
  });
  price = c;
}
const series = seriesFromRows(rows, false);
const instances = BUILTIN_SESSIONS.flatMap((d) => sessionInstances(d, EUR, from, to)).sort(
  (a, b) => a.startUtc - b.startUtc || a.sessionId.localeCompare(b.sessionId),
);

/** Everything computed from the data as it was at `asOf`. */
function featuresAt(asOf: number, tf: Timeframe) {
  const s = seriesUpTo(series, asOf, MIN);
  return computeFeatures({
    candles: resample(s, EUR, tf, { asOf }),
    inst: EUR,
    tf,
    periods: previousPeriods(s, EUR, asOf),
    sessions: sessionLevels(s, instances, asOf, MIN),
  });
}

describe('feature engine v1: no lookahead', () => {
  const end = rows[rows.length - 1]!.t + MIN;
  // Cut-offs spread over the data, many of them in the middle of a bar of the larger timeframes.
  const cutoffs = Array.from({ length: 18 }, (_, j) => rows[1500 + j * 211]!.t + MIN);

  for (const tf of ['5m', '15m', '1h', '4h'] as const) {
    it(`${tf}: features of data cut at any time = full features filtered to that time`, () => {
      const full = featuresAt(end, tf);
      expect(full.swings.length).toBeGreaterThan(tf === '4h' ? 1 : 10);
      expect(full.periods.length).toBeGreaterThan(2);
      if (tf !== '4h') {
        expect(full.fvgs.length).toBeGreaterThan(0);
        expect(full.breaks.length).toBeGreaterThan(0);
        expect(full.sweeps.length).toBeGreaterThan(0);
      }
      for (const c of cutoffs) expect(featuresAt(c, tf)).toEqual(featuresAsOf(full, c));
    });
  }

  it('sweeps use previous-day and session levels too', () => {
    const kinds = new Set(featuresAt(end, '5m').sweeps.map((s) => s.levelKind));
    expect([...kinds].some((k) => k === 'PDH' || k === 'PDL')).toBe(true);
    expect([...kinds].some((k) => k.startsWith('ASIA') || k.startsWith('LONDON'))).toBe(true);
  });
});
