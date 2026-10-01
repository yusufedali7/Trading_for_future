import { describe, expect, it } from 'vitest';
import { isClick, isInPane } from '../src/chart/pointer-click';

describe('isClick', () => {
  it('treats a press and release at (almost) the same spot as a click', () => {
    expect(isClick({ x: 10, y: 10 }, { x: 12, y: 11 })).toBe(true);
  });

  it('treats movement of 4px or more as a drag, not a click', () => {
    expect(isClick({ x: 10, y: 10 }, { x: 14, y: 10 })).toBe(false);
  });

  it('does not depend on time: two quick clicks far apart are two clicks', () => {
    // Lightweight Charts drops the second of two clicks within ~500 ms (DECISIONS D25).
    expect(isClick({ x: 10, y: 10 }, { x: 10, y: 10 })).toBe(true);
    expect(isClick({ x: 200, y: 50 }, { x: 201, y: 50 })).toBe(true);
  });
});

describe('isInPane', () => {
  it('accepts points inside the price pane and rejects the price scale, time axis and other panes', () => {
    const pane = { width: 300, height: 200 };
    expect(isInPane({ x: 10, y: 10 }, pane)).toBe(true);
    expect(isInPane({ x: 305, y: 10 }, pane)).toBe(false);
    expect(isInPane({ x: 10, y: 205 }, pane)).toBe(false);
    expect(isInPane({ x: -1, y: 10 }, pane)).toBe(false);
  });
});
