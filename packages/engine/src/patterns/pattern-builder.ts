import type { Bars } from '../features/bars';
import type { CandlePattern } from './types';

/** `formedIndex` = the pattern's first bar, `confirmedIndex` = its last (triggering) bar. */
export const multi = (
  b: Bars,
  formedIndex: number,
  confirmedIndex: number,
  patternId: string,
  direction: CandlePattern['direction'],
): CandlePattern => ({
  id: `${patternId}:v1:${b.t[confirmedIndex]}`,
  patternId,
  defVersion: 'v1',
  direction,
  formedAt: b.t[formedIndex]!,
  formedIndex,
  confirmedAt: b.end[confirmedIndex]!,
  confirmedIndex,
});

export const single = (
  b: Bars,
  i: number,
  patternId: string,
  direction: CandlePattern['direction'],
): CandlePattern => multi(b, i, i, patternId, direction);
