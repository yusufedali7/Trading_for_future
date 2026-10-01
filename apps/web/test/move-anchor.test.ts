import { describe, expect, it } from 'vitest';
import type { Drawing } from '@trw/engine';
import { moveAnchor } from '../src/chart/use-drawing-layer';

// SYNTHETIC drawings for handle-drag rules.
function d(kind: Drawing['kind'], anchors: Drawing['anchors']): Drawing {
  return {
    id: 'x',
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

describe('moveAnchor', () => {
  it('moves only the price of a horizontal line', () => {
    const out = moveAnchor(d('HLINE', [{ t: 10, p: 1.1 }]), 0, { t: 99, p: 1.2 });
    expect(out.anchors).toEqual([{ t: 10, p: 1.2 }]);
  });

  it('moves the dragged end of a trend line', () => {
    const line = d('TRENDLINE', [
      { t: 1, p: 1 },
      { t: 2, p: 2 },
    ]);
    expect(moveAnchor(line, 1, { t: 3, p: 3 }).anchors).toEqual([
      { t: 1, p: 1 },
      { t: 3, p: 3 },
    ]);
  });

  it('keeps stop and target of a position on the same end time', () => {
    const pos = d('POSITION_LONG', [
      { t: 0, p: 1.085 },
      { t: 10, p: 1.083 },
      { t: 10, p: 1.089 },
    ]);
    expect(moveAnchor(pos, 1, { t: 20, p: 1.082 }).anchors).toEqual([
      { t: 0, p: 1.085 },
      { t: 20, p: 1.082 },
      { t: 20, p: 1.089 },
    ]);
  });

  it('does not mutate the original drawing', () => {
    const line = d('TRENDLINE', [
      { t: 1, p: 1 },
      { t: 2, p: 2 },
    ]);
    moveAnchor(line, 0, { t: 5, p: 5 });
    expect(line.anchors[0]).toEqual({ t: 1, p: 1 });
  });
});
