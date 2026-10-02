import type { Bars } from './bars';
import type { Swing, SwingParams } from './types';

export const SWING_DEFAULTS: SwingParams = { left: 3, right: 3 };

/**
 * Swing (pivot) highs and lows, definition v1 (docs/definitions/swing-v1.md).
 * High at bar i: h[i] > every high of the `left` bars before it and h[i] ≥ every high of the
 * `right` bars after it (the first of equal highs wins). Lows mirror this. Known only when the
 * `right`-th bar after it has closed, so the confirmation delay is `right` bars.
 */
export function detectSwings(b: Bars, p: SwingParams = SWING_DEFAULTS): Swing[] {
  const { left, right } = p;
  if (!Number.isInteger(left) || !Number.isInteger(right) || left < 1 || right < 1)
    throw new Error('swing left/right must be positive integers');
  const out: Swing[] = [];
  for (let i = left; i + right < b.length; i++) {
    let isHigh = true;
    let isLow = true;
    for (let k = i - left; k < i && (isHigh || isLow); k++) {
      if (b.h[k]! >= b.h[i]!) isHigh = false;
      if (b.l[k]! <= b.l[i]!) isLow = false;
    }
    for (let k = i + 1; k <= i + right && (isHigh || isLow); k++) {
      if (b.h[k]! > b.h[i]!) isHigh = false;
      if (b.l[k]! < b.l[i]!) isLow = false;
    }
    const timing = (kind: 'HIGH' | 'LOW') => ({
      id: `SWING:v1:${left}-${right}:${kind}:${b.t[i]}`,
      defVersion: 'v1' as const,
      formedAt: b.t[i]!,
      formedIndex: i,
      confirmedAt: b.end[i + right]!,
      confirmedIndex: i + right,
    });
    if (isHigh) out.push({ ...timing('HIGH'), type: 'SWING', kind: 'HIGH', price: b.h[i]! });
    if (isLow) out.push({ ...timing('LOW'), type: 'SWING', kind: 'LOW', price: b.l[i]! });
  }
  return out;
}
