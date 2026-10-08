import type { Bars } from './bars';
import type { Displacement, OrderBlock, OrderBlockParams, StructureBreak } from './types';

export const ORDER_BLOCK_DEFAULTS: OrderBlockParams = { zone: 'BODY', lookbackBars: 10 };

/**
 * Order blocks, definition v1 (docs/definitions/order-block-v1.md, catalog/patterns/smc.json
 * "order_block"). Only structure breaks (BOS or CHOCH) whose breaking bar is itself a
 * same-direction displacement bar qualify - our stand-in for the catalog's "bos_or_mss" (a real
 * MSS type is not implemented yet). The order block is the nearest opposite-coloured bar within
 * `lookbackBars` bars before the breaking bar (inclusive colour check, close >= open is
 * "bullish", matching the convention already used in patterns/candlestick.ts); its zone is
 * either the candle's body (zone: 'BODY') or its full high-low range ('RANGE'). `direction`
 * matches the break's direction: a BULLISH order block is a support/demand zone, BEARISH is
 * resistance/supply. Forex has no real volume, so (per the catalog's note) no volume-based
 * strength is used. Known from the breaking bar's close (formed earlier, at the reference bar).
 */
export function detectOrderBlocks(
  b: Bars,
  breaks: readonly StructureBreak[],
  displacements: readonly Displacement[],
  p: OrderBlockParams = ORDER_BLOCK_DEFAULTS,
): OrderBlock[] {
  const { zone, lookbackBars } = p;
  const dispByIndex = new Map(displacements.map((d) => [d.formedIndex, d]));
  const out: OrderBlock[] = [];
  for (const brk of breaks) {
    const i = brk.formedIndex;
    const disp = dispByIndex.get(i);
    if (!disp || disp.direction !== brk.direction) continue;
    const bullishBreak = brk.direction === 'BULLISH';
    let refIndex = -1;
    for (let k = i - 1; k >= 0 && k >= i - lookbackBars; k--) {
      const bullishBar = b.c[k]! >= b.o[k]!;
      if (bullishBar !== bullishBreak) {
        refIndex = k;
        break;
      }
    }
    if (refIndex === -1) continue;
    const top = zone === 'BODY' ? Math.max(b.o[refIndex]!, b.c[refIndex]!) : b.h[refIndex]!;
    const bottom = zone === 'BODY' ? Math.min(b.o[refIndex]!, b.c[refIndex]!) : b.l[refIndex]!;
    out.push({
      id: `ORDER_BLOCK:v1:${zone}:${brk.direction}:${b.t[refIndex]}:${b.t[i]}`,
      defVersion: 'v1',
      type: 'ORDER_BLOCK',
      direction: brk.direction,
      top,
      bottom,
      breakId: brk.id,
      formedAt: b.t[refIndex]!,
      formedIndex: refIndex,
      confirmedAt: b.end[i]!,
      confirmedIndex: i,
    });
  }
  return out;
}
