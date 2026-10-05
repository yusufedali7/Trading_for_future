import { fibLevels, type Drawing, type UtcMs } from '@trw/engine';

/** Maps chart values to pane pixels; returns null when a value cannot be placed. */
export interface PixelMapper {
  x(t: UtcMs): number | null;
  y(p: number): number | null;
  width: number;
  /** Chart bars with an open time in [min(a, b), max(a, b)) — for the date range tools. */
  bars?(a: UtcMs, b: UtcMs): number;
}

export interface Point {
  x: number;
  y: number;
}

interface Seg {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export type Shape =
  | { type: 'hline'; y: number }
  | { type: 'hray'; x: number; y: number }
  | { type: 'vline'; x: number }
  | { type: 'cross'; x: number; y: number }
  /** Rays and extended lines arrive already stretched to the pane edges. */
  | ({ type: 'segment' } & Seg)
  | { type: 'channel'; a: Seg; b: Seg }
  | { type: 'fib'; x1: number; x2: number; levels: { level: number; price: number; y: number }[] }
  /** Corners in anchor order (a → b), not normalised: range tools need the direction. */
  | ({ type: 'box' } & Seg)
  | { type: 'point'; x: number; y: number }
  | { type: 'position'; x1: number; x2: number; yEntry: number; yStop: number; yTarget: number };

const HIT_TOLERANCE = 6;
const HANDLE_RADIUS = 8;
const FAR = 100_000;

/** The line through a → b, cut at the pane edges on the requested sides. */
function extend(s: Seg, back: boolean, forward: boolean, width: number): Seg {
  if (s.x1 === s.x2) {
    const dir = s.y2 >= s.y1 ? 1 : -1;
    return {
      x1: s.x1,
      y1: back ? s.y1 - dir * FAR : s.y1,
      x2: s.x2,
      y2: forward ? s.y2 + dir * FAR : s.y2,
    };
  }
  const slope = (s.y2 - s.y1) / (s.x2 - s.x1);
  const at = (x: number) => s.y1 + slope * (x - s.x1);
  const right = s.x2 > s.x1;
  const fx = right ? width : 0;
  const bx = right ? 0 : width;
  return {
    x1: back ? bx : s.x1,
    y1: back ? at(bx) : s.y1,
    x2: forward ? fx : s.x2,
    y2: forward ? at(fx) : s.y2,
  };
}

/** Estimated label box of a TEXT drawing (canvas text is not measured outside the renderer). */
export function textWidth(text: string): number {
  return text.length * 7 + 8;
}

export function shapeOf(d: Drawing, m: PixelMapper): Shape | null {
  const xs = d.anchors.map((a) => m.x(a.t));
  const ys = d.anchors.map((a) => m.y(a.p));
  if (d.kind === 'HLINE') return ys[0] == null ? null : { type: 'hline', y: ys[0] };
  if (d.kind === 'VLINE') return xs[0] == null ? null : { type: 'vline', x: xs[0] };
  if (ys.some((v) => v === null) || xs.some((v) => v === null)) return null;
  const x = xs as number[];
  const y = ys as number[];
  const seg: Seg = { x1: x[0]!, y1: y[0]!, x2: x[1] ?? x[0]!, y2: y[1] ?? y[0]! };
  switch (d.kind) {
    case 'HRAY':
      return { type: 'hray', x: x[0]!, y: y[0]! };
    case 'CROSSLINE':
      return { type: 'cross', x: x[0]!, y: y[0]! };
    case 'TEXT':
    case 'ARROW_UP':
    case 'ARROW_DOWN':
      return { type: 'point', x: x[0]!, y: y[0]! };
    case 'TRENDLINE':
    case 'ARROW':
      return { type: 'segment', ...seg };
    case 'RAY':
      return { type: 'segment', ...extend(seg, false, true, m.width) };
    case 'EXTENDED_LINE':
      return { type: 'segment', ...extend(seg, true, true, m.width) };
    case 'CHANNEL': {
      if (x.length < 3) return { type: 'segment', ...seg };
      const run = seg.x2 - seg.x1;
      const lineY = run === 0 ? seg.y1 : seg.y1 + ((seg.y2 - seg.y1) * (x[2]! - seg.x1)) / run;
      const off = y[2]! - lineY;
      return {
        type: 'channel',
        a: seg,
        b: { x1: seg.x1, y1: seg.y1 + off, x2: seg.x2, y2: seg.y2 + off },
      };
    }
    case 'FIB_RETRACEMENT':
    case 'FIB_EXTENSION': {
      const levels = fibLevels(null, d.kind, d.anchors).map((l) => ({
        ...l,
        y: m.y(l.price),
      }));
      if (levels.length === 0 || levels.some((l) => l.y === null)) {
        return { type: 'segment', ...seg };
      }
      const from = d.kind === 'FIB_EXTENSION' ? x[2]! : Math.min(seg.x1, seg.x2);
      const to =
        d.kind === 'FIB_EXTENSION' ? x[2]! + Math.abs(seg.x2 - seg.x1) : Math.max(seg.x1, seg.x2);
      return {
        type: 'fib',
        x1: from,
        x2: to,
        levels: levels as { level: number; price: number; y: number }[],
      };
    }
    case 'RECT':
    case 'ELLIPSE':
    case 'PRICE_RANGE':
    case 'DATE_RANGE':
    case 'DATE_PRICE_RANGE':
      return { type: 'box', ...seg };
    case 'POSITION_LONG':
    case 'POSITION_SHORT':
      return {
        type: 'position',
        x1: seg.x1,
        x2: seg.x2,
        yEntry: seg.y1,
        yStop: seg.y2,
        yTarget: y[2]!,
      };
  }
}

function distanceToSegment(p: Point, s: Seg) {
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

function hits(d: Drawing, shape: Shape, p: Point, width: number): boolean {
  const tol = HIT_TOLERANCE;
  switch (shape.type) {
    case 'hline':
      return Math.abs(p.y - shape.y) <= tol && p.x >= 0 && p.x <= width;
    case 'hray':
      return Math.abs(p.y - shape.y) <= tol && p.x >= shape.x - tol;
    case 'vline':
      return Math.abs(p.x - shape.x) <= tol;
    case 'cross':
      return Math.abs(p.x - shape.x) <= tol || Math.abs(p.y - shape.y) <= tol;
    case 'segment':
      return distanceToSegment(p, shape) <= tol;
    case 'channel': {
      const { a, b } = shape;
      if (distanceToSegment(p, a) <= tol || distanceToSegment(p, b) <= tol) return true;
      // Between the two lines, within their time span.
      if (p.x < Math.min(a.x1, a.x2) || p.x > Math.max(a.x1, a.x2) || a.x1 === a.x2) return false;
      const u = (p.x - a.x1) / (a.x2 - a.x1);
      const ya = a.y1 + u * (a.y2 - a.y1);
      const yb = b.y1 + u * (b.y2 - b.y1);
      return p.y >= Math.min(ya, yb) && p.y <= Math.max(ya, yb);
    }
    case 'fib': {
      const ys = shape.levels.map((l) => l.y);
      return inside(p, shape.x1, shape.x2, Math.min(...ys), Math.max(...ys), tol);
    }
    case 'box': {
      if (d.kind !== 'ELLIPSE') return inside(p, shape.x1, shape.x2, shape.y1, shape.y2, tol);
      const rx = Math.abs(shape.x2 - shape.x1) / 2 + tol;
      const ry = Math.abs(shape.y2 - shape.y1) / 2 + tol;
      const cx = (shape.x1 + shape.x2) / 2;
      const cy = (shape.y1 + shape.y2) / 2;
      return ((p.x - cx) / rx) ** 2 + ((p.y - cy) / ry) ** 2 <= 1;
    }
    case 'point':
      if (d.kind === 'TEXT') {
        const w = textWidth(d.text ?? '');
        return p.x >= shape.x - tol && p.x <= shape.x + w && Math.abs(p.y - shape.y) <= 10;
      }
      return Math.hypot(p.x - shape.x, p.y - shape.y) <= 12;
    case 'position':
      return inside(p, shape.x1, shape.x2, shape.yStop, shape.yTarget, tol);
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
    if (shape && hits(d, shape, p, m.width)) return d.id;
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
