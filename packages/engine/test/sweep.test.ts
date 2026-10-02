import { describe, expect, it } from 'vitest';
import { sliceBars } from '../src/features/bars';
import { detectSwings } from '../src/features/swing';
import { detectSweeps, liquidityLevels } from '../src/features/sweep';
import type { LiquidityLevel, PeriodLevel } from '../src/features/types';
import { getInstrument } from '../src/instruments/registry';
import type { SessionLevels } from '../src/session/levels';
import { BAR_MS, T0, bars, randomWalk } from './helpers/synthetic-bars';

const EUR = getInstrument('EURUSD');
const at = (i: number) => T0 + i * BAR_MS;
const level = (o: Partial<LiquidityLevel>): LiquidityLevel => ({
  id: 'L',
  kind: 'PDH',
  side: 'HIGH',
  price: 1.1,
  knownAt: T0,
  validUntil: at(100),
  ...o,
});

describe('detectSweeps (v1)', () => {
  // SYNTHETIC [o, h, l, c]
  const b = bars([
    [1.099, 1.0995, 1.0985, 1.0992],
    [1.0992, 1.1004, 1.099, 1.0996], // wick above 1.1000, close back below → sweep of the high
    [1.0996, 1.1008, 1.0994, 1.1006], // above again, but the level is already taken
    [1.1006, 1.1007, 1.0975, 1.0985], // wick below 1.0980, close above → sweep of the low
  ]);

  it('reports a wick beyond a known level with a close back inside, once per level', () => {
    const s = detectSweeps(b, [
      level({ id: 'H' }),
      level({ id: 'L', kind: 'PDL', side: 'LOW', price: 1.098 }),
    ]);
    expect(s).toEqual([
      {
        id: `LIQUIDITY_SWEEP:v1:H:${at(1)}`,
        defVersion: 'v1',
        type: 'LIQUIDITY_SWEEP',
        direction: 'BEARISH',
        levelId: 'H',
        levelKind: 'PDH',
        level: 1.1,
        extreme: 1.1004,
        formedAt: at(1),
        formedIndex: 1,
        confirmedAt: at(2),
        confirmedIndex: 1,
      },
      expect.objectContaining({
        direction: 'BULLISH',
        levelId: 'L',
        extreme: 1.0975,
        formedIndex: 3,
      }),
    ]);
  });

  it('a close beyond the level is a break, not a sweep, and uses the level up', () => {
    const s = detectSweeps(b, [level({ price: 1.0995 })]); // bar 1 closes 1.0996 > 1.0995
    expect(s).toEqual([]);
  });

  it('ignores levels before they are known and after they expire', () => {
    expect(detectSweeps(b, [level({ knownAt: at(1) + 1 })])).toEqual([]);
    expect(detectSweeps(b, [level({ validUntil: at(1) })])).toEqual([]);
    // Known exactly when bar 1 opens: counts.
    expect(detectSweeps(b, [level({ knownAt: at(1) })])).toHaveLength(1);
  });
});

describe('liquidityLevels (v1)', () => {
  it('turns swings, previous day/week and finished sessions into levels', () => {
    const w = randomWalk(60, 3);
    const swings = detectSwings(w);
    const day: PeriodLevel = {
      id: 'PERIOD:v1:DAY:1',
      defVersion: 'v1',
      period: 'DAY',
      start: 0,
      end: 10,
      high: 1.2,
      low: 1.0,
      knownAt: 10,
      validUntil: 20,
    };
    const session = {
      sessionId: 'ASIA',
      startUtc: Date.parse('2026-01-06T00:00:00Z'),
      endUtc: Date.parse('2026-01-06T09:00:00Z'),
      high: 1.11,
      highAt: 0,
      low: 1.09,
      lowAt: 0,
      barCount: 10,
      complete: true,
      knownAt: Date.parse('2026-01-06T09:00:00Z'),
    } as SessionLevels;
    const running = { ...session, startUtc: session.startUtc + 86_400_000, complete: false };
    const levels = liquidityLevels(EUR, {
      swings,
      periods: [day],
      sessions: [session, running],
      barMs: BAR_MS,
    });
    expect(levels.filter((l) => l.kind === 'PDH' || l.kind === 'PDL')).toEqual([
      {
        id: 'PERIOD:v1:DAY:1:HIGH',
        kind: 'PDH',
        side: 'HIGH',
        price: 1.2,
        knownAt: 10,
        validUntil: 20,
      },
      {
        id: 'PERIOD:v1:DAY:1:LOW',
        kind: 'PDL',
        side: 'LOW',
        price: 1.0,
        knownAt: 10,
        validUntil: 20,
      },
    ]);
    // Asia levels last until the next Asia session starts (Wed 00:00Z); the running one is skipped.
    expect(levels.filter((l) => l.kind.startsWith('ASIA'))).toEqual([
      expect.objectContaining({
        kind: 'ASIA_HIGH',
        price: 1.11,
        validUntil: Date.parse('2026-01-07T00:00:00Z'),
      }),
      expect.objectContaining({ kind: 'ASIA_LOW', price: 1.09 }),
    ]);
    const firstSwing = swings[0]!;
    expect(levels.find((l) => l.id === firstSwing.id)).toMatchObject({
      knownAt: firstSwing.confirmedAt,
      validUntil: firstSwing.formedAt + 100 * BAR_MS,
    });
  });

  it('sweeps of swing levels are truncation invariant', () => {
    const w = randomWalk(500, 21);
    const sweepsOf = (x: typeof w) =>
      detectSweeps(
        x,
        liquidityLevels(EUR, { swings: detectSwings(x), periods: [], sessions: [], barMs: BAR_MS }),
      );
    const full = sweepsOf(w);
    expect(full.length).toBeGreaterThan(5);
    for (let k = 0; k <= w.length; k++) {
      expect(sweepsOf(sliceBars(w, k))).toEqual(full.filter((s) => s.confirmedIndex < k));
    }
  });
});
