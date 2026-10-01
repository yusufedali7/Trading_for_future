import { describe, expect, it } from 'vitest';
import { logicalToX, xToLogical, type IntegerLogicalScale } from '../src/chart/lwc-coords';

// Fake time scale reproducing Lightweight Charts 5.2.1 behaviour: integer logicals map linearly
// (x = 100 + 10 * i), fractional logicals return 0 (observed in the browser, see DECISIONS D24).
const scale: IntegerLogicalScale = {
  logicalToCoordinate: (l) => (Number.isInteger(l) ? 100 + 10 * l : 0),
  coordinateToLogical: (x) => Math.round((x - 100) / 10),
};

describe('logicalToX', () => {
  it('passes integer positions through', () => {
    expect(logicalToX(scale, 3)).toBe(130);
  });

  it('interpolates fractional positions between neighbouring bars', () => {
    expect(logicalToX(scale, 2.5)).toBe(125);
    expect(logicalToX(scale, -0.5)).toBe(95);
  });

  it('returns null when the scale cannot resolve a neighbour', () => {
    expect(logicalToX({ ...scale, logicalToCoordinate: () => null }, 2.5)).toBeNull();
  });
});

describe('xToLogical', () => {
  it('returns a fractional logical position (inverse of logicalToX)', () => {
    expect(xToLogical(scale, 125)).toBeCloseTo(2.5);
    expect(xToLogical(scale, 133)).toBeCloseTo(3.3);
    for (const p of [-1.25, 0, 0.5, 7.75])
      expect(xToLogical(scale, logicalToX(scale, p)!)).toBeCloseTo(p);
  });
});
