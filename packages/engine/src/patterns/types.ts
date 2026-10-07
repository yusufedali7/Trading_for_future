import type { UtcMs } from '../core/types';

/**
 * Catalog-driven pattern detections (M9): a separate system from the M4 `features/` candidates
 * (CLAUDE.md "Kavram tanımları" - the catalog is automatic detection, not a manual drawing tool).
 */
export interface CandlePattern {
  id: string;
  /** `catalog/patterns/candlestick.json` id, e.g. "cdldoji". */
  patternId: string;
  defVersion: 'v1';
  direction: 'BULLISH' | 'BEARISH' | null;
  formedAt: UtcMs;
  formedIndex: number;
  /** Known at the close of the pattern's last bar. */
  confirmedAt: UtcMs;
  confirmedIndex: number;
}
