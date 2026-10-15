import { describe, expect, it } from 'vitest';
import { sliceBars } from '../../src/features/bars';
import { detectSwings } from '../../src/features/swing';
import type { Swing } from '../../src/features/types';
import {
  detectAbCd,
  detectAltBat,
  detectBat,
  detectButterfly,
  detectCrab,
  detectCypher,
  detectDeepCrab,
  detectGartley,
  detectShark,
} from '../../src/patterns/harmonic';
import { CHART_PIVOT_PARAMS } from '../../src/patterns/chart-shared';
import { randomWalk } from '../helpers/synthetic-bars';

const BAR_MS = 15 * 60_000;
const T0 = Date.parse('2026-01-06T08:00:00Z');

function fakeSwing(kind: 'HIGH' | 'LOW', price: number, formedIndex: number): Swing {
  return {
    id: `SWING:fake:${kind}:${price}:${formedIndex}`,
    defVersion: 'v1',
    type: 'SWING',
    kind,
    price,
    formedAt: T0 + formedIndex * BAR_MS,
    formedIndex,
    confirmedAt: T0 + (formedIndex + 1) * BAR_MS,
    confirmedIndex: formedIndex + 1,
  };
}

describe('detectGartley', () => {
  it('finds a bullish Gartley (X low, A high, B low, C high, D low) matching both catalog ratio sets', () => {
    const swings = [
      fakeSwing('LOW', 100, 0), // X
      fakeSwing('HIGH', 200, 10), // A (XA = 100)
      fakeSwing('LOW', 138.2, 20), // B (AB_XA = 0.618)
      fakeSwing('HIGH', 176.3924, 30), // C (BC_AB = 0.618)
      fakeSwing('LOW', 121.4, 40), // D (AD_XA = 0.786, CD_BC ≈ 1.44 - within both ratio sets)
    ];
    const found = detectGartley(swings);
    expect(found).toHaveLength(2); // both catalog ratio_sets match this geometry
    for (const f of found) {
      expect(f).toMatchObject({ patternId: 'gartley', direction: 'BULLISH' });
      expect(f.pivots.map((p) => p.label)).toEqual(['X', 'A', 'B', 'C', 'D']);
      expect(f.ratios.AD_XA).toBeCloseTo(0.786, 3);
    }
  });

  it('finds a bearish Gartley (mirror image)', () => {
    const swings = [
      fakeSwing('HIGH', 200, 0), // X
      fakeSwing('LOW', 100, 10), // A
      fakeSwing('HIGH', 161.8, 20), // B
      fakeSwing('LOW', 123.6076, 30), // C
      fakeSwing('HIGH', 178.6, 40), // D
    ];
    const found = detectGartley(swings);
    expect(found.length).toBeGreaterThan(0);
    expect(found[0]).toMatchObject({ patternId: 'gartley', direction: 'BEARISH' });
  });

  it('does not fire when AD_XA is far outside 0.786 (not a Gartley retracement)', () => {
    const swings = [
      fakeSwing('LOW', 100, 0),
      fakeSwing('HIGH', 200, 10),
      fakeSwing('LOW', 138.2, 20),
      fakeSwing('HIGH', 176.3924, 30),
      fakeSwing('LOW', 160, 40), // AD_XA = 0.4 - nowhere near 0.786
    ];
    expect(detectGartley(swings)).toEqual([]);
  });
});

describe('detectBat', () => {
  it('finds a bullish Bat (AB_XA 0.45, AD_XA 0.886)', () => {
    const swings = [
      fakeSwing('LOW', 100, 0), // X
      fakeSwing('HIGH', 200, 10), // A (XA = 100)
      fakeSwing('LOW', 155, 20), // B (AB_XA = 0.45)
      fakeSwing('HIGH', 182, 30), // C (BC_AB = 0.6)
      fakeSwing('LOW', 111.4, 40), // D (AD_XA = 0.886)
    ];
    const found = detectBat(swings);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ patternId: 'bat', direction: 'BULLISH' });
  });
});

describe('detectAltBat / detectCrab / detectDeepCrab / detectButterfly', () => {
  it('finds an alternate bat (AB_XA 0.382, AD_XA 1.13 - D beyond X)', () => {
    const swings = [
      fakeSwing('LOW', 100, 0),
      fakeSwing('HIGH', 200, 10), // XA = 100
      fakeSwing('LOW', 161.8, 20), // AB_XA = 0.382
      fakeSwing('HIGH', 194.27, 30), // BC_AB = 0.85
      fakeSwing('LOW', 87, 40), // AD_XA = 1.13
    ];
    const found = detectAltBat(swings);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ patternId: 'alt_bat', direction: 'BULLISH' });
  });

  it('finds a crab (AB_XA 0.5, AD_XA 1.618 - deep completion beyond X)', () => {
    const swings = [
      fakeSwing('LOW', 100, 0),
      fakeSwing('HIGH', 200, 10), // XA = 100
      fakeSwing('LOW', 150, 20), // AB_XA = 0.5
      fakeSwing('HIGH', 193, 30), // BC_AB = 0.86
      fakeSwing('LOW', 38.2, 40), // AD_XA = 1.618
    ];
    const found = detectCrab(swings);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ patternId: 'crab', direction: 'BULLISH' });
  });

  it('finds a deep crab (AB_XA fixed 0.886)', () => {
    const swings = [
      fakeSwing('LOW', 100, 0),
      fakeSwing('HIGH', 200, 10), // XA = 100
      fakeSwing('LOW', 111.4, 20), // AB_XA = 0.886
      fakeSwing('HIGH', 161.4, 30), // BC_AB = 0.565 within range
      fakeSwing('LOW', 38.2, 40), // AD_XA = 1.618
    ];
    const found = detectDeepCrab(swings);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ patternId: 'deep_crab', direction: 'BULLISH' });
  });

  it('finds a butterfly (AB_XA fixed 0.786, AD_XA 1.27-1.41)', () => {
    const swings = [
      fakeSwing('LOW', 100, 0),
      fakeSwing('HIGH', 200, 10), // XA = 100
      fakeSwing('LOW', 121.4, 20), // AB_XA = 0.786
      fakeSwing('HIGH', 160, 30), // BC_AB ≈ 0.49 within range
      fakeSwing('LOW', 65, 40), // AD_XA = 1.35
    ];
    const found = detectButterfly(swings);
    expect(found.length).toBeGreaterThan(0);
    for (const f of found)
      expect(f).toMatchObject({ patternId: 'butterfly', direction: 'BULLISH' });
  });
});

describe('detectCypher', () => {
  it('finds a bullish Cypher: C extends beyond A, D at 0.786 of XC (literal XD/XC reading)', () => {
    const swings = [
      fakeSwing('LOW', 100, 0), // X
      fakeSwing('HIGH', 200, 10), // A (XA = 100)
      fakeSwing('LOW', 150, 20), // B (AB_XA = 0.5)
      fakeSwing('HIGH', 235, 30), // C (XC_XA = 1.35, beyond A)
      fakeSwing('LOW', 206.11, 40), // D (XD_XC = 0.786)
    ];
    const found = detectCypher(swings);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ patternId: 'cypher', direction: 'BULLISH' });
  });

  it('does not fire when C does not extend beyond A', () => {
    const swings = [
      fakeSwing('LOW', 100, 0),
      fakeSwing('HIGH', 200, 10),
      fakeSwing('LOW', 150, 20),
      fakeSwing('HIGH', 190, 30), // C below A - not a real Cypher
      fakeSwing('LOW', 161.26, 40),
    ];
    expect(detectCypher(swings)).toEqual([]);
  });
});

describe('detectShark (D78)', () => {
  // SYNTHETIC: a bullish Shark 0(low) X(high) A(low) B(high, beyond X) C(low, back near 0).
  const bullish = [
    fakeSwing('LOW', 100, 0), // 0
    fakeSwing('HIGH', 110, 10), // X (0X = 10)
    fakeSwing('LOW', 105, 20), // A (XA = 5)
    fakeSwing('HIGH', 111.5, 30), // B (AB = 6.5 = 1.3 × XA, beyond X)
    fakeSwing('LOW', 100, 40), // C (BC = 11.5 = 1.77 × AB; X→C = 10 = 1.0 × 0X)
  ];

  it('finds a bullish Shark from the three cross-checked ratios, labelled 0-X-A-B-C', () => {
    const found = detectShark(bullish);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ patternId: 'shark', direction: 'BULLISH', formedIndex: 40 });
    expect(found[0]!.pivots.map((p) => p.label)).toEqual(['0', 'X', 'A', 'B', 'C']);
    expect(found[0]!.ratios.AB_XA).toBeCloseTo(1.3, 9);
    expect(found[0]!.ratios.BC_AB).toBeCloseTo(1.769231, 5);
    expect(found[0]!.ratios.XC_0X).toBeCloseTo(1.0, 9);
  });

  it('mirrors for a bearish Shark', () => {
    const bearish = bullish.map((s) =>
      fakeSwing(s.kind === 'HIGH' ? 'LOW' : 'HIGH', 300 - s.price, s.formedIndex),
    );
    expect(detectShark(bearish)).toMatchObject([{ patternId: 'shark', direction: 'BEARISH' }]);
  });

  it('needs B beyond X (AB at least 1.13 × XA)', () => {
    const notBeyond = [...bullish];
    notBeyond[3] = fakeSwing('HIGH', 109, 30); // AB = 0.8 × XA
    expect(detectShark(notBeyond)).toEqual([]);
  });

  it('needs C at 0.886–1.13 of 0X', () => {
    const shallow = [...bullish];
    shallow[4] = fakeSwing('LOW', 104, 40); // X→C = 6 = 0.6 × 0X (BC_AB = 1.15 also off)
    expect(detectShark(shallow)).toEqual([]);
  });

  it('does not apply the single-source first-leg ratio (XA/0X 0.5–0.886)', () => {
    // XA/0X = 0.45: outside djoffrey's 0.5–0.886 (± 5%), but Carney/LuxAlgo/HowToTrade set no
    // first-leg ratio, so the pattern still counts.
    const s = [
      fakeSwing('LOW', 100, 0),
      fakeSwing('HIGH', 110, 10),
      fakeSwing('LOW', 105.5, 20), // XA = 4.5
      fakeSwing('HIGH', 112.25, 30), // AB = 6.75 = 1.5 × XA
      fakeSwing('LOW', 98.75, 40), // BC = 13.5 = 2.0 × AB; X→C = 11.25 = 1.125 × 0X
    ];
    expect(detectShark(s)).toHaveLength(1);
  });
});

describe('detectAbCd', () => {
  it('finds a bullish AB=CD (A high, B low, C high, D low, CD ≈ AB)', () => {
    const swings = [
      fakeSwing('HIGH', 200, 0), // A
      fakeSwing('LOW', 100, 10), // B (AB = 100)
      fakeSwing('HIGH', 150, 20), // C (BC_AB = 0.5)
      fakeSwing('LOW', 50, 30), // D (CD = 100, CD_AB = 1.0)
    ];
    const found = detectAbCd(swings);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ patternId: 'ab_cd', direction: 'BULLISH' });
    expect(found[0]!.pivots.map((p) => p.label)).toEqual(['A', 'B', 'C', 'D']);
  });

  it('does not fire when CD is far from AB in length', () => {
    const swings = [
      fakeSwing('HIGH', 200, 0),
      fakeSwing('LOW', 100, 10),
      fakeSwing('HIGH', 150, 20),
      fakeSwing('LOW', 120, 30), // CD = 30, CD_AB = 0.3 - not ≈ 1.0
    ];
    expect(detectAbCd(swings)).toEqual([]);
  });
});

describe('no lookahead (all harmonic detectors together)', () => {
  it('cutting the data never changes an already-confirmed detection', () => {
    const w = randomWalk(1500, 61, 1.1, 9);
    const all = (bb: ReturnType<typeof sliceBars>) => {
      const s = detectSwings(bb, CHART_PIVOT_PARAMS);
      return [
        ...detectGartley(s),
        ...detectButterfly(s),
        ...detectBat(s),
        ...detectAltBat(s),
        ...detectCrab(s),
        ...detectDeepCrab(s),
        ...detectCypher(s),
        ...detectAbCd(s),
        ...detectShark(s),
      ];
    };
    const full = all(w);
    for (let k = 20; k <= w.length; k += 67) {
      const cut = all(sliceBars(w, k));
      expect(cut).toEqual(full.filter((d) => d.confirmedIndex < k));
    }
  });
});
