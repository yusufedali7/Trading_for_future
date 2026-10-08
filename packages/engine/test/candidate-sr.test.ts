import { describe, expect, it } from 'vitest';
import { sliceBars } from '../src/features/bars';
import { detectCandidateSr } from '../src/features/candidate-sr';
import { detectSwings } from '../src/features/swing';
import { bars, randomWalk } from './helpers/synthetic-bars';

const swingP = { left: 1, right: 1 };
const P = { clusterToleranceAtr: 1.0, minTouches: 3, lookbackBars: 500, atrPeriod: 2 };

// SYNTHETIC: three swing highs clustered close together (10.50, 10.52, 10.49).
const b = bars([
  [10, 10.0, 9.9, 10.0],
  [10, 10.5, 9.9, 10.1], // confirmed@2
  [10, 10.0, 9.9, 10.0],
  [10, 10.52, 9.9, 10.1], // confirmed@4
  [10, 10.0, 9.9, 10.0],
  [10, 10.49, 9.9, 10.1], // confirmed@6
  [10, 10.0, 9.9, 10.0],
]);

describe('detectCandidateSr (v1)', () => {
  it('emits a zone once a cluster reaches minTouches', () => {
    const swings = detectSwings(b, swingP);
    expect(swings).toHaveLength(3);
    const found = detectCandidateSr(b, swings, P);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      type: 'CANDIDATE_SR',
      top: 10.52,
      bottom: 10.49,
      touches: 3,
      formedIndex: swings[0]!.formedIndex,
      confirmedIndex: swings[2]!.confirmedIndex,
      swingIds: [swings[0]!.id, swings[1]!.id, swings[2]!.id],
    });
  });

  it('does not emit below minTouches', () => {
    const swings = detectSwings(b, swingP).slice(0, 2);
    expect(detectCandidateSr(b, swings, P)).toEqual([]);
  });

  it('is truncation invariant', () => {
    const w = randomWalk(300, 29);
    const swings = detectSwings(w);
    const full = detectCandidateSr(w, swings);
    for (let k = 0; k <= w.length; k += 23) {
      const part = sliceBars(w, k);
      const partSwings = detectSwings(part);
      expect(detectCandidateSr(part, partSwings)).toEqual(full.filter((d) => d.confirmedIndex < k));
    }
  });
});
