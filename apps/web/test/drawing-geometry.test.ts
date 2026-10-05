import { describe, expect, it } from 'vitest';
import type { Drawing } from '@trw/engine';
import {
  handlesOf,
  hitTestDrawings,
  hitTestHandle,
  shapeOf,
  type PixelMapper,
} from '../src/chart/drawing-geometry';

// SYNTHETIC: x = t (ms) / 1000, y = round((2 - p) * 1000) (whole pixels), chart 800px wide.
const map: PixelMapper = { x: (t) => t / 1000, y: (p) => Math.round((2 - p) * 1000), width: 800 };

function d(id: string, kind: Drawing['kind'], anchors: Drawing['anchors']): Drawing {
  return {
    id,
    source: 'USER',
    kind,
    instrument: 'EURUSD',
    createdOnTimeframe: '15m',
    anchors,
    style: {},
    locked: false,
    hidden: false,
    createdAt: 0,
    updatedAt: 0,
  };
}

const hline = d('h', 'HLINE', [{ t: 100_000, p: 1.5 }]); // y = 500
const trend = d('t', 'TRENDLINE', [
  { t: 100_000, p: 1.9 }, // (100, 100)
  { t: 300_000, p: 1.7 }, // (300, 300)
]);
const rect = d('r', 'RECT', [
  { t: 400_000, p: 1.8 }, // (400, 200)
  { t: 500_000, p: 1.6 }, // (500, 400)
]);
const longPos = d('p', 'POSITION_LONG', [
  { t: 600_000, p: 1.5 }, // entry (600, 500)
  { t: 700_000, p: 1.45 }, // stop y = 550
  { t: 700_000, p: 1.6 }, // target y = 400
]);

describe('shapeOf', () => {
  it('maps a horizontal line across the full chart width', () => {
    expect(shapeOf(hline, map)).toEqual({ type: 'hline', y: 500 });
  });

  it('maps a position into target and stop zones', () => {
    expect(shapeOf(longPos, map)).toEqual({
      type: 'position',
      x1: 600,
      x2: 700,
      yEntry: 500,
      yStop: 550,
      yTarget: 400,
    });
  });

  it('returns null when a coordinate cannot be resolved', () => {
    expect(shapeOf(trend, { ...map, y: () => null })).toBeNull();
  });
});

describe('hitTestDrawings', () => {
  const all = [hline, trend, rect, longPos];

  it('hits a horizontal line anywhere along its length within tolerance', () => {
    expect(hitTestDrawings(all, { x: 790, y: 504 }, map)).toBe('h');
    expect(hitTestDrawings(all, { x: 790, y: 520 }, map)).toBeNull();
  });

  it('hits a trend line near the segment but not beyond its ends', () => {
    expect(hitTestDrawings(all, { x: 200, y: 203 }, map)).toBe('t');
    expect(hitTestDrawings(all, { x: 360, y: 360 }, map)).toBeNull();
  });

  it('hits inside a rectangle zone', () => {
    expect(hitTestDrawings(all, { x: 450, y: 300 }, map)).toBe('r');
  });

  it('hits inside a position tool', () => {
    expect(hitTestDrawings(all, { x: 650, y: 530 }, map)).toBe('p');
  });

  it('prefers the most recently drawn item when shapes overlap', () => {
    const top = d('top', 'RECT', [
      { t: 420_000, p: 1.75 },
      { t: 480_000, p: 1.65 },
    ]);
    expect(hitTestDrawings([...all, top], { x: 450, y: 300 }, map)).toBe('top');
  });

  it('ignores hidden drawings', () => {
    expect(hitTestDrawings([{ ...rect, hidden: true }], { x: 450, y: 300 }, map)).toBeNull();
  });
});

describe('handles', () => {
  it('exposes the anchor points of a trend line', () => {
    expect(handlesOf(trend, map)).toEqual([
      { index: 0, x: 100, y: 100 },
      { index: 1, x: 300, y: 300 },
    ]);
  });

  it('exposes entry, stop and target handles of a position', () => {
    expect(handlesOf(longPos, map)).toEqual([
      { index: 0, x: 600, y: 500 },
      { index: 1, x: 700, y: 550 },
      { index: 2, x: 700, y: 400 },
    ]);
  });

  it('finds the handle under the pointer', () => {
    expect(hitTestHandle(trend, { x: 297, y: 302 }, map)).toBe(1);
    expect(hitTestHandle(trend, { x: 200, y: 200 }, map)).toBeNull();
  });
});

describe('M7 tools', () => {
  it('a ray runs from the first point through the second to the right edge', () => {
    const ray = d('ray', 'RAY', [
      { t: 100_000, p: 1.9 }, // (100, 100)
      { t: 200_000, p: 1.8 }, // (200, 200)
    ]);
    expect(shapeOf(ray, map)).toEqual({ type: 'segment', x1: 100, y1: 100, x2: 800, y2: 800 });
    expect(hitTestDrawings([ray], { x: 600, y: 602 }, map)).toBe('ray');
    expect(hitTestDrawings([ray], { x: 50, y: 50 }, map)).toBeNull();
  });

  it('an extended line reaches both edges', () => {
    const ext = d('e', 'EXTENDED_LINE', [
      { t: 100_000, p: 1.9 },
      { t: 200_000, p: 1.8 },
    ]);
    expect(shapeOf(ext, map)).toEqual({ type: 'segment', x1: 0, y1: 0, x2: 800, y2: 800 });
    expect(hitTestDrawings([ext], { x: 50, y: 51 }, map)).toBe('e');
  });

  it('vertical line, horizontal ray and cross line hit along their own axes', () => {
    const v = d('v', 'VLINE', [{ t: 300_000, p: 1.5 }]);
    const r = d('r', 'HRAY', [{ t: 300_000, p: 1.5 }]);
    const c = d('c', 'CROSSLINE', [{ t: 300_000, p: 1.5 }]);
    expect(hitTestDrawings([v], { x: 303, y: 10 }, map)).toBe('v');
    expect(hitTestDrawings([r], { x: 700, y: 502 }, map)).toBe('r');
    expect(hitTestDrawings([r], { x: 200, y: 500 }, map)).toBeNull();
    expect(hitTestDrawings([c], { x: 300, y: 10 }, map)).toBe('c');
    expect(hitTestDrawings([c], { x: 10, y: 500 }, map)).toBe('c');
  });

  it('a parallel channel goes through the third point and hits between its lines', () => {
    const ch = d('ch', 'CHANNEL', [
      { t: 100_000, p: 1.9 }, // (100, 100)
      { t: 300_000, p: 1.7 }, // (300, 300)
      { t: 200_000, p: 1.75 }, // (200, 250): base line is at y 200 there → offset +50
    ]);
    expect(shapeOf(ch, map)).toEqual({
      type: 'channel',
      a: { x1: 100, y1: 100, x2: 300, y2: 300 },
      b: { x1: 100, y1: 150, x2: 300, y2: 350 },
    });
    expect(hitTestDrawings([ch], { x: 200, y: 225 }, map)).toBe('ch');
    expect(hitTestDrawings([ch], { x: 200, y: 280 }, map)).toBeNull();
  });

  it('fibonacci levels span the two points; a three-point tool shows its base line first', () => {
    const fib = d('f', 'FIB_RETRACEMENT', [
      { t: 100_000, p: 1.8 }, // (100, 200)
      { t: 300_000, p: 1.9 }, // (300, 100)
    ]);
    const s = shapeOf(fib, map)!;
    expect(s.type).toBe('fib');
    if (s.type !== 'fib') return;
    expect([s.x1, s.x2]).toEqual([100, 300]);
    expect(s.levels.find((l) => l.level === 0)!.y).toBe(100);
    expect(s.levels.find((l) => l.level === 1)!.y).toBe(200);
    expect(hitTestDrawings([fib], { x: 200, y: 150 }, map)).toBe('f');
    const ext = d('x', 'FIB_EXTENSION', fib.anchors);
    expect(shapeOf(ext, map)!.type).toBe('segment');
  });

  it('an ellipse is hit inside but not in the corner of its box', () => {
    const el = d('el', 'ELLIPSE', [
      { t: 100_000, p: 1.9 },
      { t: 300_000, p: 1.7 },
    ]);
    expect(hitTestDrawings([el], { x: 200, y: 200 }, map)).toBe('el');
    expect(hitTestDrawings([el], { x: 105, y: 105 }, map)).toBeNull();
  });

  it('text is hit over its label and arrow markers near their tip', () => {
    const text = { ...d('tx', 'TEXT', [{ t: 100_000, p: 1.5 }]), text: 'Londra' };
    expect(hitTestDrawings([text], { x: 130, y: 503 }, map)).toBe('tx');
    expect(hitTestDrawings([text], { x: 300, y: 500 }, map)).toBeNull();
    const up = d('u', 'ARROW_UP', [{ t: 100_000, p: 1.5 }]);
    expect(hitTestDrawings([up], { x: 102, y: 508 }, map)).toBe('u');
  });
});
