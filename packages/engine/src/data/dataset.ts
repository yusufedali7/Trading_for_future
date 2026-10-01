import type { Timeframe } from '../core/timeframe';
import type { IanaTz, UtcMs } from '../core/types';
import type { CsvMapping } from './csv-rows';
import type { Fix } from './normalize';
import type { DstIssue, ValidationReport } from './validate';
import type { ParseError } from './csv-rows';

export type PriceType = 'BID' | 'ASK' | 'MID' | 'UNKNOWN';

/** Metadata stored with every imported dataset (market-data domain). */
export interface DataSetMeta {
  id: string;
  instrument: string;
  baseTimeframe: Timeframe;
  priceType: PriceType;
  source: {
    /** Provider name typed by the user, e.g. "Dukascopy". Terms of use are the user's responsibility. */
    name: string;
    fileName: string;
    sourceTimezone: IanaTz;
    mapping: CsvMapping;
    importedAt: UtcMs;
  };
  /** Open time of the first and last bar. */
  range: { from: UtcMs; to: UtcMs };
  candleCount: number;
  contentHash: string;
  engineVersion: string;
  validation: ValidationReport;
  parseErrors: ParseError[];
  dstIssues: DstIssue[];
  /** Fixes the user explicitly accepted at import (never applied silently). */
  acceptedIssues: Fix[];
  /** Demo data is labelled on every screen and its results are never saved (rule 2). */
  demo: boolean;
}
