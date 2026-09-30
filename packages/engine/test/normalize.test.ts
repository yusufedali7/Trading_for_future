import { describe, expect, it } from 'vitest';
import { getInstrument } from '../src/instruments/registry';
import { analyzeImport, normalize, requiredFixes, type CsvMapping } from '../src/index';
import { fixtureRows } from './helpers/csv';

// SYNTHETIC: all rows in this file are hand-written test data.
const eurusd = getInstrument('EURUSD');
const mapping: CsvMapping = {
  hasHeader: true,
  time: { kind: 'SINGLE', column: 0 },
  dateFormat: 'dd.MM.yyyy HH:mm:ss.SSS',
  open: 1,
  high: 2,
  low: 3,
  close: 4,
  volume: 5,
};
const HEADER = ['Gmt time', 'Open', 'High', 'Low', 'Close', 'Volume'];
const row = (time: string, o = '1.08500', h = '1.08520', l = '1.08490', c = '1.08510', v = '1') => [
  `06.01.2026 ${time}:00.000`,
  o,
  h,
  l,
  c,
  v,
];
const analyze = (rows: string[][]) => analyzeImport([HEADER, ...rows], mapping, 'UTC', eurusd);

describe('clean import', () => {
  const analysis = analyzeImport(
    fixtureRows('SYNTHETIC_eurusd_1m_small.csv'),
    mapping,
    'UTC',
    eurusd,
  );

  it('needs no fixes', () => {
    expect(requiredFixes(analysis)).toEqual({ fixes: [], blockers: [] });
  });

  it('produces a columnar UTC series', () => {
    const { series, applied } = normalize(analysis, eurusd, []);
    expect(applied).toEqual([]);
    expect(series.length).toBe(3);
    expect(Array.from(series.t)).toEqual([
      Date.parse('2026-01-05T00:00:00Z'),
      Date.parse('2026-01-05T00:01:00Z'),
      Date.parse('2026-01-05T00:02:00Z'),
    ]);
    expect(Array.from(series.c)).toEqual([1.0851, 1.08525, 1.0852]);
    expect(Array.from(series.v!)).toEqual([120.5, 98.25, 110]);
  });

  it('gives the same content hash for the same data', () => {
    const a = normalize(analysis, eurusd, []).series;
    const b = normalize(
      analyzeImport(fixtureRows('SYNTHETIC_eurusd_1m_small.csv'), mapping, 'UTC', eurusd),
      eurusd,
      [],
    ).series;
    expect(a.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(b.contentHash).toBe(a.contentHash);
  });

  it('changes the hash when a single price changes', () => {
    const rows = fixtureRows('SYNTHETIC_eurusd_1m_small.csv');
    const base = normalize(analyzeImport(rows, mapping, 'UTC', eurusd), eurusd, []).series;
    const edited = rows.map((r) => [...r]);
    edited[2]![4] = '1.08526';
    const changed = normalize(analyzeImport(edited, mapping, 'UTC', eurusd), eurusd, []).series;
    expect(changed.contentHash).not.toBe(base.contentHash);
  });
});

describe('fixes are explicit and recorded', () => {
  it('requires SORT_BY_TIME for out-of-order rows', () => {
    const a = analyze([row('10:01'), row('10:00')]);
    expect(requiredFixes(a).fixes).toEqual(['SORT_BY_TIME']);
    expect(() => normalize(a, eurusd, [])).toThrow(/SORT_BY_TIME/);
    const { series, applied } = normalize(a, eurusd, ['SORT_BY_TIME']);
    expect(applied).toEqual(['SORT_BY_TIME']);
    expect(series.t[0]).toBeLessThan(series.t[1]!);
  });

  it('requires DROP_IDENTICAL_DUPLICATES and keeps one copy', () => {
    const a = analyze([row('10:00'), row('10:00'), row('10:01')]);
    expect(requiredFixes(a).fixes).toEqual(['DROP_IDENTICAL_DUPLICATES']);
    const { series } = normalize(a, eurusd, ['DROP_IDENTICAL_DUPLICATES']);
    expect(series.length).toBe(2);
  });

  it('blocks conflicting duplicates: no fix can choose the right row', () => {
    const a = analyze([row('10:00'), row('10:00', '1.08501')]);
    expect(requiredFixes(a).blockers).toEqual([{ kind: 'CONFLICTING_DUPLICATES', count: 1 }]);
    expect(() => normalize(a, eurusd, ['DROP_IDENTICAL_DUPLICATES'])).toThrow(/CONFLICTING/);
  });

  it('requires SKIP_UNPARSEABLE_ROWS when some rows could not be read', () => {
    const a = analyze([row('10:00'), row('10:01', 'abc')]);
    expect(requiredFixes(a).fixes).toEqual(['SKIP_UNPARSEABLE_ROWS']);
    expect(normalize(a, eurusd, ['SKIP_UNPARSEABLE_ROWS']).series.length).toBe(1);
  });

  it('requires SKIP_DST_ROWS for local times that are ambiguous or never existed', () => {
    const rows = [
      ['25.10.2026 00:59:00.000', '1.085', '1.085', '1.085', '1.085', '1'],
      ['25.10.2026 01:30:00.000', '1.085', '1.085', '1.085', '1.085', '1'],
    ];
    const a = analyzeImport([HEADER, ...rows], mapping, 'Europe/London', eurusd);
    expect(requiredFixes(a).fixes).toContain('SKIP_DST_ROWS');
  });

  it('requires DROP_CLOSED_MARKET_CANDLES for weekend bars', () => {
    const rows = [
      row('10:00'),
      ['10.01.2026 12:00:00.000', '1.085', '1.085', '1.085', '1.085', '0'],
    ];
    const a = analyze(rows);
    expect(requiredFixes(a).fixes).toEqual(['DROP_CLOSED_MARKET_CANDLES']);
    expect(normalize(a, eurusd, ['DROP_CLOSED_MARKET_CANDLES']).series.length).toBe(1);
  });

  it('requires DROP_INVALID_PRICES for impossible OHLC or non-positive prices', () => {
    const a = analyze([row('10:00'), row('10:01', '1.09000'), row('10:02', '0')]);
    expect(requiredFixes(a).fixes).toEqual(['DROP_INVALID_PRICES']);
    expect(normalize(a, eurusd, ['DROP_INVALID_PRICES']).series.length).toBe(1);
  });

  it('requires ROUND_TO_TICK for prices finer than the tick', () => {
    const a = analyze([row('10:00', '1.085004')]);
    expect(requiredFixes(a).fixes).toEqual(['ROUND_TO_TICK']);
    expect(normalize(a, eurusd, ['ROUND_TO_TICK']).series.o[0]).toBe(1.085);
  });

  it('does not record fixes that were accepted but not needed', () => {
    const a = analyze([row('10:00')]);
    expect(normalize(a, eurusd, ['SORT_BY_TIME', 'ROUND_TO_TICK']).applied).toEqual([]);
  });

  it('does not treat gaps as something to fix', () => {
    // 10:00 and 10:01 establish 1m bars; 10:02-10:04 are missing.
    const a = analyze([row('10:00'), row('10:01'), row('10:05')]);
    expect(a.validation.gaps).toHaveLength(1);
    expect(requiredFixes(a)).toEqual({ fixes: [], blockers: [] });
  });
});
