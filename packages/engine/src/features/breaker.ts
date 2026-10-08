import type { Bars } from './bars';
import type { Breaker, OrderBlock } from './types';

/**
 * Breaker blocks, definition v1 (docs/definitions/breaker-v1.md). An order block is invalidated
 * when a later bar **closes** fully through its far edge (the first such bar only); from then on
 * the same zone is tracked as a candidate in the opposite direction.
 */
export function detectBreakers(b: Bars, blocks: readonly OrderBlock[]): Breaker[] {
  const out: Breaker[] = [];
  for (const ob of blocks) {
    for (let i = ob.confirmedIndex + 1; i < b.length; i++) {
      const invalidated = ob.direction === 'BULLISH' ? b.c[i]! < ob.bottom : b.c[i]! > ob.top;
      if (!invalidated) continue;
      out.push({
        id: `BREAKER:v1:${ob.id}:${b.t[i]}`,
        defVersion: 'v1',
        type: 'BREAKER',
        direction: ob.direction === 'BULLISH' ? 'BEARISH' : 'BULLISH',
        top: ob.top,
        bottom: ob.bottom,
        sourceOrderBlockId: ob.id,
        formedAt: ob.formedAt,
        formedIndex: ob.formedIndex,
        confirmedAt: b.end[i]!,
        confirmedIndex: i,
      });
      break;
    }
  }
  return out;
}
