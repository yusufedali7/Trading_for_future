import { describe, expect, it } from 'vitest';
import { ImportSession } from '../src/import/session';

// SYNTHETIC: hand-written CSV text, not market data.
const CLEAN = [
  'Gmt time,Open,High,Low,Close,Volume',
  '06.01.2026 15:00:00.000,1.08500,1.08520,1.08490,1.08510,1',
  '06.01.2026 15:01:00.000,1.08510,1.08530,1.08505,1.08525,2',
  '06.01.2026 15:02:00.000,1.08525,1.08540,1.08515,1.08520,3',
].join('\r\n');

describe('ImportSession', () => {
  it('reads the file, previews the first rows and guesses the layout', () => {
    const s = new ImportSession();
    const r = s.read(CLEAN, 'SYNTHETIC_clean.csv');
    expect(r.totalRows).toBe(4);
    expect(r.preview[0]).toEqual(['Gmt time', 'Open', 'High', 'Low', 'Close', 'Volume']);
    expect(r.guess).toMatchObject({
      hasHeader: true,
      dateFormat: 'dd.MM.yyyy HH:mm:ss.SSS',
      volume: 5,
    });
  });

  it('handles semicolon-separated files', () => {
    const s = new ImportSession();
    const r = s.read(CLEAN.replaceAll(',', ';'), 'SYNTHETIC_semicolon.csv');
    expect(r.preview[1]).toEqual([
      '06.01.2026 15:00:00.000',
      '1.08500',
      '1.08520',
      '1.08490',
      '1.08510',
      '1',
    ]);
  });

  it('summarises a clean file as needing no fixes', () => {
    const s = new ImportSession();
    const { guess } = s.read(CLEAN, 'SYNTHETIC_clean.csv');
    const a = s.analyze(guess!, 'UTC', 'EURUSD');
    expect(a).toMatchObject({
      recordCount: 3,
      inferredTimeframe: '1m',
      required: [],
      blockers: [],
      range: { from: Date.parse('2026-01-06T15:00:00Z'), to: Date.parse('2026-01-06T15:02:00Z') },
    });
  });

  it('lists the largest gaps first so real holes are not hidden behind one-minute gaps', () => {
    const lines = ['Gmt time,Open,High,Low,Close,Volume'];
    // 15:00-15:09 continuous; then a 1-bar gap; then a 20-bar gap.
    const m = (min: number) =>
      `06.01.2026 ${String(15 + Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}:00.000,1.085,1.0852,1.0849,1.0851,1`;
    for (let i = 0; i < 10; i++) lines.push(m(i));
    lines.push(m(11), m(32), m(33));
    const s = new ImportSession();
    const { guess } = s.read(lines.join('\n'), 'SYNTHETIC_gaps.csv');
    const a = s.analyze(guess!, 'UTC', 'EURUSD');
    expect(a.samples.gaps.map((g) => g.missingBars)).toEqual([20, 1]);
  });

  it('caps issue samples but keeps exact counts', () => {
    const lines = ['Gmt time,Open,High,Low,Close,Volume'];
    for (let i = 0; i < 30; i++)
      lines.push(`06.01.2026 15:${String(i).padStart(2, '0')}:00.000,abc,1,1,1,1`);
    const s = new ImportSession();
    const { guess } = s.read(lines.join('\n'), 'SYNTHETIC_bad.csv');
    const a = s.analyze(guess!, 'UTC', 'EURUSD');
    expect(a.counts.parseErrors).toBe(30);
    expect(a.samples.parseErrors).toHaveLength(20);
    expect(a.blockers).toEqual([{ kind: 'NO_DATA' }]);
  });

  it('finishes with the accepted fixes and returns the series plus full report', () => {
    const s = new ImportSession();
    const text = CLEAN.split('\r\n');
    [text[1], text[2]] = [text[2]!, text[1]!];
    const { guess } = s.read(text.join('\n'), 'SYNTHETIC_unsorted.csv');
    const a = s.analyze(guess!, 'UTC', 'EURUSD');
    expect(a.required).toEqual(['SORT_BY_TIME']);
    expect(() => s.finish([])).toThrow(/SORT_BY_TIME/);
    const done = s.finish(['SORT_BY_TIME']);
    expect(done.applied).toEqual(['SORT_BY_TIME']);
    expect(done.series.length).toBe(3);
    expect(done.validation.outOfOrder).toHaveLength(1);
  });

  it('refuses to finish before analyzing', () => {
    expect(() => new ImportSession().finish([])).toThrow(/analy/i);
  });
});
