import { describe, expect, it } from 'vitest';
import { positionToTime, timeToPosition } from '../src/chart/coords';

// Bar open times (15m) with a weekend-style gap between 10:15 and 12:00.
const MIN = 60_000;
const TF = 15 * MIN;
const base = Date.parse('2026-01-06T10:00:00Z');
const times = [base, base + TF, base + 8 * TF, base + 9 * TF]; // 10:00, 10:15, 12:00, 12:15

describe('timeToPosition (logical index, bar i spans i-0.5 … i+0.5)', () => {
  it('maps a bar open time to the left edge of that bar', () => {
    expect(timeToPosition(times, TF, base)).toBe(-0.5);
    expect(timeToPosition(times, TF, base + 8 * TF)).toBe(1.5);
  });

  it('maps a time inside a bar proportionally', () => {
    expect(timeToPosition(times, TF, base + 7.5 * MIN)).toBe(0); // middle of bar 0
  });

  it('collapses times inside a data gap onto the right edge of the bar before it', () => {
    expect(timeToPosition(times, TF, base + 4 * TF)).toBe(1.5);
  });

  it('extrapolates before the first and after the last bar', () => {
    expect(timeToPosition(times, TF, base - TF)).toBe(-1.5);
    expect(timeToPosition(times, TF, base + 11 * TF)).toBe(4.5);
  });

  it('returns NaN when there are no bars', () => {
    expect(timeToPosition([], TF, base)).toBeNaN();
  });
});

describe('positionToTime', () => {
  it('inverts timeToPosition inside bars, before and after the data', () => {
    for (const p of [-1.5, -0.5, 0, 0.25, 1.5, 2, 3.4, 4.5]) {
      expect(timeToPosition(times, TF, positionToTime(times, TF, p))).toBeCloseTo(p, 9);
    }
  });

  it('returns whole milliseconds', () => {
    const t = positionToTime(times, TF, 0.3333);
    expect(Number.isInteger(t)).toBe(true);
  });
});
