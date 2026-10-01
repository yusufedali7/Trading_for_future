import type { Logical } from 'lightweight-charts';

/**
 * Fractional logical ↔ pixel conversion on top of Lightweight Charts' time scale.
 * In 5.2.1, logicalToCoordinate() returns 0 for non-integer logicals (verified in the browser,
 * DECISIONS D24), so positions are interpolated between the two neighbouring integer bars.
 */
export interface IntegerLogicalScale {
  logicalToCoordinate(logical: number): number | null;
  coordinateToLogical(x: number): number | null;
}

/** Adapts a Lightweight Charts time scale (branded Logical type) to the plain-number interface. */
export function timeScaleAdapter(ts: {
  logicalToCoordinate(logical: Logical): number | null;
  coordinateToLogical(x: number): number | null;
}): IntegerLogicalScale {
  return {
    logicalToCoordinate: (l) => ts.logicalToCoordinate(l as Logical),
    coordinateToLogical: (x) => ts.coordinateToLogical(x),
  };
}

export function logicalToX(scale: IntegerLogicalScale, p: number): number | null {
  const i = Math.floor(p);
  const x0 = scale.logicalToCoordinate(i);
  if (x0 === null) return null;
  if (p === i) return x0;
  const x1 = scale.logicalToCoordinate(i + 1);
  if (x1 === null) return null;
  return x0 + (p - i) * (x1 - x0);
}

export function xToLogical(scale: IntegerLogicalScale, x: number): number | null {
  const near = scale.coordinateToLogical(x);
  if (near === null) return null;
  const i = Math.floor(near);
  const x0 = scale.logicalToCoordinate(i);
  const x1 = scale.logicalToCoordinate(i + 1);
  if (x0 === null || x1 === null || x1 === x0) return near;
  return i + (x - x0) / (x1 - x0);
}
