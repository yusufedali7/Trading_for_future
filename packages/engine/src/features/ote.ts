import type { OteParams, OteZone, Swing } from './types';

export const OTE_DEFAULTS: OteParams = { zone: [0.62, 0.79], sweetSpot: 0.705 };

/**
 * Optimal Trade Entry zones, definition v1 (docs/definitions/ote-v1.md). Every pair of
 * consecutive, alternating confirmed swings (by `formedIndex`) is one impulse leg: LOW then HIGH
 * is bullish (zone = a retracement down from the high), HIGH then LOW is bearish (symmetric).
 * Known once the end swing is confirmed (always the later of the two, since both share the same
 * `right`).
 */
export function detectOte(swings: readonly Swing[], p: OteParams = OTE_DEFAULTS): OteZone[] {
  const byForm = [...swings].sort((x, y) => x.formedIndex - y.formedIndex);
  const [lo, hi] = p.zone;
  const out: OteZone[] = [];
  for (let i = 1; i < byForm.length; i++) {
    const prev = byForm[i - 1]!;
    const s = byForm[i]!;
    if (prev.kind === s.kind) continue;
    const range = Math.abs(s.price - prev.price);
    if (range <= 0) continue;
    const bullish = prev.kind === 'LOW';
    const top = bullish ? s.price - lo * range : s.price + hi * range;
    const bottom = bullish ? s.price - hi * range : s.price + lo * range;
    const sweetSpot = bullish ? s.price - p.sweetSpot * range : s.price + p.sweetSpot * range;
    out.push({
      id: `OTE:v1:${s.id}`,
      defVersion: 'v1',
      type: 'OTE',
      direction: bullish ? 'BULLISH' : 'BEARISH',
      top,
      bottom,
      sweetSpot,
      startSwingId: prev.id,
      endSwingId: s.id,
      formedAt: s.formedAt,
      formedIndex: s.formedIndex,
      confirmedAt: s.confirmedAt,
      confirmedIndex: s.confirmedIndex,
    });
  }
  return out;
}
