import type { Bars } from './bars';
import { atr } from './indicators';
import type { EqualLevels, EqualLevelsParams, Swing } from './types';

export const EQUAL_LEVELS_DEFAULTS: EqualLevelsParams = { toleranceAtr: 0.1, atrPeriod: 14 };

/**
 * Equal highs/lows, definition v1 (docs/definitions/equal-levels-v1.md). Each confirmed swing is
 * compared only to the *nearest preceding* swing of the same kind (not a running cluster of
 * three or more - the catalog's default `minCount` of 2); within `toleranceAtr` x the ATR at the
 * newer swing's bar, it is a pair. Null while there is not enough history for the ATR.
 */
export function detectEqualLevels(
  b: Bars,
  swings: readonly Swing[],
  p: EqualLevelsParams = EQUAL_LEVELS_DEFAULTS,
): EqualLevels[] {
  const atrSeries = atr(b, p.atrPeriod);
  const byConfirm = [...swings].sort(
    (x, y) => x.confirmedIndex - y.confirmedIndex || x.formedIndex - y.formedIndex,
  );
  const out: EqualLevels[] = [];
  const lastByKind: Record<'HIGH' | 'LOW', Swing | null> = { HIGH: null, LOW: null };
  for (const s of byConfirm) {
    const prev = lastByKind[s.kind];
    const a = atrSeries[s.confirmedIndex];
    if (prev && a !== null && a !== undefined) {
      const tol = p.toleranceAtr * a;
      if (Math.abs(s.price - prev.price) <= tol) {
        out.push({
          id: `EQUAL_LEVELS:v1:${s.kind}:${prev.id}:${s.id}`,
          defVersion: 'v1',
          type: 'EQUAL_LEVELS',
          side: s.kind,
          price: (s.price + prev.price) / 2,
          swingIds: [prev.id, s.id],
          formedAt: prev.formedAt,
          formedIndex: prev.formedIndex,
          confirmedAt: s.confirmedAt,
          confirmedIndex: s.confirmedIndex,
        });
      }
    }
    lastByKind[s.kind] = s;
  }
  return out;
}
