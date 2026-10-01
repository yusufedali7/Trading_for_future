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
