import type { LocalDateTime } from '../core/tz';
import type { UtcMs } from '../core/types';

/**
 * Pattern tokens: yyyy MM dd HH mm ss SSS; anything else is a literal.
 * UNIX_MS / UNIX_S read epoch timestamps (already UTC).
 */
export type DateFormat = string;

export type TimeColumns =
  | { kind: 'SINGLE'; column: number }
  | { kind: 'DATE_AND_TIME'; dateColumn: number; timeColumn: number };

export interface CsvMapping {
  hasHeader: boolean;
  time: TimeColumns;
  dateFormat: DateFormat;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export type RecordTime = { kind: 'LOCAL'; local: LocalDateTime } | { kind: 'UTC'; utc: UtcMs };

export interface RawRecord {
  /** 1-based index into the rows given to the parser (line number in the file). */
  row: number;
  time: RecordTime;
  o: number;
  h: number;
  l: number;
  c: number;
  v?: number;
}

export type ParseErrorReason = 'MISSING_COLUMN' | 'NOT_A_NUMBER' | 'DECIMAL_COMMA' | 'BAD_DATE';

export interface ParseError {
  row: number;
  reason: ParseErrorReason;
  column: number;
  value: string;
}

export const KNOWN_DATE_FORMATS: readonly DateFormat[] = [
  'dd.MM.yyyy HH:mm:ss.SSS',
  'dd.MM.yyyy HH:mm:ss',
  'dd.MM.yyyy HH:mm',
  'yyyy.MM.dd HH:mm:ss',
  'yyyy.MM.dd HH:mm',
  'yyyy-MM-dd HH:mm:ss.SSS',
  'yyyy-MM-dd HH:mm:ss',
  'yyyy-MM-dd HH:mm',
  'yyyyMMdd HHmmss',
  'ISO_8601',
  'UNIX_MS',
  'UNIX_S',
];

/** ISO 8601 with a mandatory offset, e.g. 2026-10-01T00:00:00+00:00 (Dukascopy web export). */
const ISO_RE =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|([+-])(\d{2}):?(\d{2}))$/;

function parseIso(v: string): RecordTime | null {
  const m = ISO_RE.exec(v);
  if (!m) return null;
  if (Number(m[7] ?? 0) !== 0) return null; // bar data has whole-second times
  const local: LocalDateTime = {
    year: Number(m[1]),
    month: Number(m[2]),
    day: Number(m[3]),
    hour: Number(m[4]),
    minute: Number(m[5]),
    second: Number(m[6] ?? 0),
  };
  if (!isValidCalendar(local)) return null;
  const offsetMin =
    m[8] === 'Z' ? 0 : (m[9] === '-' ? -1 : 1) * (Number(m[10]) * 60 + Number(m[11]));
  const wall = Date.UTC(
    local.year,
    local.month - 1,
    local.day,
    local.hour,
    local.minute,
    local.second,
  );
  // An explicit offset pins the instant exactly; the user's source time zone is not needed.
  return { kind: 'UTC', utc: wall - offsetMin * 60_000 };
}

const TOKEN_RE = /yyyy|MM|dd|HH|mm|ss|SSS/g;
const TOKEN_DIGITS: Record<string, number> = { yyyy: 4, MM: 2, dd: 2, HH: 2, mm: 2, ss: 2, SSS: 3 };

interface CompiledFormat {
  regex: RegExp;
  tokens: string[];
}

const compiledCache = new Map<string, CompiledFormat>();

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function compile(format: DateFormat): CompiledFormat {
  const cached = compiledCache.get(format);
  if (cached) return cached;
  const tokens: string[] = [];
  let source = '';
  let last = 0;
  for (const m of format.matchAll(TOKEN_RE)) {
    source += escapeRegex(format.slice(last, m.index));
    source += `(\\d{${TOKEN_DIGITS[m[0]]}})`;
    tokens.push(m[0]);
    last = m.index + m[0].length;
  }
  source += escapeRegex(format.slice(last));
  const compiled = { regex: new RegExp(`^${source}$`), tokens };
  compiledCache.set(format, compiled);
  return compiled;
}

function isValidCalendar(l: LocalDateTime): boolean {
  const d = new Date(Date.UTC(l.year, l.month - 1, l.day, l.hour, l.minute, l.second ?? 0));
  return (
    d.getUTCFullYear() === l.year &&
    d.getUTCMonth() === l.month - 1 &&
    d.getUTCDate() === l.day &&
    d.getUTCHours() === l.hour &&
    d.getUTCMinutes() === l.minute &&
    d.getUTCSeconds() === (l.second ?? 0)
  );
}

/** Parses a date string. Milliseconds are accepted but must be zero for bar data. */
export function parseDate(value: string, format: DateFormat): RecordTime | null {
  const v = value.trim();
  if (format === 'UNIX_MS' || format === 'UNIX_S') {
    if (!/^\d+$/.test(v)) return null;
    const n = Number(v);
    return { kind: 'UTC', utc: format === 'UNIX_MS' ? n : n * 1000 };
  }
  if (format === 'ISO_8601') return parseIso(v);
  const { regex, tokens } = compile(format);
  const m = regex.exec(v);
  if (!m) return null;
  const parts: Record<string, number> = {};
  tokens.forEach((t, i) => (parts[t] = Number(m[i + 1])));
  if ((parts.SSS ?? 0) !== 0) return null;
  const local: LocalDateTime = {
    year: parts.yyyy ?? NaN,
    month: parts.MM ?? NaN,
    day: parts.dd ?? NaN,
    hour: parts.HH ?? 0,
    minute: parts.mm ?? 0,
    second: parts.ss ?? 0,
  };
  return isValidCalendar(local) ? { kind: 'LOCAL', local } : null;
}

const NUMBER_RE = /^-?\d+(\.\d+)?([eE][-+]?\d+)?$/;
const DECIMAL_COMMA_RE = /^-?\d+,\d+$/;

function isBlank(row: readonly string[]): boolean {
  return row.every((cell) => cell.trim() === '');
}

type ValueKey = 'o' | 'h' | 'l' | 'c' | 'v';

/**
 * Turns already-split CSV rows into typed records. Pure: no I/O. Bad rows are
 * reported with their line number and left out; nothing is corrected silently.
 */
export function parseCsvRows(
  rows: readonly (readonly string[])[],
  mapping: CsvMapping,
): { records: RawRecord[]; errors: ParseError[] } {
  const records: RawRecord[] = [];
  const errors: ParseError[] = [];
  const valueColumns: [ValueKey, number][] = [
    ['o', mapping.open],
    ['h', mapping.high],
    ['l', mapping.low],
    ['c', mapping.close],
  ];
  if (mapping.volume !== undefined) valueColumns.push(['v', mapping.volume]);

  rows.forEach((row, index) => {
    const rowNo = index + 1;
    if (mapping.hasHeader && index === 0) return;
    if (isBlank(row)) return;

    const fail = (reason: ParseErrorReason, column: number, value = row[column] ?? '') => {
      errors.push({ row: rowNo, reason, column, value });
    };

    let dateText: string | undefined;
    let dateColumn: number;
    if (mapping.time.kind === 'SINGLE') {
      dateColumn = mapping.time.column;
      dateText = row[dateColumn];
    } else {
      dateColumn = mapping.time.dateColumn;
      const d = row[mapping.time.dateColumn];
      const t = row[mapping.time.timeColumn];
      if (d === undefined) return fail('MISSING_COLUMN', dateColumn);
      if (t === undefined) return fail('MISSING_COLUMN', mapping.time.timeColumn);
      dateText = `${d.trim()} ${t.trim()}`;
    }
    if (dateText === undefined) return fail('MISSING_COLUMN', dateColumn);
    const time = parseDate(dateText, mapping.dateFormat);
    if (!time) return fail('BAD_DATE', dateColumn, dateText);

    const values: Partial<Record<ValueKey, number>> = {};
    for (const [key, column] of valueColumns) {
      const cell = row[column];
      if (cell === undefined || cell.trim() === '') return fail('MISSING_COLUMN', column);
      const text = cell.trim();
      if (DECIMAL_COMMA_RE.test(text)) return fail('DECIMAL_COMMA', column);
      if (!NUMBER_RE.test(text)) return fail('NOT_A_NUMBER', column);
      values[key] = Number(text);
    }

    const record: RawRecord = {
      row: rowNo,
      time,
      o: values.o!,
      h: values.h!,
      l: values.l!,
      c: values.c!,
    };
    if (values.v !== undefined) record.v = values.v;
    records.push(record);
  });

  return { records, errors };
}

const HEADER_NAMES = {
  datetime: ['gmt time', 'local time', 'time', 'datetime', 'date time', 'timestamp', 'date'],
  date: ['date'],
  time: ['time'],
  open: ['open'],
  high: ['high'],
  low: ['low'],
  close: ['close'],
  volume: ['volume', 'vol', 'tick volume', 'tickvol'],
};

function findColumn(header: readonly string[], names: readonly string[]): number | undefined {
  for (const name of names) {
    const i = header.findIndex((h) => h.trim().toLowerCase().replace(/[<>]/g, '') === name);
    if (i >= 0) return i;
  }
  return undefined;
}

function detectFormat(sample: string): DateFormat | undefined {
  return KNOWN_DATE_FORMATS.find((f) => parseDate(sample, f) !== null);
}

function withVolume(m: CsvMapping, volume: number | undefined): CsvMapping {
  return volume === undefined ? m : { ...m, volume };
}

function guessWithHeader(
  rows: readonly (readonly string[])[],
  headerIndex: number,
): CsvMapping | null {
  const header = rows[headerIndex]!;
  const sample = rows.slice(headerIndex + 1).find((r) => !isBlank(r));
  const open = findColumn(header, HEADER_NAMES.open);
  const high = findColumn(header, HEADER_NAMES.high);
  const low = findColumn(header, HEADER_NAMES.low);
  const close = findColumn(header, HEADER_NAMES.close);
  if (
    !sample ||
    open === undefined ||
    high === undefined ||
    low === undefined ||
    close === undefined
  ) {
    return null;
  }
  const dateCol = findColumn(header, HEADER_NAMES.date);
  const timeCol = findColumn(header, HEADER_NAMES.time);
  let time: TimeColumns;
  let sampleText: string | undefined;
  if (dateCol !== undefined && timeCol !== undefined && dateCol !== timeCol) {
    time = { kind: 'DATE_AND_TIME', dateColumn: dateCol, timeColumn: timeCol };
    sampleText = `${sample[dateCol]?.trim()} ${sample[timeCol]?.trim()}`;
  } else {
    // Unrecognised header names (e.g. Dukascopy's "Etc/UTC"): use the first column whose
    // sample value is a date in a known format.
    const col =
      findColumn(header, HEADER_NAMES.datetime) ??
      sample.findIndex((cell, i) => ![open, high, low, close].includes(i) && !!detectFormat(cell));
    if (col === undefined || col < 0) return null;
    time = { kind: 'SINGLE', column: col };
    sampleText = sample[col];
  }
  const dateFormat = sampleText === undefined ? undefined : detectFormat(sampleText);
  if (!dateFormat) return null;
  return withVolume(
    { hasHeader: true, time, dateFormat, open, high, low, close },
    findColumn(header, HEADER_NAMES.volume),
  );
}

function guessHeaderless(first: readonly string[]): CsvMapping | null {
  // Layout: date [time] open high low close [volume]
  const single = detectFormat(first[0] ?? '');
  if (single) {
    return withVolume(
      {
        hasHeader: false,
        time: { kind: 'SINGLE', column: 0 },
        dateFormat: single,
        open: 1,
        high: 2,
        low: 3,
        close: 4,
      },
      first.length > 5 ? 5 : undefined,
    );
  }
  const joined = detectFormat(`${first[0]?.trim()} ${first[1]?.trim()}`);
  if (joined) {
    return withVolume(
      {
        hasHeader: false,
        time: { kind: 'DATE_AND_TIME', dateColumn: 0, timeColumn: 1 },
        dateFormat: joined,
        open: 2,
        high: 3,
        low: 4,
        close: 5,
      },
      first.length > 6 ? 6 : undefined,
    );
  }
  return null;
}

/** Best-effort guess of the column layout. The user always confirms it in the import wizard. */
export function guessMapping(rows: readonly (readonly string[])[]): CsvMapping | null {
  const firstIndex = rows.findIndex((r) => !isBlank(r));
  if (firstIndex < 0) return null;
  const first = rows[firstIndex]!;
  return findColumn(first, HEADER_NAMES.open) !== undefined
    ? guessWithHeader(rows, firstIndex)
    : guessHeaderless(first);
}
