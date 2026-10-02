import type { Bars } from './bars';
import type { StructureBreak, StructureBreakParams, Swing } from './types';

export const STRUCTURE_DEFAULTS: StructureBreakParams = { breakBy: 'CLOSE' };

/**
 * Structure breaks, definition v1 (docs/definitions/structure-break-v1.md).
 * The reference high is the most recently confirmed swing high; it can be broken from the bar
 * after its confirmation. A bar whose close (breakBy CLOSE) or high (WICK) is above it breaks it
 * bullishly; the reference is then used up until the next swing high is confirmed. Lows mirror
 * this. A break against the direction of the previous break is a CHOCH, otherwise a BOS.
 * `swings` must come from the same bars (any order).
 */
export function detectStructureBreaks(
  b: Bars,
  swings: readonly Swing[],
  p: StructureBreakParams = STRUCTURE_DEFAULTS,
): StructureBreak[] {
  const byConfirm = [...swings].sort(
    (x, y) => x.confirmedIndex - y.confirmedIndex || x.formedIndex - y.formedIndex,
  );
  const out: StructureBreak[] = [];
  let next = 0;
  let refHigh: Swing | null = null;
  let refLow: Swing | null = null;
  let lastDirection: StructureBreak['direction'] | null = null;

  for (let i = 0; i < b.length; i++) {
    // Swings confirmed at the close of an earlier bar are usable from this bar on.
    while (next < byConfirm.length && byConfirm[next]!.confirmedIndex < i) {
      const s = byConfirm[next++]!;
      if (s.kind === 'HIGH') refHigh = s;
      else refLow = s;
    }
    const up = p.breakBy === 'CLOSE' ? b.c[i]! : b.h[i]!;
    const down = p.breakBy === 'CLOSE' ? b.c[i]! : b.l[i]!;
    const broken: [Swing, StructureBreak['direction']][] = [];
    if (refHigh && up > refHigh.price) broken.push([refHigh, 'BULLISH']);
    if (refLow && down < refLow.price) broken.push([refLow, 'BEARISH']);
    for (const [s, direction] of broken) {
      out.push({
        id: `STRUCTURE_BREAK:v1:${p.breakBy}:${direction}:${b.t[i]}`,
        defVersion: 'v1',
        type: 'STRUCTURE_BREAK',
        direction,
        kind: lastDirection === null || lastDirection === direction ? 'BOS' : 'CHOCH',
        level: s.price,
        swingId: s.id,
        swingAt: s.formedAt,
        formedAt: b.t[i]!,
        formedIndex: i,
        confirmedAt: b.end[i]!,
        confirmedIndex: i,
      });
      lastDirection = direction;
      if (direction === 'BULLISH') refHigh = null;
      else refLow = null;
    }
  }
  return out;
}
