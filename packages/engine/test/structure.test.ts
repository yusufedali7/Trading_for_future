import { describe, expect, it } from 'vitest';
import { sliceBars } from '../src/features/bars';
import { detectStructureBreaks } from '../src/features/structure';
import { detectSwings } from '../src/features/swing';
import { T0, BAR_MS, bars, randomWalk } from './helpers/synthetic-bars';

const P = { left: 1, right: 1 };

// SYNTHETIC [o, h, l, c]: swing high at bar 1 (12), confirmed at bar 2's close.
const b = bars([
  [10, 11, 9, 10],
  [10, 12, 9.5, 11], // swing high 12
  [11, 11.5, 8, 9], // swing low 8 (bar 2) confirmed at bar 3
  [9, 11.8, 8.5, 11.5],
  [11.5, 12.6, 11, 11.9], // wick above 12, close below
  [11.9, 13, 11.5, 12.5], // close above 12 → bullish BOS
  [12.5, 12.8, 9, 9.5], // swing high 13 at bar 5 confirmed here; low 9 at bar 6
  [9.5, 10, 7, 7.5], // close below 8 → bearish CHOCH
]);

describe('detectStructureBreaks (v1)', () => {
  it('breaks the last confirmed swing on a close beyond it; BOS then CHOCH', () => {
    const swings = detectSwings(b, P);
    const breaks = detectStructureBreaks(b, swings);
    expect(breaks.map((x) => [x.direction, x.kind, x.level, x.formedIndex])).toEqual([
      ['BULLISH', 'BOS', 12, 5],
      ['BEARISH', 'CHOCH', 8, 7],
    ]);
    expect(breaks[0]).toMatchObject({
      swingAt: T0 + BAR_MS,
      formedAt: T0 + 5 * BAR_MS,
      confirmedAt: T0 + 6 * BAR_MS,
      confirmedIndex: 5,
    });
  });

  it('with breakBy WICK the first wick beyond the swing counts', () => {
    const breaks = detectStructureBreaks(b, detectSwings(b, P), { breakBy: 'WICK' });
    expect(breaks[0]).toMatchObject({ direction: 'BULLISH', formedIndex: 4, level: 12 });
  });

  it('cannot break a swing before it is confirmed', () => {
    // Swing high at bar 1 is confirmed at the close of bar 2; bar 2 itself closes above it.
    const c = bars([
      [10, 11, 9, 10],
      [10, 12, 9.5, 11],
      [11, 11.9, 10, 11.8],
      [11.8, 12.5, 11.5, 12.2],
    ]);
    const breaks = detectStructureBreaks(c, detectSwings(c, P));
    expect(breaks.map((x) => x.formedIndex)).toEqual([3]);
  });

  it('is truncation invariant', () => {
    const w = randomWalk(400, 11);
    const full = detectStructureBreaks(w, detectSwings(w));
    expect(full.length).toBeGreaterThan(5);
    expect(full.some((x) => x.kind === 'CHOCH')).toBe(true);
    for (let k = 0; k <= w.length; k++) {
      const part = sliceBars(w, k);
      expect(detectStructureBreaks(part, detectSwings(part))).toEqual(
        full.filter((x) => x.confirmedIndex < k),
      );
    }
  });
});
