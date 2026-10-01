import { describe, expect, it } from 'vitest';
import { guessMapping, parseCsvRows, parseDate, type CsvMapping } from '../src/data/csv-rows';
import { fixtureRows } from './helpers/csv';

const dukascopyLike: CsvMapping = {
  hasHeader: true,
  time: { kind: 'SINGLE', column: 0 },
  dateFormat: 'dd.MM.yyyy HH:mm:ss.SSS',
  open: 1,
  high: 2,
  low: 3,
  close: 4,
  volume: 5,
};

describe('parseCsvRows', () => {
  it('parses a header + single datetime column file', () => {
    const { records, errors } = parseCsvRows(
      fixtureRows('SYNTHETIC_eurusd_1m_small.csv'),
      dukascopyLike,
    );
    expect(errors).toEqual([]);
    expect(records).toHaveLength(3);
    expect(records[0]).toEqual({
      row: 2,
      time: {
        kind: 'LOCAL',
        local: { year: 2026, month: 1, day: 5, hour: 0, minute: 0, second: 0 },
      },
      o: 1.085,
      h: 1.0852,
      l: 1.0849,
      c: 1.0851,
      v: 120.5,
    });
    expect(records[1]?.time).toEqual({
      kind: 'LOCAL',
      local: { year: 2026, month: 1, day: 5, hour: 0, minute: 1, second: 0 },
    });
  });

  it('joins separate date and time columns (MetaTrader style)', () => {
    const rows = [['2026.01.05', '17:05', '1.1', '1.2', '1.0', '1.15', '10']];
    const { records, errors } = parseCsvRows(rows, {
      hasHeader: false,
      time: { kind: 'DATE_AND_TIME', dateColumn: 0, timeColumn: 1 },
      dateFormat: 'yyyy.MM.dd HH:mm',
      open: 2,
      high: 3,
      low: 4,
      close: 5,
      volume: 6,
    });
    expect(errors).toEqual([]);
    expect(records[0]).toMatchObject({
      row: 1,
      time: {
        kind: 'LOCAL',
        local: { year: 2026, month: 1, day: 5, hour: 17, minute: 5, second: 0 },
      },
    });
  });

  it('reads unix millisecond timestamps as UTC instants', () => {
    const rows = [['1767571200000', '1', '2', '0.5', '1.5']];
    const { records } = parseCsvRows(rows, {
      hasHeader: false,
      time: { kind: 'SINGLE', column: 0 },
      dateFormat: 'UNIX_MS',
      open: 1,
      high: 2,
      low: 3,
      close: 4,
    });
    expect(records[0]).toEqual({
      row: 1,
      time: { kind: 'UTC', utc: 1767571200000 },
      o: 1,
      h: 2,
      l: 0.5,
      c: 1.5,
    });
  });

  it('skips blank lines without reporting them', () => {
    const rows = [...fixtureRows('SYNTHETIC_eurusd_1m_small.csv'), [''], []];
    const { records, errors } = parseCsvRows(rows, dukascopyLike);
    expect(records).toHaveLength(3);
    expect(errors).toEqual([]);
  });

  it('reports bad rows with their line number instead of guessing', () => {
    const rows = [
      ['Gmt time', 'Open', 'High', 'Low', 'Close', 'Volume'],
      ['05.01.2026 00:00:00.000', '1,0850', '1.0852', '1.0849', '1.0851', '1'],
      ['05.01.2026 00:01:00.000', 'abc', '1.0852', '1.0849', '1.0851', '1'],
      ['2026-01-05 00:02', '1.0850', '1.0852', '1.0849', '1.0851', '1'],
      ['05.01.2026 00:03:00.000', '1.0850'],
      ['31.02.2026 00:04:00.000', '1.0850', '1.0852', '1.0849', '1.0851', '1'],
    ];
    const { records, errors } = parseCsvRows(rows, dukascopyLike);
    expect(records).toEqual([]);
    expect(errors).toEqual([
      { row: 2, reason: 'DECIMAL_COMMA', column: 1, value: '1,0850' },
      { row: 3, reason: 'NOT_A_NUMBER', column: 1, value: 'abc' },
      { row: 4, reason: 'BAD_DATE', column: 0, value: '2026-01-05 00:02' },
      { row: 5, reason: 'MISSING_COLUMN', column: 2, value: '' },
      { row: 6, reason: 'BAD_DATE', column: 0, value: '31.02.2026 00:04:00.000' },
    ]);
  });
});

describe('guessMapping', () => {
  it('recognises a Dukascopy-style header and date format', () => {
    const rows = fixtureRows('SYNTHETIC_eurusd_1m_small.csv');
    expect(guessMapping(rows)).toEqual(dukascopyLike);
  });

  it('recognises headerless MetaTrader rows', () => {
    const rows = [['2026.01.05', '17:05', '1.1', '1.2', '1.0', '1.15', '10']];
    expect(guessMapping(rows)).toEqual({
      hasHeader: false,
      time: { kind: 'DATE_AND_TIME', dateColumn: 0, timeColumn: 1 },
      dateFormat: 'yyyy.MM.dd HH:mm',
      open: 2,
      high: 3,
      low: 4,
      close: 5,
      volume: 6,
    });
  });

  it('returns null when it cannot recognise the layout', () => {
    expect(guessMapping([['hello', 'world']])).toBeNull();
  });
});

describe('ISO 8601 timestamps (Dukascopy web export layout)', () => {
  it('guesses the layout from an "Etc/UTC" header and ISO dates', () => {
    expect(guessMapping(fixtureRows('SYNTHETIC_dukascopy_iso.csv'))).toEqual({
      hasHeader: true,
      time: { kind: 'SINGLE', column: 0 },
      dateFormat: 'ISO_8601',
      open: 1,
      high: 2,
      low: 3,
      close: 4,
      volume: 5,
    });
  });

  it('reads the explicit offset as an exact UTC instant', () => {
    const rows = fixtureRows('SYNTHETIC_dukascopy_iso.csv');
    const { records, errors } = parseCsvRows(rows, guessMapping(rows)!);
    expect(errors).toEqual([]);
    expect(records[0]!.time).toEqual({ kind: 'UTC', utc: Date.parse('2026-01-06T15:00:00Z') });
  });

  it('applies non-zero offsets and Z', () => {
    expect(parseDate('2026-01-06T17:00:00+02:00', 'ISO_8601')).toEqual({
      kind: 'UTC',
      utc: Date.parse('2026-01-06T15:00:00Z'),
    });
    expect(parseDate('2026-01-06T15:00:00Z', 'ISO_8601')).toEqual({
      kind: 'UTC',
      utc: Date.parse('2026-01-06T15:00:00Z'),
    });
  });

  it('rejects ISO dates without an offset or with impossible values', () => {
    expect(parseDate('2026-01-06T15:00:00', 'ISO_8601')).toBeNull();
    expect(parseDate('2026-02-30T15:00:00+00:00', 'ISO_8601')).toBeNull();
    expect(parseDate('2026-01-06T15:00:00.500+00:00', 'ISO_8601')).toBeNull();
  });
});
