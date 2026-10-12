import { describe, expect, it } from 'vitest';
import {
  draftFor,
  findConflicts,
  isWatchable,
  MIN_WATCHABLE_STATUS,
  type SignalDraft,
} from '../src/live/signal-draft';
import type { Setup } from '../src/strategy/matcher';
import { defaultSpec, type StrategySpec } from '../src/strategy/schema';
import { EUR, MIN } from './helpers/synthetic-minutes';

const T0 = Date.parse('2026-01-06T10:00:00Z');

// SYNTHETIC: a minimal Setup as if `findSetups` had already matched a sweep step.
function setup(
  signalAt: number,
  refs: Record<string, number> = { 'sweep.extreme': 1.0985 },
): Setup {
  return {
    id: `SETUP:sw@${signalAt}`,
    steps: [
      {
        stepId: 'sweep',
        detectionId: `sw@${signalAt}`,
        formedAt: signalAt - MIN,
        confirmedAt: signalAt,
        confirmedIndex: 10,
      },
    ],
    signalIndex: 10,
    signalBarAt: signalAt - MIN,
    signalAt,
    refs,
  };
}

const lotRules = { lotStep: 0.01, minLot: 0.01 };

describe('isWatchable (D68)', () => {
  it('requires at least MIN_WATCHABLE_STATUS', () => {
    expect(MIN_WATCHABLE_STATUS).toBe('TESTING');
    expect(isWatchable('IDEA')).toBe(false);
    expect(isWatchable('RESEARCH')).toBe(false);
    expect(isWatchable('TESTING')).toBe(true);
    expect(isWatchable('VALIDATED_ON_SAMPLE')).toBe(true);
    expect(isWatchable('LIVE_CANDIDATE')).toBe(true);
  });
});

describe('draftFor (D68)', () => {
  const spec: StrategySpec = {
    ...defaultSpec(),
    entry: { type: 'MARKET' },
    stop: { type: 'BEYOND_REF', ref: 'sweep.extreme', bufferPips: 1 },
    target: { type: 'R_MULTIPLE', r: 2 },
    risk: { percentPerTrade: 1 },
  };

  it('turns a setup into a draft with order/lots/expiry, reusing orderFor/positionSize exactly', () => {
    const s = setup(T0);
    const result = draftFor(spec, 'strat1', 3, EUR, s, 1.1, 10_000, lotRules);
    expect('draft' in result).toBe(true);
    const d = (result as { draft: SignalDraft }).draft;
    expect(d).toMatchObject({
      id: 'strat1:3:SETUP:sw@' + T0,
      strategyId: 'strat1',
      strategyVersion: 3,
      instrument: 'EURUSD',
      direction: 'LONG',
      setupId: s.id,
      createdAt: T0,
    });
    expect(d.order.stop).toBeCloseTo(1.0985 - 0.0001, 6); // sweep.extreme - 1 pip buffer
    expect(d.lots).toBeGreaterThan(0);
    // MARKET entry: order.expiresAt is null (backtest semantics), reinterpreted as "one bar".
    expect(d.order.expiresAt).toBeNull();
    expect(d.expiresAt).toBe(T0 + 15 * 60_000); // defaultSpec's timeframe is 15m
  });

  it('a pending LIMIT entry keeps its own real expiresAt as the draft deadline', () => {
    const limitSpec: StrategySpec = {
      ...spec,
      entry: { type: 'LIMIT_AT', ref: 'sweep.extreme', expireBars: 4 },
    };
    const s = setup(T0, { 'sweep.extreme': 1.0985 });
    const result = draftFor(limitSpec, 'strat1', 1, EUR, s, 1.1, 10_000, lotRules);
    const d = (result as { draft: SignalDraft }).draft;
    expect(d.order.expiresAt).toBe(T0 + 4 * 15 * 60_000);
    expect(d.expiresAt).toBe(d.order.expiresAt);
  });

  it('reports INVALID_ORDER when the stop lands on the wrong side of the entry', () => {
    const badSpec: StrategySpec = {
      ...spec,
      stop: { type: 'BEYOND_REF', ref: 'sweep.extreme', bufferPips: -1000 }, // stop above entry for a long
    };
    const result = draftFor(badSpec, 'strat1', 1, EUR, setup(T0), 1.1, 10_000, lotRules);
    expect(result).toEqual({ skipped: 'INVALID_ORDER' });
  });

  it('reports SIZE_TOO_SMALL when the risk budget cannot afford even one lot step', () => {
    const result = draftFor(spec, 'strat1', 1, EUR, setup(T0), 1.1, 1, lotRules);
    expect(result).toEqual({ skipped: 'SIZE_TOO_SMALL' });
  });
});

describe('findConflicts (D68)', () => {
  const draft = (over: Partial<SignalDraft>): SignalDraft => ({
    id: over.id ?? 'x',
    strategyId: 's',
    strategyVersion: 1,
    instrument: 'EURUSD',
    direction: 'LONG',
    setupId: 'setup',
    conditions: [],
    order: {
      direction: 'LONG',
      type: 'MARKET',
      placedAt: T0,
      referencePrice: 1.1,
      stop: 1.09,
      target: 1.12,
      expiresAt: null,
    },
    lots: 1,
    riskAmount: 100,
    createdAt: T0,
    expiresAt: T0 + 1_000_000,
    ...over,
  });

  it('flags two active drafts on the same instrument with opposite directions', () => {
    const a = draft({ id: 'a', direction: 'LONG' });
    const b = draft({ id: 'b', direction: 'SHORT' });
    expect(findConflicts([a, b], T0)).toEqual([{ a: 'a', b: 'b', instrument: 'EURUSD' }]);
  });

  it('does not flag the same direction, a different instrument, or an expired draft', () => {
    const a = draft({ id: 'a', direction: 'LONG' });
    const sameDir = draft({ id: 'b', direction: 'LONG' });
    expect(findConflicts([a, sameDir], T0)).toEqual([]);

    const otherInst = draft({ id: 'c', direction: 'SHORT', instrument: 'GBPUSD' });
    expect(findConflicts([a, otherInst], T0)).toEqual([]);

    const expired = draft({ id: 'd', direction: 'SHORT', expiresAt: T0 - 1 });
    expect(findConflicts([a, expired], T0)).toEqual([]);
  });
});
