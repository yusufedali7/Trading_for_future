import { describe, expect, it } from 'vitest';
import { sliceBars } from '../src/features/bars';
import { detectFvgs } from '../src/features/fvg';
import { detectIfvg } from '../src/features/ifvg';
import { getInstrument } from '../src/instruments/registry';
import { bars, randomWalk } from './helpers/synthetic-bars';

const EURUSD = getInstrument('EURUSD');
const P = { minSizePips: 0.1 };

// SYNTHETIC: a bullish FVG at bar2 (gap [1.1002, 1.1010], formed@1, confirmed@2), then a bar
// that closes fully below it. Bar1's low is deliberately far down so bar3's high never pairs
// with it into an unrelated bearish FVG.
const b = bars([
  [1.1, 1.1002, 1.0998, 1.1001],
  [1.1001, 1.1003, 1.095, 1.1002],
  [1.1011, 1.1012, 1.101, 1.1011],
  [1.099, 1.0992, 1.0988, 1.099],
]);

describe('detectIfvg (v1)', () => {
  it('fires when a later close fully crosses the far edge of a bullish FVG', () => {
    const fvgs = detectFvgs(b, EURUSD, P);
    expect(fvgs).toHaveLength(1);
    const found = detectIfvg(b, fvgs);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      type: 'IFVG',
      direction: 'BEARISH',
      top: fvgs[0]!.top,
      bottom: fvgs[0]!.bottom,
      sourceFvgId: fvgs[0]!.id,
      confirmedIndex: 3,
    });
  });

  it('does not fire while the gap has not been closed through yet', () => {
    const part = sliceBars(b, 3);
    const fvgs = detectFvgs(part, EURUSD, P);
    expect(fvgs).toHaveLength(1);
    expect(detectIfvg(part, fvgs)).toEqual([]);
  });

  it('is truncation invariant', () => {
    const w = randomWalk(300, 11);
    const fullFvgs = detectFvgs(w, EURUSD, { minSizePips: 0.5 });
    const full = detectIfvg(w, fullFvgs);
    for (let k = 0; k <= w.length; k += 23) {
      const part = sliceBars(w, k);
      const partFvgs = detectFvgs(part, EURUSD, { minSizePips: 0.5 });
      expect(detectIfvg(part, partFvgs)).toEqual(full.filter((d) => d.confirmedIndex < k));
    }
  });
});
