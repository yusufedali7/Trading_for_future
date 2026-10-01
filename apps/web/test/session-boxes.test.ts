import { describe, expect, it } from 'vitest';
import type { SessionLevels } from '@trw/engine';
import { layoutSessionBoxes } from '../src/chart/primitives/session-layout';

// SYNTHETIC: 1h bars 06:00 … 18:00 on one day, positions = index.
const H = 3_600_000;
const day = Date.parse('2026-01-06T00:00:00Z');
const times = Array.from({ length: 13 }, (_, i) => day + (6 + i) * H);

function session(
  id: string,
  startH: number,
  endH: number,
  extra: Partial<SessionLevels> = {},
): SessionLevels {
  return {
    sessionId: id,
    version: 1,
    date: '2026-01-06',
    startUtc: day + startH * H,
    endUtc: day + endH * H,
    high: 1.2,
    highAt: day + startH * H,
    low: 1.1,
    lowAt: day + startH * H,
    barCount: 60,
    complete: true,
    knownAt: day + endH * H,
    ...extra,
  };
}

// Identity-ish mappings: x = logical position * 10, y = (2 - price) * 100.
const toX = (p: number) => p * 10;
const toY = (price: number) => (2 - price) * 100;

describe('layoutSessionBoxes', () => {
  it('spans from the left edge of the start bar to the left edge of the end bar', () => {
    const [box] = layoutSessionBoxes(
      [session('LONDON', 8, 17)],
      times,
      H,
      { from: -1, to: 20 },
      toX,
      toY,
    );
    // 08:00 is bar 2 → left edge 1.5; 17:00 is bar 11 → left edge 10.5
    expect(box).toMatchObject({ sessionId: 'LONDON', x1: 15, x2: 105, complete: true });
    expect(box!.yTop).toBeCloseTo(80);
    expect(box!.yBottom).toBeCloseTo(90);
  });

  it('skips sessions outside the visible logical range', () => {
    const boxes = layoutSessionBoxes(
      [session('LONDON', 8, 17)],
      times,
      H,
      { from: 11, to: 20 },
      toX,
      toY,
    );
    expect(boxes).toEqual([]);
  });

  it('skips sessions without data', () => {
    const empty = session('LONDON', 8, 17, { high: null, low: null, barCount: 0 });
    expect(layoutSessionBoxes([empty], times, H, { from: -1, to: 20 }, toX, toY)).toEqual([]);
  });

  it('keeps a running session open-ended and marks it incomplete', () => {
    const running = session('NEW_YORK', 13, 22, { complete: false });
    const [box] = layoutSessionBoxes([running], times, H, { from: -1, to: 20 }, toX, toY);
    expect(box!.complete).toBe(false);
    // 22:00 is after the last bar (18:00 = index 12): extrapolated to 12 - 0.5 + 4 = 15.5
    expect(box!.x2).toBeCloseTo(155);
  });

  it('drops boxes whose coordinates cannot be resolved', () => {
    const boxes = layoutSessionBoxes(
      [session('LONDON', 8, 17)],
      times,
      H,
      { from: -1, to: 20 },
      () => null,
      toY,
    );
    expect(boxes).toEqual([]);
  });
});
