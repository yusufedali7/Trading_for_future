import { pipsToPrice, type Instrument } from '../instruments/registry';
import type { Bars } from './bars';
import { FirstReach } from './first-reach';
import type { Fvg, FvgParams } from './types';

export const FVG_DEFAULTS: FvgParams = { minSizePips: 1 };

/**
 * Fair value gaps, definition v1 (docs/definitions/fvg-v1.md). Three bars i−2, i−1, i:
 * bullish when low[i] > high[i−2] (gap = high[i−2] … low[i]), bearish when high[i] < low[i−2]
 * (gap = high[i] … low[i−2]); the gap must be at least `minSizePips`. Formed at the middle bar,
 * known at the close of bar i. Later bars set `touchedAt` (reached the near edge) and `filledAt`
 * (reached the far edge), using only bars present in `b`.
 */
export function detectFvgs(b: Bars, inst: Instrument, p: FvgParams = FVG_DEFAULTS): Fvg[] {
  const min = pipsToPrice(inst, p.minSizePips);
  const out: Fvg[] = [];
  let lowTree: FirstReach | null = null;
  let highTree: FirstReach | null = null;
  const lows = () => (lowTree ??= new FirstReach(b.l, 'MIN'));
  const highs = () => (highTree ??= new FirstReach(b.h, 'MAX'));
  for (let i = 2; i < b.length; i++) {
    let gap: { direction: Fvg['direction']; top: number; bottom: number } | null = null;
    if (b.l[i]! > b.h[i - 2]!) gap = { direction: 'BULLISH', top: b.l[i]!, bottom: b.h[i - 2]! };
    else if (b.h[i]! < b.l[i - 2]!)
      gap = { direction: 'BEARISH', top: b.l[i - 2]!, bottom: b.h[i]! };
    // Compare in ticks to avoid float noise (1.10050 − 1.10040 ≠ 0.0001 exactly).
    if (!gap || Math.round((gap.top - gap.bottom - min) * 1e8) < 0) continue;

    const bull = gap.direction === 'BULLISH';
    const reach = bull ? lows() : highs();
    const touched = reach.first(i + 1, bull ? gap.top : gap.bottom);
    const filled = reach.first(i + 1, bull ? gap.bottom : gap.top);
    const touchedAt = touched === -1 ? null : b.end[touched]!;
    const filledAt = filled === -1 ? null : b.end[filled]!;
    out.push({
      id: `FVG:v1:${gap.direction}:${b.t[i - 1]}`,
      defVersion: 'v1',
      type: 'FVG',
      ...gap,
      formedAt: b.t[i - 1]!,
      formedIndex: i - 1,
      confirmedAt: b.end[i]!,
      confirmedIndex: i,
      touchedAt,
      filledAt,
    });
  }
  return out;
}
