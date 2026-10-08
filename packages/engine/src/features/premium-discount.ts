import type { PremiumDiscountZone, Swing } from './types';

/**
 * Premium/discount zones, definition v1 (docs/definitions/premium-discount-v1.md). A new zone
 * is emitted every time the most recently confirmed swing high or low changes (and both exist);
 * it is understood to stay active until the next entry's `confirmedAt` - there is no retroactive
 * `validUntil` field, so this is a plain append-only list like every other detector.
 */
export function detectPremiumDiscount(swings: readonly Swing[]): PremiumDiscountZone[] {
  const byConfirm = [...swings].sort(
    (x, y) => x.confirmedIndex - y.confirmedIndex || x.formedIndex - y.formedIndex,
  );
  const out: PremiumDiscountZone[] = [];
  let refHigh: Swing | null = null;
  let refLow: Swing | null = null;
  for (const s of byConfirm) {
    if (s.kind === 'HIGH') refHigh = s;
    else refLow = s;
    if (!refHigh || !refLow) continue;
    const top = refHigh.price;
    const bottom = refLow.price;
    if (top <= bottom) continue;
    out.push({
      id: `PREMIUM_DISCOUNT:v1:${s.id}`,
      defVersion: 'v1',
      type: 'PREMIUM_DISCOUNT',
      top,
      bottom,
      equilibrium: (top + bottom) / 2,
      formedAt: s.confirmedAt,
      formedIndex: s.confirmedIndex,
      confirmedAt: s.confirmedAt,
      confirmedIndex: s.confirmedIndex,
    });
  }
  return out;
}
