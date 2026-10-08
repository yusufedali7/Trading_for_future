import { describe, expect, it } from 'vitest';
import { sliceBars } from '../src/features/bars';
import { detectDisplacement } from '../src/features/displacement';
import { ORDER_BLOCK_DEFAULTS, detectOrderBlocks } from '../src/features/order-block';
import { detectStructureBreaks } from '../src/features/structure';
import { detectSwings } from '../src/features/swing';
import type { Displacement, StructureBreak } from '../src/features/types';
import { bars } from './helpers/synthetic-bars';

const BAR_MS = 15 * 60_000;
const T0 = Date.parse('2026-01-06T08:00:00Z');

/** A hand-built StructureBreak at bar index i, for testing detectOrderBlocks in isolation. */
function fakeBreak(i: number, direction: 'BULLISH' | 'BEARISH'): StructureBreak {
  return {
    id: `STRUCTURE_BREAK:fake:${i}`,
    defVersion: 'v1',
    type: 'STRUCTURE_BREAK',
    direction,
    kind: 'BOS',
    level: 0,
    swingId: 'SWING:fake',
    swingAt: T0,
    formedAt: T0 + i * BAR_MS,
    formedIndex: i,
    confirmedAt: T0 + (i + 1) * BAR_MS,
    confirmedIndex: i,
  };
}

function fakeDisplacement(i: number, direction: 'BULLISH' | 'BEARISH'): Displacement {
  return {
    id: `DISPLACEMENT:fake:${i}`,
    defVersion: 'v1',
    type: 'DISPLACEMENT',
    direction,
    body: 1,
    atr: 0.1,
    formedAt: T0 + i * BAR_MS,
    formedIndex: i,
    confirmedAt: T0 + (i + 1) * BAR_MS,
    confirmedIndex: i,
  };
}

describe('detectOrderBlocks (v1, isolated)', () => {
  // SYNTHETIC: bar2 bearish (the reference), bar3 bullish (the breaking/displacement bar).
  const b = bars([
    [10, 10.2, 9.8, 10.0],
    [10.0, 10.1, 9.9, 10.0],
    [10.0, 10.0, 9.5, 9.6], // bearish: reference candle
    [9.6, 10.65, 9.55, 10.6], // bullish break + displacement
  ]);

  it('zones the nearest opposite-coloured bar as BODY by default', () => {
    const brk = fakeBreak(3, 'BULLISH');
    const disp = fakeDisplacement(3, 'BULLISH');
    const found = detectOrderBlocks(b, [brk], [disp]);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      type: 'ORDER_BLOCK',
      direction: 'BULLISH',
      top: 10.0,
      bottom: 9.6,
      formedIndex: 2,
      confirmedIndex: 3,
      breakId: brk.id,
    });
  });

  it('zones the full high-low range when zone is RANGE', () => {
    const found = detectOrderBlocks(
      b,
      [fakeBreak(3, 'BULLISH')],
      [fakeDisplacement(3, 'BULLISH')],
      {
        ...ORDER_BLOCK_DEFAULTS,
        zone: 'RANGE',
      },
    );
    expect(found[0]).toMatchObject({ top: 10.0, bottom: 9.5 });
  });

  it('skips a break with no matching same-direction displacement', () => {
    expect(detectOrderBlocks(b, [fakeBreak(3, 'BULLISH')], [])).toEqual([]);
    expect(
      detectOrderBlocks(b, [fakeBreak(3, 'BULLISH')], [fakeDisplacement(3, 'BEARISH')]),
    ).toEqual([]);
  });

  it('skips when no opposite-coloured bar exists within lookbackBars', () => {
    const allBullish = bars([
      [10, 10.1, 9.9, 10.05],
      [10.05, 10.15, 9.95, 10.1],
      [10.1, 10.65, 10.0, 10.6],
    ]);
    const found = detectOrderBlocks(
      allBullish,
      [fakeBreak(2, 'BULLISH')],
      [fakeDisplacement(2, 'BULLISH')],
      { ...ORDER_BLOCK_DEFAULTS, lookbackBars: 1 },
    );
    expect(found).toEqual([]);
  });
});

describe('detectOrderBlocks (v1, end to end with real swings/breaks/displacement)', () => {
  const FILLER = [10, 10.05, 9.95, 10.0] as const;
  const rows: (readonly [number, number, number, number])[] = [
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
  ];
  const b = bars(rows);
  const swingP = { left: 3, right: 3 };
  const dispP = { minBodyAtr: 1.2, atrPeriod: 3 };

  it('finds the order block behind the real swing/structure-break/displacement pipeline', () => {
    const swings = detectSwings(b, swingP);
    const breaks = detectStructureBreaks(b, swings);
    expect(breaks).toHaveLength(1);
    expect(breaks[0]).toMatchObject({ direction: 'BULLISH', kind: 'BOS', level: 10.5 });

    const displacement = detectDisplacement(b, dispP);
    const found = detectOrderBlocks(b, breaks, displacement, {
      ...ORDER_BLOCK_DEFAULTS,
      lookbackBars: 5,
    });
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      direction: 'BULLISH',
      top: 10.0,
      bottom: 9.6,
      formedIndex: 9,
      confirmedIndex: 10,
      breakId: breaks[0]!.id,
    });
  });

  it('is truncation invariant', () => {
    const full = detectOrderBlocks(
      b,
      detectStructureBreaks(b, detectSwings(b, swingP)),
      detectDisplacement(b, dispP),
      { ...ORDER_BLOCK_DEFAULTS, lookbackBars: 5 },
    );
    for (let k = 0; k <= b.length; k++) {
      const part = sliceBars(b, k);
      const swings = detectSwings(part, swingP);
      const breaks = detectStructureBreaks(part, swings);
      const displacement = detectDisplacement(part, dispP);
      const got = detectOrderBlocks(part, breaks, displacement, {
        ...ORDER_BLOCK_DEFAULTS,
        lookbackBars: 5,
      });
      expect(got).toEqual(full.filter((d) => d.confirmedIndex < k));
    }
  });
});
