import Papa from 'papaparse';
import {
  analyzeImport,
  getInstrument,
  guessMapping,
  normalize,
  requiredFixes,
  type Blocker,
  type CandleSeries,
  type CsvMapping,
  type DstIssue,
  type Fix,
  type IanaTz,
  type ImportAnalysis,
  type ParseError,
  type Timeframe,
  type UtcMs,
  type ValidationReport,
} from '@trw/engine';

const PREVIEW_ROWS = 8;
const SAMPLE_LIMIT = 20;

export interface ReadResult {
  fileName: string;
  totalRows: number;
  preview: string[][];
  guess: CsvMapping | null;
}

type Samples = {
  [
    K in
      | 'duplicates'
      | 'outOfOrder'
      | 'gaps'
      | 'closedMarketCandles'
      | 'nonPositive'
      | 'ohlcInconsistent'
      | 'precisionOverflow'
  ]: ValidationReport[K];
} & { parseErrors: ParseError[]; dstIssues: DstIssue[] };

/** Small, message-friendly view of an analysis: exact counts, capped samples. */
export interface AnalysisSummary {
  recordCount: number;
  inferredTimeframe: Timeframe | null;
  range: { from: UtcMs; to: UtcMs } | null;
  required: Fix[];
  blockers: Blocker[];
  counts: {
    parseErrors: number;
    dstIssues: number;
    identicalDuplicates: number;
    conflictingDuplicates: number;
    outOfOrder: number;
    gaps: number;
    missingBars: number;
    closedMarketGaps: number;
    closedMarketCandles: number;
    invalidPriceRows: number;
    precisionOverflow: number;
  };
  samples: Samples;
}

export interface FinishResult {
  series: CandleSeries;
  applied: Fix[];
  validation: ValidationReport;
  parseErrors: ParseError[];
  dstIssues: DstIssue[];
}

/**
 * Import state machine: read → analyze (repeatable) → finish. Runs inside the import worker;
 * kept free of worker APIs so it can be tested directly.
 */
export class ImportSession {
  private rows: string[][] | null = null;
  private fileName = '';
  private analysis: ImportAnalysis | null = null;
  private instrument: string | null = null;

  read(text: string, fileName: string): ReadResult {
    const parsed = Papa.parse<string[]>(text, { skipEmptyLines: false });
    this.rows = parsed.data;
    this.fileName = fileName;
    this.analysis = null;
    const nonEmpty = this.rows.filter((r) => r.some((c) => c.trim() !== ''));
    return {
      fileName,
      totalRows: nonEmpty.length,
      preview: nonEmpty.slice(0, PREVIEW_ROWS),
      guess: guessMapping(this.rows),
    };
  }

  analyze(mapping: CsvMapping, sourceTz: IanaTz, instrument: string): AnalysisSummary {
    if (!this.rows) throw new Error('No file has been read');
    const inst = getInstrument(instrument);
    const a = analyzeImport(this.rows, mapping, sourceTz, inst);
    this.analysis = a;
    this.instrument = instrument;
    const v = a.validation;
    const { fixes, blockers } = requiredFixes(a);
    let from = Infinity;
    let to = -Infinity;
    for (const r of a.records) {
      if (r.t < from) from = r.t;
      if (r.t > to) to = r.t;
    }
    const cap = <T>(xs: T[]) => xs.slice(0, SAMPLE_LIMIT);
    return {
      recordCount: a.records.length,
      inferredTimeframe: v.inferredTimeframe,
      range: a.records.length > 0 ? { from, to } : null,
      required: fixes,
      blockers,
      counts: {
        parseErrors: a.parseErrors.length,
        dstIssues: a.dstIssues.length,
        identicalDuplicates: v.duplicates.filter((d) => d.identical).length,
        conflictingDuplicates: v.duplicates.filter((d) => !d.identical).length,
        outOfOrder: v.outOfOrder.length,
        gaps: v.gaps.length,
        missingBars: v.gaps.reduce((sum, g) => sum + g.missingBars, 0),
        closedMarketGaps: v.closedMarketGaps,
        closedMarketCandles: v.closedMarketCandles.length,
        invalidPriceRows: new Set([
          ...v.nonPositive.map((x) => x.row),
          ...v.ohlcInconsistent.map((x) => x.row),
        ]).size,
        precisionOverflow: v.precisionOverflow.length,
      },
      samples: {
        parseErrors: cap(a.parseErrors),
        dstIssues: cap(a.dstIssues),
        duplicates: cap(v.duplicates),
        outOfOrder: cap(v.outOfOrder),
        // Largest first: real holes must not hide behind many one-minute quiet gaps.
        gaps: cap([...v.gaps].sort((x, y) => y.missingBars - x.missingBars || x.from - y.from)),
        closedMarketCandles: cap(v.closedMarketCandles),
        nonPositive: cap(v.nonPositive),
        ohlcInconsistent: cap(v.ohlcInconsistent),
        precisionOverflow: cap(v.precisionOverflow),
      },
    };
  }

  finish(accepted: Fix[]): FinishResult {
    if (!this.analysis || !this.instrument) throw new Error('File must be analyzed before saving');
    const { series, applied } = normalize(this.analysis, getInstrument(this.instrument), accepted);
    return {
      series,
      applied,
      validation: this.analysis.validation,
      parseErrors: this.analysis.parseErrors,
      dstIssues: this.analysis.dstIssues,
    };
  }

  get currentFileName(): string {
    return this.fileName;
  }
}
