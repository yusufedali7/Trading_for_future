import { describe, expect, it } from 'vitest';
import { seriesFromRows, type CandleRow } from '../src/data/columnar';
import { resample } from '../src/data/resample';
import { getInstrument } from '../src/instruments/registry';
import { replayCandles, seriesUpTo } from '../src/replay/view';
import type { Timeframe } from '../src/core/timeframe';

// SYNTHETIC: hand-built 1m bars from Tue 2026-01-06 20:00Z to Wed 01:00Z with a gap at 22:10-22:39.
const t = (iso: string) => Date.parse(iso);
const MIN = 60_000;
const eurusd = getInstrument('EURUSD');
const rows: CandleRow[] = [];
for (let m = 0; m < 300; m++) {
  if (m >= 130 && m < 160) continue;
  const mid = 1.1 + ((m * 11) % 17) / 10_000;
  rows.push({
    t: t('2026-01-06T20:00:00Z') + m * MIN,
    o: mid,
    h: mid + 0.0003,
    l: mid - 0.0002,
    c: mid + 0.0001,
    v: 1,
  });
}
const series = seriesFromRows(rows, true);
const end = rows[rows.length - 1]!.t + MIN;

describe('seriesUpTo', () => {
  it('keeps only bars that have closed by the cut-off', () => {
    const cut = t('2026-01-06T20:10:30Z');
    const s = seriesUpTo(series, cut, MIN);
    expect(s.length).toBe(10); // 20:00 … 20:09 (the 20:10 bar closes at 20:11)
    expect(s.t[s.length - 1]).toBe(t('2026-01-06T20:09:00Z'));
  });

  it('returns nothing before the first bar has closed', () => {
    expect(seriesUpTo(series, t('2026-01-06T20:00:30Z'), MIN).length).toBe(0);
  });
});

describe('replayCandles', () => {
  const cutoffs = [
    '2026-01-06T20:01:00Z',
    '2026-01-06T20:15:00Z',
    '2026-01-06T20:17:00Z',
    '2026-01-06T21:59:00Z',
    '2026-01-06T22:00:00Z', // trading-day boundary (17:00 NY)
    '2026-01-06T22:20:00Z', // inside the data gap
    '2026-01-06T23:42:00Z',
    '2026-01-07T01:00:00Z',
  ].map(t);

  for (const tf of ['5m', '15m', '1h', '4h', '1D'] as Timeframe[]) {
    it(`${tf}: equals resampling the data truncated at the cut-off (no future bars)`, () => {
      const full = resample(series, eurusd, tf, { asOf: end });
      for (const cut of cutoffs) {
        const expected = resample(seriesUpTo(series, cut, MIN), eurusd, tf, { asOf: cut });
        expect(replayCandles(full, series, eurusd, tf, cut)).toEqual(expected);
      }
    });
  }

  it('marks the last bar as still forming when the cut-off is inside it', () => {
    const full = resample(series, eurusd, '15m', { asOf: end });
    const out = replayCandles(full, series, eurusd, '15m', t('2026-01-06T20:17:00Z'));
    expect(out.at(-1)).toMatchObject({
      t: t('2026-01-06T20:15:00Z'),
      complete: false,
      sourceCount: 2,
    });
  });
});
