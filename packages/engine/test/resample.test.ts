import { describe, expect, it } from 'vitest';
import { getInstrument } from '../src/instruments/registry';
import { seriesFromRows, type CandleRow } from '../src/data/columnar';
import { bucketStart, resample } from '../src/data/resample';

// SYNTHETIC: every candle here is hand-written test data.
const t = (iso: string) => Date.parse(iso);
const MIN = 60_000;
const eurusd = getInstrument('EURUSD');

/** n consecutive synthetic 1m bars from iso; bar i has o=i, h=i+0.5, l=i-0.5, c=i+0.25, v=1. */
function minutes(iso: string, n: number, startValue = 1): CandleRow[] {
  return Array.from({ length: n }, (_, i) => ({
    t: t(iso) + i * MIN,
    o: startValue + i,
    h: startValue + i + 0.5,
    l: startValue + i - 0.5,
    c: startValue + i + 0.25,
    v: 1,
  }));
}

describe('bucketStart (daily close 17:00 America/New_York)', () => {
  it('aligns 15m buckets to the quarter hour', () => {
    expect(bucketStart(eurusd, '15m', t('2026-01-06T15:07:00Z'))).toBe(t('2026-01-06T15:00:00Z'));
    expect(bucketStart(eurusd, '15m', t('2026-01-06T15:15:00Z'))).toBe(t('2026-01-06T15:15:00Z'));
  });

  it('starts the trading day at 17:00 New York (22:00 UTC in winter)', () => {
    // Tuesday 2026-01-06 10:00 NY belongs to the day that began Monday 17:00 NY.
    expect(bucketStart(eurusd, '1D', t('2026-01-06T15:00:00Z'))).toBe(t('2026-01-05T22:00:00Z'));
    // 17:00 NY exactly starts a new day.
    expect(bucketStart(eurusd, '1D', t('2026-01-06T22:00:00Z'))).toBe(t('2026-01-06T22:00:00Z'));
  });

  it('moves the daily boundary to 21:00 UTC in summer (EDT)', () => {
    expect(bucketStart(eurusd, '1D', t('2026-07-07T20:59:00Z'))).toBe(t('2026-07-06T21:00:00Z'));
    expect(bucketStart(eurusd, '1D', t('2026-07-07T21:00:00Z'))).toBe(t('2026-07-07T21:00:00Z'));
  });

  it('aligns 4H buckets to 17, 21, 01, 05, 09, 13 New York time', () => {
    // 2026-01-06 09:30 NY → bucket 09:00 NY = 14:00 UTC
    expect(bucketStart(eurusd, '4h', t('2026-01-06T14:30:00Z'))).toBe(t('2026-01-06T14:00:00Z'));
    // 2026-01-06 12:59 NY → still 09:00 NY bucket
    expect(bucketStart(eurusd, '4h', t('2026-01-06T17:59:00Z'))).toBe(t('2026-01-06T14:00:00Z'));
    // 13:00 NY starts the next one
    expect(bucketStart(eurusd, '4h', t('2026-01-06T18:00:00Z'))).toBe(t('2026-01-06T18:00:00Z'));
  });

  it('starts weeks at Sunday 17:00 New York', () => {
    expect(bucketStart(eurusd, '1W', t('2026-01-07T12:00:00Z'))).toBe(t('2026-01-04T22:00:00Z'));
    expect(bucketStart(eurusd, '1W', t('2026-01-11T22:00:00Z'))).toBe(t('2026-01-11T22:00:00Z'));
  });

  it('handles the day New York falls back (25-hour trading day)', () => {
    // Day starting Sat 2026-10-31 17:00 EDT (21:00Z) ends Sun 2026-11-01 17:00 EST (22:00Z).
    expect(bucketStart(eurusd, '1D', t('2026-11-01T21:30:00Z'))).toBe(t('2026-10-31T21:00:00Z'));
    expect(bucketStart(eurusd, '1D', t('2026-11-01T22:00:00Z'))).toBe(t('2026-11-01T22:00:00Z'));
  });

  it('counts intraday buckets as elapsed time from the trading-day start', () => {
    // DST changes happen Sunday 02:00 NY while FX is closed, so on trading days this equals
    // wall-clock alignment. On the fall-back day (started Sat 17:00 EDT = 21:00Z) the buckets
    // are 21:00Z, 01:00Z, 05:00Z, … : 06:30Z falls into [05:00Z, 09:00Z).
    expect(bucketStart(eurusd, '4h', t('2026-11-01T06:30:00Z'))).toBe(t('2026-11-01T05:00:00Z'));
  });
});

describe('resample', () => {
  it('aggregates OHLCV correctly (open first, high max, low min, close last, volume sum)', () => {
    const base = seriesFromRows(minutes('2026-01-06T15:00:00Z', 15), true);
    const out = resample(base, eurusd, '15m', { asOf: t('2026-01-06T15:15:00Z') });
    expect(out).toEqual([
      {
        t: t('2026-01-06T15:00:00Z'),
        o: 1,
        h: 15.5,
        l: 0.5,
        c: 15.25,
        v: 15,
        sourceCount: 15,
        expectedCount: 15,
        complete: true,
      },
    ]);
  });

  it('marks missing minutes with sourceCount < expectedCount', () => {
    const rows = minutes('2026-01-06T15:00:00Z', 15).filter((_, i) => i !== 3 && i !== 4);
    const out = resample(seriesFromRows(rows, true), eurusd, '15m', {
      asOf: t('2026-01-06T16:00:00Z'),
    });
    expect(out[0]).toMatchObject({ sourceCount: 13, expectedCount: 15, complete: true });
  });

  it('does not invent candles for empty periods', () => {
    const rows = [...minutes('2026-01-06T15:00:00Z', 2), ...minutes('2026-01-06T16:00:00Z', 2)];
    const out = resample(seriesFromRows(rows, true), eurusd, '15m', {
      asOf: t('2026-01-06T17:00:00Z'),
    });
    expect(out.map((c) => c.t)).toEqual([t('2026-01-06T15:00:00Z'), t('2026-01-06T16:00:00Z')]);
  });

  it('flags the last bucket as incomplete if it has not closed yet at asOf', () => {
    const base = seriesFromRows(minutes('2026-01-06T15:00:00Z', 20), true);
    const out = resample(base, eurusd, '15m', { asOf: t('2026-01-06T15:20:00Z') });
    expect(out.map((c) => c.complete)).toEqual([true, false]);
  });

  it('expects only market-open minutes (gold daily break is not "missing")', () => {
    const xau = getInstrument('XAUUSD');
    // Tue 2026-01-06: 21:00-21:59Z trades, 22:00-22:59Z is the 17-18 NY break, 23:00Z reopens.
    // The trading day starting 22:00Z sees the 60 bars from 23:00Z.
    const rows = [
      ...minutes('2026-01-06T21:00:00Z', 60, 2650),
      ...minutes('2026-01-06T23:00:00Z', 60, 2650),
    ];
    const out = resample(seriesFromRows(rows, true), xau, '1D', {
      asOf: t('2026-01-08T00:00:00Z'),
    });
    const today = out.find((c) => c.t === t('2026-01-06T22:00:00Z'))!;
    // The 1D bucket from Tue 17:00 NY to Wed 17:00 NY: 23h of trading = 1380 minutes expected.
    expect(today).toMatchObject({ sourceCount: 60, expectedCount: 1380 });
  });

  it('gives the same 1h candles from 1m directly and via 15m', () => {
    const base = seriesFromRows(minutes('2026-01-06T15:00:00Z', 120), true);
    const asOf = t('2026-01-06T17:00:00Z');
    const direct = resample(base, eurusd, '1h', { asOf });
    const via15 = resample(base, eurusd, '15m', { asOf });
    const rebuilt = resample(
      seriesFromRows(
        via15.map(({ t: tt, o, h, l, c, v }) => ({ t: tt, o, h, l, c, v: v ?? 0 })),
        true,
      ),
      eurusd,
      '1h',
      { asOf },
    );
    expect(rebuilt.map(({ t: a, o, h, l, c, v }) => ({ a, o, h, l, c, v }))).toEqual(
      direct.map(({ t: a, o, h, l, c, v }) => ({ a, o, h, l, c, v })),
    );
  });

  it('builds daily candles on the 17:00 New York boundary', () => {
    // Bars at Tue 16:59 NY (21:59Z) and Tue 17:00 NY (22:00Z) fall in different days.
    const rows = [...minutes('2026-01-06T21:59:00Z', 2)];
    const out = resample(seriesFromRows(rows, true), eurusd, '1D', {
      asOf: t('2026-01-08T00:00:00Z'),
    });
    expect(out.map((c) => c.t)).toEqual([t('2026-01-05T22:00:00Z'), t('2026-01-06T22:00:00Z')]);
  });

  it('returns the base candles unchanged in shape for the base timeframe', () => {
    const base = seriesFromRows(minutes('2026-01-06T15:00:00Z', 3), false);
    const out = resample(base, eurusd, '1m', { asOf: t('2026-01-06T15:03:00Z') });
    expect(out).toHaveLength(3);
    expect(out[0]).toEqual({
      t: t('2026-01-06T15:00:00Z'),
      o: 1,
      h: 1.5,
      l: 0.5,
      c: 1.25,
      sourceCount: 1,
      expectedCount: 1,
      complete: true,
    });
  });
});
