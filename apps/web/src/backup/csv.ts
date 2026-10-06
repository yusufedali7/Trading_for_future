import type { BacktestTrade, IanaTz, JournalEntry } from '@trw/engine';
import { formatTime } from '../format';
import { tr } from '../i18n/tr';

/** Byte order mark: tells spreadsheets the file is UTF-8 (Turkish letters). */
export const BOM = String.fromCharCode(0xfeff);

export type Cell = string | number | boolean | null | undefined;

/**
 * CSV for a Turkish-locale spreadsheet (assumption, D43): `;` separator, decimal comma, UTF-8 BOM
 * so Turkish letters show, CRLF lines. Text that a spreadsheet would run as a formula
 * (= + - @ at the start) gets a leading apostrophe.
 */
export function toCsv(rows: readonly (readonly Cell[])[]): string {
  const cell = (v: Cell): string => {
    if (v === null || v === undefined) return '';
    if (typeof v === 'boolean') return v ? tr.backup.csvYes : tr.backup.csvNo;
    if (typeof v === 'number') return Number.isFinite(v) ? String(v).replace('.', ',') : '';
    const text = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
    return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return BOM + rows.map((r) => r.map(cell).join(';')).join('\r\n') + '\r\n';
}

const t = tr.backup.columns;

export function journalCsv(entries: readonly JournalEntry[], tz: IanaTz): string {
  return toCsv([
    [
      t.decidedAt(tz),
      t.instrument,
      t.timeframe,
      t.decision,
      t.sessions,
      t.strategy,
      t.reason,
      t.emotion,
      t.intensity,
      t.r,
      t.exit,
      t.mae,
      t.mfe,
      t.lesson,
      t.tags,
    ],
    ...entries.map((e) => [
      formatTime(e.decidedAt, tz),
      e.instrument,
      e.timeframe,
      tr.journal.decisions[e.decision],
      e.sessions.join(', '),
      e.strategy,
      e.reason,
      tr.journal.emotions[e.emotion],
      e.emotionIntensity,
      e.result?.r,
      e.result?.exitReason,
      e.result?.maeR,
      e.result?.mfeR,
      e.lesson,
      e.tags.join(', '),
    ]),
  ]);
}

export function backtestTradesCsv(trades: readonly BacktestTrade[], tz: IanaTz): string {
  return toCsv([
    [
      t.signalAt(tz),
      t.direction,
      t.orderType,
      t.entryAt,
      t.entry,
      t.stop,
      t.target,
      t.exitAt,
      t.exitPrice,
      t.exit,
      t.lots,
      t.r,
      t.pnl,
      t.commission,
      t.mae,
      t.mfe,
      t.bars,
      t.ambiguous,
    ],
    ...trades.map((x) => [
      formatTime(x.signalAt, tz),
      x.order.direction,
      x.order.type,
      formatTime(x.entryAt, tz),
      x.entryPrice,
      x.order.stop,
      x.order.target,
      formatTime(x.exitAt, tz),
      x.exitPrice,
      x.exit,
      x.lots,
      x.r,
      x.pnl,
      x.commission,
      x.maeR,
      x.mfeR,
      x.barsHeld,
      x.ambiguous,
    ]),
  ]);
}
