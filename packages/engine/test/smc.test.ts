import { describe, expect, it } from 'vitest';
import { sliceBars } from '../src/features/bars';
import { SMC_DEFAULTS, computeSmc, smcAsOf } from '../src/features/smc';
import { getInstrument } from '../src/instruments/registry';
import { bars, randomWalk } from './helpers/synthetic-bars';

const EURUSD = getInstrument('EURUSD');

describe('computeSmc (v1)', () => {
  it('produces candidates of every kind that does not need an outsized bar, on a random walk', () => {
    // SYNTHETIC randomWalk's step size is too uniform to ever produce a genuine displacement
    // bar at the default 1.5x-ATR threshold (checked empirically); displacement/order_block/
    // breaker are covered by the dedicated fixture below instead.
    const w = randomWalk(1000, 3);
    const s = computeSmc(w, EURUSD);
    expect(s.ifvgs.length).toBeGreaterThan(0);
    expect(s.equalLevels.length).toBeGreaterThan(0);
    expect(s.premiumDiscount.length).toBeGreaterThan(0);
    expect(s.ote.length).toBeGreaterThan(0);
    expect(s.candidateSr.length).toBeGreaterThan(0);
  });

  it('wires displacement -> order block -> breaker together end to end', () => {
    const FILLER = [10, 10.05, 9.95, 10.0] as const;
    const b = bars([
      FILLER,
      FILLER,
      FILLER,
      [10.0, 10.5, 9.95, 10.02], // swing high (tiny body, big upper wick)
      FILLER,
      FILLER,
      FILLER,
      FILLER,
      FILLER,
      [10.0, 10.0, 9.5, 9.6], // bearish: the order block reference
      [9.6, 10.65, 9.55, 10.6], // bullish break (closes above 10.5) + displacement
      [10.6, 10.65, 10.55, 10.6],
      [10.6, 10.65, 10.55, 10.6],
      [10.6, 10.65, 9.0, 9.3], // closes below the order block's bottom (9.6) -> breaker
    ]);
    const p = { ...SMC_DEFAULTS, displacement: { minBodyAtr: 1.2, atrPeriod: 3 } };
    const s = computeSmc(b, EURUSD, p);
    expect(s.displacements.some((d) => d.formedIndex === 10)).toBe(true);
    // The bullish order block behind the bar-10 break; bar13's own bearish break+displacement
    // incidentally creates a second, unrelated order block, which this test does not care about.
    const ob = s.orderBlocks.find((x) => x.confirmedIndex === 10);
    expect(ob).toMatchObject({ direction: 'BULLISH', top: 10.0, bottom: 9.6 });
    const breaker = s.breakers.find((x) => x.sourceOrderBlockId === ob!.id);
    expect(breaker).toMatchObject({ direction: 'BEARISH', confirmedIndex: 13 });
  });

  it('is truncation invariant end to end (every concept together)', () => {
    const w = randomWalk(500, 41);
    const full = computeSmc(w, EURUSD);
    for (let k = 0; k <= w.length; k += 37) {
      const part = computeSmc(sliceBars(w, k), EURUSD);
      const cutoff = w.end[k - 1] ?? -Infinity;
      expect(part).toEqual(smcAsOf(full, cutoff));
    }
  });
});
