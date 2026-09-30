import { describe, expect, it } from 'vitest';
import { getInstrument } from '../src/instruments/registry';
import { resolveTimes, validateRecords, type TimedRecord } from '../src/data/validate';
import type { RawRecord } from '../src/data/csv-rows';

// SYNTHETIC: every record in this file is hand-written test data, not market data.
const t = (iso: string) => Date.parse(iso);
const MIN = 60_000;
const eurusd = getInstrument('EURUSD');
const xauusd = getInstrument('XAUUSD');

function bar(row: number, iso: string, o = 1.085, h = 1.0852, l = 1.0849, c = 1.0851): TimedRecord {
  return { row, t: t(iso), o, h, l, c };
}

/** n consecutive 1m bars starting at iso. */
function run(startRow: number, iso: string, n: number): TimedRecord[] {
  return Array.from({ length: n }, (_, i) => ({ ...bar(startRow + i, iso), t: t(iso) + i * MIN }));
}

describe('validateRecords', () => {
  it('reports nothing for clean, contiguous 1m data', () => {
    const report = validateRecords(run(1, '2026-01-06T15:00:00Z', 10), eurusd);
    expect(report).toMatchObject({
      inferredTimeframe: '1m',
      recordCount: 10,
      duplicates: [],
      outOfOrder: [],
      gaps: [],
      closedMarketGaps: 0,
      closedMarketCandles: [],
      nonPositive: [],
      ohlcInconsistent: [],
      precisionOverflow: [],
    });
  });

  it('separates identical duplicates from conflicting ones', () => {
    const records = [
      bar(1, '2026-01-06T15:00:00Z'),
      bar(2, '2026-01-06T15:01:00Z'),
      bar(3, '2026-01-06T15:01:00Z'),
      bar(4, '2026-01-06T15:02:00Z'),
      bar(5, '2026-01-06T15:02:00Z', 1.085, 1.0853),
    ];
    expect(validateRecords(records, eurusd).duplicates).toEqual([
      { t: t('2026-01-06T15:01:00Z'), identical: true, rows: [2, 3] },
      { t: t('2026-01-06T15:02:00Z'), identical: false, rows: [4, 5] },
    ]);
  });

  it('reports rows that go back in time', () => {
    const records = [
      bar(1, '2026-01-06T15:00:00Z'),
      bar(2, '2026-01-06T15:02:00Z'),
      bar(3, '2026-01-06T15:01:00Z'),
      bar(4, '2026-01-06T15:03:00Z'),
    ];
    expect(validateRecords(records, eurusd).outOfOrder).toEqual([
      { row: 3, t: t('2026-01-06T15:01:00Z') },
    ]);
  });

  it('reports missing bars during trading hours', () => {
    // Tuesday 10:00-10:02 NY, then nothing until 10:06: 10:03, 10:04, 10:05 are missing.
    const records = [...run(1, '2026-01-06T15:00:00Z', 3), ...run(4, '2026-01-06T15:06:00Z', 2)];
    const report = validateRecords(records, eurusd);
    expect(report.gaps).toEqual([
      { from: t('2026-01-06T15:02:00Z'), to: t('2026-01-06T15:06:00Z'), missingBars: 3 },
    ]);
  });

  it('counts the weekend as an expected gap, not a problem', () => {
    // Last bar Friday 16:59 NY, next bar Sunday 17:00 NY.
    const records = [
      bar(1, '2026-01-09T21:58:00Z'),
      bar(2, '2026-01-09T21:59:00Z'),
      bar(3, '2026-01-11T22:00:00Z'),
    ];
    const report = validateRecords(records, eurusd);
    expect(report.gaps).toEqual([]);
    expect(report.closedMarketGaps).toBe(1);
  });

  it('counts the gold daily break as an expected gap', () => {
    // Tuesday 16:58, 16:59 NY then 18:00 NY.
    const records = [
      bar(1, '2026-01-06T21:58:00Z', 2650, 2651, 2649, 2650.5),
      bar(2, '2026-01-06T21:59:00Z', 2650, 2651, 2649, 2650.5),
      bar(3, '2026-01-06T23:00:00Z', 2650, 2651, 2649, 2650.5),
    ];
    const report = validateRecords(records, xauusd);
    expect(report.gaps).toEqual([]);
    expect(report.closedMarketGaps).toBe(1);
  });

  it('reports candles that exist while the market is closed', () => {
    const records = [
      bar(1, '2026-01-09T21:59:00Z'),
      bar(2, '2026-01-10T12:00:00Z'), // Saturday
    ];
    expect(validateRecords(records, eurusd).closedMarketCandles).toEqual([
      { row: 2, t: t('2026-01-10T12:00:00Z'), reason: 'WEEKEND' },
    ]);
  });

  it('reports zero or negative prices', () => {
    const records = [bar(1, '2026-01-06T15:00:00Z', 0, 1.0852, -1, 1.0851)];
    expect(validateRecords(records, eurusd).nonPositive).toEqual([
      { row: 1, field: 'o' },
      { row: 1, field: 'l' },
    ]);
  });

  it('reports OHLC values that contradict each other', () => {
    const records = [
      bar(1, '2026-01-06T15:00:00Z', 1.085, 1.0852, 1.0849, 1.0851), // fine
      bar(2, '2026-01-06T15:01:00Z', 1.0855, 1.0852, 1.0849, 1.0851), // open above high
      bar(3, '2026-01-06T15:02:00Z', 1.085, 1.0852, 1.0849, 1.0848), // close below low
      bar(4, '2026-01-06T15:03:00Z', 1.085, 1.0848, 1.0849, 1.085), // high below low
    ];
    expect(validateRecords(records, eurusd).ohlcInconsistent.map((x) => x.row)).toEqual([2, 3, 4]);
  });

  it('reports prices finer than the instrument tick', () => {
    const records = [bar(1, '2026-01-06T15:00:00Z', 1.085001)];
    expect(validateRecords(records, eurusd).precisionOverflow).toEqual([{ row: 1 }]);
  });

  it('infers 15m bars', () => {
    const records = [0, 15, 30, 45].map((m, i) => ({
      ...bar(i + 1, '2026-01-06T15:00:00Z'),
      t: t('2026-01-06T15:00:00Z') + m * MIN,
    }));
    expect(validateRecords(records, eurusd).inferredTimeframe).toBe('15m');
  });

  it('never modifies its input', () => {
    const records = Object.freeze(
      [bar(2, '2026-01-06T15:01:00Z'), bar(1, '2026-01-06T15:00:00Z')].map((r) => Object.freeze(r)),
    );
    expect(() => validateRecords(records, eurusd)).not.toThrow();
    expect(records.map((r) => r.row)).toEqual([2, 1]);
  });
});

describe('resolveTimes', () => {
  const raw = (row: number, hour: number, minute: number, day = 25, month = 10): RawRecord => ({
    row,
    time: { kind: 'LOCAL', local: { year: 2026, month, day, hour, minute, second: 0 } },
    o: 1,
    h: 1,
    l: 1,
    c: 1,
  });

  it('converts local wall times from the source time zone to UTC', () => {
    const { records, dstIssues } = resolveTimes([raw(1, 12, 0, 6, 1)], 'Europe/London');
    expect(dstIssues).toEqual([]);
    expect(records).toEqual([{ row: 1, t: t('2026-01-06T12:00:00Z'), o: 1, h: 1, l: 1, c: 1 }]);
  });

  it('reports ambiguous and nonexistent local times instead of guessing', () => {
    const { records, dstIssues } = resolveTimes(
      [raw(1, 1, 30), raw(2, 1, 30, 29, 3)],
      'Europe/London',
    );
    expect(records).toEqual([]);
    expect(dstIssues).toEqual([
      { row: 1, local: '2026-10-25 01:30', kind: 'AMBIGUOUS' },
      { row: 2, local: '2026-03-29 01:30', kind: 'NONEXISTENT' },
    ]);
  });

  it('passes UTC timestamps through untouched', () => {
    const rec: RawRecord = {
      row: 1,
      time: { kind: 'UTC', utc: 123 },
      o: 1,
      h: 1,
      l: 1,
      c: 1,
      v: 5,
    };
    expect(resolveTimes([rec], 'Europe/London').records).toEqual([
      { row: 1, t: 123, o: 1, h: 1, l: 1, c: 1, v: 5 },
    ]);
  });
});
