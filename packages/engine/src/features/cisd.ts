import type { Bars } from './bars';
import type { Cisd, CisdParams, FeatureDirection } from './types';

export const CISD_DEFAULTS: CisdParams = { maxSeries: 5 };

type Colour = 'UP' | 'DOWN' | 'DOJI';

interface Pending {
  level: number;
  start: number;
  length: number;
}

/**
 * Change in State of Delivery, definition v1 (docs/definitions/cisd-v1.md, D77; the user chose:
 * no sweep requirement, level = open of the series' first candle, series of 1-`maxSeries`).
 * A run of consecutive down closes (1..maxSeries bars; a doji ends a run and is not part of it)
 * sets a bullish level at the run's first open. The first later bar that is not a down close and
 * closes strictly above that level confirms a bullish CISD. Any new down close cancels the pending
 * level (the next run sets a new one). Bearish mirrors this. Known at the confirming bar's close:
 * no confirmation delay beyond the bar itself, and nothing later can change it.
 */
export function detectCisd(b: Bars, p: CisdParams = CISD_DEFAULTS): Cisd[] {
  const { maxSeries } = p;
  if (!Number.isInteger(maxSeries) || maxSeries < 1)
    throw new Error('CISD maxSeries must be a positive integer');
  const out: Cisd[] = [];
  let run: { colour: 'UP' | 'DOWN'; start: number; length: number } | null = null;
  let bull: Pending | null = null;
  let bear: Pending | null = null;

  const emit = (i: number, direction: FeatureDirection, x: Pending) =>
    out.push({
      id: `CISD:v1:${maxSeries}:${direction}:${b.t[i]}`,
      defVersion: 'v1',
      type: 'CISD',
      direction,
      level: x.level,
      seriesStartIndex: x.start,
      seriesStartAt: b.t[x.start]!,
      seriesLength: x.length,
      formedAt: b.t[i]!,
      formedIndex: i,
      confirmedAt: b.end[i]!,
      confirmedIndex: i,
    });

  for (let i = 0; i < b.length; i++) {
    const o = b.o[i]!;
    const c = b.c[i]!;
    const colour: Colour = c > o ? 'UP' : c < o ? 'DOWN' : 'DOJI';

    // The run that ended at the previous bar becomes the pending level (or clears it if too long).
    if (run && colour !== run.colour) {
      const x =
        run.length <= maxSeries
          ? { level: b.o[run.start]!, start: run.start, length: run.length }
          : null;
      if (run.colour === 'DOWN') bull = x;
      else bear = x;
      run = null;
    }

    if (bull && colour !== 'DOWN' && c > bull.level) {
      emit(i, 'BULLISH', bull);
      bull = null;
    }
    if (bear && colour !== 'UP' && c < bear.level) {
      emit(i, 'BEARISH', bear);
      bear = null;
    }

    if (colour === 'DOWN') bull = null;
    if (colour === 'UP') bear = null;
    if (colour !== 'DOJI') {
      if (run) run.length++;
      else run = { colour, start: i, length: 1 };
    }
  }
  return out;
}
