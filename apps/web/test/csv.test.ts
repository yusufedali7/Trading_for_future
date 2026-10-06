import { describe, expect, it } from 'vitest';
import type { JournalEntry } from '@trw/engine';
import { BOM, journalCsv, toCsv } from '../src/backup/csv';

describe('CSV for a Turkish spreadsheet', () => {
  it('uses a BOM, semicolons, decimal commas and CRLF', () => {
    expect(BOM.charCodeAt(0)).toBe(0xfeff);
    expect(toCsv([['a', 1.5, -0.25, true, null]])).toBe(BOM + 'a;1,5;-0,25;evet;\r\n');
  });

  it('quotes separators, quotes and line breaks', () => {
    expect(toCsv([['x;y', 'say "hi"', 'iki\nsatır']])).toBe(
      BOM + '"x;y";"say ""hi""";"iki\nsatır"\r\n',
    );
  });

  it('defuses text a spreadsheet would run as a formula', () => {
    expect(toCsv([['=HYPERLINK("x")', '+1', '-test', '@a', 'ok']])).toBe(
      BOM + '"\'=HYPERLINK(""x"")";\'+1;\'-test;\'@a;ok\r\n',
    );
  });

  it('writes journal entries with labels and the display time zone', () => {
    // SYNTHETIC entry.
    const e = {
      id: 'j1',
      instrument: 'EURUSD',
      decision: 'LONG',
      decidedAt: Date.parse('2026-01-06T10:00:00Z'),
      timeframe: '15m',
      sessions: ['LONDON'],
      tradeId: 't1',
      result: { r: 1.25, exitReason: 'TP', maeR: -0.3, mfeR: 2, durationMs: 1, ambiguous: false },
      strategy: '',
      reason: 'Süpürme sonrası',
      emotion: 'CALM',
      emotionIntensity: 2,
      lesson: '',
      tags: ['a', 'b'],
      screenshotIds: [],
      createdAt: 1,
      updatedAt: 1,
    } as JournalEntry;
    const [head, row] = journalCsv([e], 'Europe/Istanbul').slice(1).split('\r\n');
    expect(head!.split(';')[0]).toBe('Karar zamanı (Europe/Istanbul)');
    expect(row).toBe(
      '2026-01-06 13:00;EURUSD;15m;Long;LONDON;;Süpürme sonrası;Sakin;2;1,25;TP;-0,3;2;;a, b',
    );
  });
});
