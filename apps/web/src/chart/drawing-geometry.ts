import type { Drawing, UtcMs } from '@trw/engine';

/** Maps chart values to pane pixels; returns null when a value cannot be placed. */
export interface PixelMapper {
  x(t: UtcMs): number | null;
  y(p: number): number | null;
  width: number;
}

export interface Point {
  x: number;
  y: number;
}

export type Shape =
  | { type: 'hline'; y: number }
  | { type: 'segment'; x1: number; y1: number; x2: number; y2: number }
  /** Corners in anchor order (a → b), not normalised: the price range tool needs direction. */
  | { type: 'box'; x1: number; y1: number; x2: number; y2: number }
  | { type: 'position'; x1: number; x2: number; yEntry: number; yStop: number; yTarget: number };

const HIT_TOLERANCE = 6;
const HANDLE_RADIUS = 8;

export function shapeOf(d: Drawing, m: PixelMapper): Shape | null {
  const xs = d.anchors.map((a) => m.x(a.t));
  const ys = d.anchors.map((a) => m.y(a.p));
  if (ys.some((v) => v === null)) return null;
  if (d.kind === 'HLINE') return { type: 'hline', y: ys[0]! };
  if (xs.some((v) => v === null)) return null;
  const [x1, x2] = [xs[0]!, xs[1]!];
  const [y1, y2] = [ys[0]!, ys[1]!];
  switch (d.kind) {
    case 'TRENDLINE':
      return { type: 'segment', x1, y1, x2, y2 };
    case 'RECT':
    case 'PRICE_RANGE':
      return { type: 'box', x1, y1, x2, y2 };
    case 'POSITION_LONG':
    case 'POSITION_SHORT':
      return { type: 'position', x1, x2, yEntry: y1, yStop: y2, yTarget: ys[2]! };
  }
}

function distanceToSegment(p: Point, s: { x1: number; y1: number; x2: number; y2: number }) {
  const dx = s.x2 - s.x1;
  const dy = s.y2 - s.y1;
  const len2 = dx * dx + dy * dy;
  const u =
    len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - s.x1) * dx + (p.y - s.y1) * dy) / len2));
  return Math.hypot(p.x - (s.x1 + u * dx), p.y - (s.y1 + u * dy));
}

function inside(p: Point, xa: number, xb: number, ya: number, yb: number, pad: number): boolean {
  return (
    p.x >= Math.min(xa, xb) - pad &&
    p.x <= Math.max(xa, xb) + pad &&
    p.y >= Math.min(ya, yb) - pad &&
    p.y <= Math.max(ya, yb) + pad
  );
}

function hits(shape: Shape, p: Point, width: number): boolean {
  switch (shape.type) {
    case 'hline':
      return Math.abs(p.y - shape.y) <= HIT_TOLERANCE && p.x >= 0 && p.x <= width;
    case 'segment':
      return distanceToSegment(p, shape) <= HIT_TOLERANCE;
    case 'box':
      return inside(p, shape.x1, shape.x2, shape.y1, shape.y2, HIT_TOLERANCE);
    case 'position':
      return inside(p, shape.x1, shape.x2, shape.yStop, shape.yTarget, HIT_TOLERANCE);
  }
}

/** Id of the topmost visible drawing under the pointer (later drawings are on top). */
export function hitTestDrawings(
  drawings: readonly Drawing[],
  p: Point,
  m: PixelMapper,
): string | null {
  for (let i = drawings.length - 1; i >= 0; i--) {
    const d = drawings[i]!;
    if (d.hidden) continue;
    const shape = shapeOf(d, m);
    if (shape && hits(shape, p, m.width)) return d.id;
  }
  return null;
}

export interface Handle {
  index: number;
  x: number;
  y: number;
}

/** Draggable points of a drawing: one per anchor. */
export function handlesOf(d: Drawing, m: PixelMapper): Handle[] {
  const out: Handle[] = [];
  d.anchors.forEach((a, index) => {
    const x = m.x(a.t);
    const y = m.y(a.p);
    if (x !== null && y !== null) out.push({ index, x, y });
  });
  return out;
}

/** Anchor index of the handle under the pointer, or null. */
export function hitTestHandle(d: Drawing, p: Point, m: PixelMapper): number | null {
  let best: Handle | null = null;
  let bestDist = HANDLE_RADIUS;
  for (const h of handlesOf(d, m)) {
    const dist = Math.hypot(p.x - h.x, p.y - h.y);
    if (dist <= bestDist) {
      best = h;
      bestDist = dist;
    }
  }
  return best ? best.index : null;
}
