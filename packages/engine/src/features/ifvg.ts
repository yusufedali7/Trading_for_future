import type { Bars } from './bars';
import type { Fvg, Ifvg } from './types';

/**
 * Inversion FVGs, definition v1 (docs/definitions/ifvg-v1.md). A fair value gap is invalidated
 * when a later bar **closes** fully through its far edge (the first such bar only); from then on
 * the same zone is tracked as a candidate in the opposite direction.
 */
export function detectIfvg(b: Bars, fvgs: readonly Fvg[]): Ifvg[] {
  const out: Ifvg[] = [];
  for (const g of fvgs) {
    for (let i = g.confirmedIndex + 1; i < b.length; i++) {
      const invalidated = g.direction === 'BULLISH' ? b.c[i]! < g.bottom : b.c[i]! > g.top;
      if (!invalidated) continue;
      out.push({
        id: `IFVG:v1:${g.id}:${b.t[i]}`,
        defVersion: 'v1',
        type: 'IFVG',
        direction: g.direction === 'BULLISH' ? 'BEARISH' : 'BULLISH',
        top: g.top,
        bottom: g.bottom,
        sourceFvgId: g.id,
        formedAt: g.formedAt,
        formedIndex: g.formedIndex,
        confirmedAt: b.end[i]!,
        confirmedIndex: i,
      });
      break;
    }
  }
  return out;
}
