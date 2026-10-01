import type { IanaTz } from '../core/types';
import { roundToTick, type Instrument } from '../instruments/registry';
import { seriesFromRows, type CandleSeries } from './columnar';
import { parseCsvRows, type CsvMapping, type ParseError } from './csv-rows';
import {
  resolveTimes,
  validateRecords,
  type DstIssue,
  type TimedRecord,
  type ValidationReport,
} from './validate';

export interface ImportAnalysis {
  parseErrors: ParseError[];
  dstIssues: DstIssue[];
  validation: ValidationReport;
  /** Records that parsed and have an unambiguous UTC time, in file order. */
  records: TimedRecord[];
  hasVolume: boolean;
}

/** Parse → resolve times → validate. Nothing is changed; everything found is reported. */
export function analyzeImport(
  rows: readonly (readonly string[])[],
  mapping: CsvMapping,
  sourceTz: IanaTz,
  inst: Instrument,
): ImportAnalysis {
  const parsed = parseCsvRows(rows, mapping);
  const { records, dstIssues } = resolveTimes(parsed.records, sourceTz);
  return {
    parseErrors: parsed.errors,
    dstIssues,
    validation: validateRecords(records, inst),
    records,
    hasVolume: mapping.volume !== undefined,
  };
}

/** Explicit user decisions. Each one applied is stored with the dataset (acceptedIssues). */
export const FIXES = [
  'SKIP_UNPARSEABLE_ROWS',
  'SKIP_DST_ROWS',
  'SORT_BY_TIME',
  'DROP_IDENTICAL_DUPLICATES',
  'DROP_CLOSED_MARKET_CANDLES',
  'DROP_INVALID_PRICES',
  'ROUND_TO_TICK',
] as const;

export type Fix = (typeof FIXES)[number];

/** Problems no automatic fix may resolve; the source file must be corrected. */
export type Blocker = { kind: 'CONFLICTING_DUPLICATES'; count: number } | { kind: 'NO_DATA' };

export function requiredFixes(a: ImportAnalysis): { fixes: Fix[]; blockers: Blocker[] } {
  const v = a.validation;
  const needed: Record<Fix, boolean> = {
    SKIP_UNPARSEABLE_ROWS: a.parseErrors.length > 0,
    SKIP_DST_ROWS: a.dstIssues.length > 0,
    SORT_BY_TIME: v.outOfOrder.length > 0,
    DROP_IDENTICAL_DUPLICATES: v.duplicates.some((d) => d.identical),
    DROP_CLOSED_MARKET_CANDLES: v.closedMarketCandles.length > 0,
    DROP_INVALID_PRICES: v.nonPositive.length > 0 || v.ohlcInconsistent.length > 0,
    ROUND_TO_TICK: v.precisionOverflow.length > 0,
  };
  const blockers: Blocker[] = [];
  const conflicting = v.duplicates.filter((d) => !d.identical).length;
  if (conflicting > 0) blockers.push({ kind: 'CONFLICTING_DUPLICATES', count: conflicting });
  if (a.records.length === 0) blockers.push({ kind: 'NO_DATA' });
  return { fixes: FIXES.filter((f) => needed[f]), blockers };
}

/**
 * Builds the stored series. Throws if a required fix was not accepted or a blocker exists,
 * so data is never altered without an explicit, recorded decision.
 */
export function normalize(
  a: ImportAnalysis,
  inst: Instrument,
  accepted: readonly Fix[],
): { series: CandleSeries; applied: Fix[] } {
  const { fixes, blockers } = requiredFixes(a);
  if (blockers.length > 0) {
    throw new Error(`Import blocked: ${blockers.map((b) => b.kind).join(', ')}`);
  }
  const missing = fixes.filter((f) => !accepted.includes(f));
  if (missing.length > 0) throw new Error(`Fixes not accepted: ${missing.join(', ')}`);

  const v = a.validation;
  let recs: TimedRecord[] = a.records;

  if (fixes.includes('DROP_INVALID_PRICES')) {
    const bad = new Set([...v.nonPositive.map((x) => x.row), ...v.ohlcInconsistent.map((x) => x.row)]);
    recs = recs.filter((r) => !bad.has(r.row));
  }
  if (fixes.includes('DROP_CLOSED_MARKET_CANDLES')) {
    const closed = new Set(v.closedMarketCandles.map((x) => x.row));
    recs = recs.filter((r) => !closed.has(r.row));
  }
  if (fixes.includes('ROUND_TO_TICK')) {
    recs = recs.map((r) => ({
      ...r,
      o: roundToTick(inst, r.o),
      h: roundToTick(inst, r.h),
      l: roundToTick(inst, r.l),
      c: roundToTick(inst, r.c),
    }));
  }
  if (fixes.includes('SORT_BY_TIME')) {
    recs = [...recs].sort((x, y) => x.t - y.t || x.row - y.row);
  }
  if (fixes.includes('DROP_IDENTICAL_DUPLICATES')) {
    recs = recs.filter((r, i) => i === 0 || recs[i - 1]!.t !== r.t);
  }

  return { series: seriesFromRows(recs, a.hasVolume), applied: fixes };
}
