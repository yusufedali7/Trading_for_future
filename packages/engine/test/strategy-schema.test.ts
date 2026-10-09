import { describe, expect, it } from 'vitest';
import {
  availableRefs,
  canonicalJson,
  defaultSpec,
  newVersion,
  referencedSessionIds,
  setVersionStatus,
  specHash,
  specWarnings,
  validateSpec,
  type StrategySpec,
} from '../src/strategy/schema';
import { LONDON_SWEEP } from './helpers/strategies';

const codes = (s: StrategySpec) => validateSpec(s).map((p) => `${p.code}@${p.path}`);

describe('strategy schema v1', () => {
  it('accepts the default and a multi-step strategy', () => {
    expect(validateSpec(defaultSpec())).toEqual([]);
    expect(validateSpec(LONDON_SWEEP)).toEqual([]);
    expect(availableRefs(LONDON_SWEEP.steps)).toEqual([
      'sweep.level',
      'sweep.extreme',
      'mss.level',
      'fvg.top',
      'fvg.bottom',
      'fvg.mid',
    ]);
  });

  it('names every problem with its place in the spec', () => {
    const bad: StrategySpec = {
      ...LONDON_SWEEP,
      instrument: 'XYZ',
      steps: [
        { id: 'Sweep', type: 'LIQUIDITY_SWEEP' },
        { id: 'mss', type: 'STRUCTURE_BREAK' },
        { id: 'mss', type: 'FVG', maxBars: 0 },
      ],
      entry: { type: 'LIMIT_AT', ref: 'fvg.top', expireBars: 0 },
      stop: { type: 'BEYOND_REF', ref: 'later.low', bufferPips: -1 },
      target: { type: 'R_MULTIPLE', r: 0 },
      risk: { percentPerTrade: 6 },
      window: { start: '25:00', end: '11:00', tz: 'Europe/London' },
      maxTradesPerDay: 0,
    };
    expect(codes(bad)).toEqual([
      'UNKNOWN_INSTRUMENT@instrument',
      'BAD_STEP_ID@steps.0.id',
      'MAX_BARS@steps.1.maxBars',
      'DUPLICATE_STEP_ID@steps.2.id',
      'MAX_BARS@steps.2.maxBars',
      'BAD_REF@entry.ref',
      'EXPIRE_BARS@entry.expireBars',
      'BAD_REF@stop.ref',
      'BAD_NUMBER@stop.bufferPips',
      'BAD_NUMBER@target.r',
      'RISK_RANGE@risk.percentPerTrade',
      'BAD_WINDOW@window',
      'MAX_PER_DAY@maxTradesPerDay',
    ]);
    expect(codes({ ...defaultSpec(), steps: [] })).toContain('NO_STEPS@steps');
  });

  it('warns about a step against the trade direction', () => {
    const s: StrategySpec = {
      ...LONDON_SWEEP,
      steps: [
        LONDON_SWEEP.steps[0]!,
        { id: 'mss', type: 'STRUCTURE_BREAK', direction: 'BEARISH', maxBars: 5 },
      ],
      entry: { type: 'MARKET' },
    };
    expect(specWarnings(s)).toEqual([{ code: 'DIRECTION_MISMATCH', path: 'steps.1.direction' }]);
  });

  it('accepts the SMC step types (D58) and exposes their refs, including OTE.sweetSpot', () => {
    const s: StrategySpec = {
      ...LONDON_SWEEP,
      steps: [
        { id: 'ob', type: 'ORDER_BLOCK', direction: 'BULLISH' },
        { id: 'ifvg', type: 'IFVG', maxBars: 5 },
        { id: 'brk', type: 'BREAKER', maxBars: 5 },
        { id: 'ote', type: 'OTE', maxBars: 5 },
      ],
      entry: { type: 'MARKET' },
      stop: { type: 'FIXED_PIPS', pips: 10 },
      target: { type: 'AT_REF', ref: 'ote.sweetSpot', bufferPips: 0 },
    };
    expect(validateSpec(s)).toEqual([]);
    expect(availableRefs(s.steps)).toEqual([
      'ob.top',
      'ob.bottom',
      'ob.mid',
      'ifvg.top',
      'ifvg.bottom',
      'ifvg.mid',
      'brk.top',
      'brk.bottom',
      'brk.mid',
      'ote.top',
      'ote.bottom',
      'ote.mid',
      'ote.sweetSpot',
    ]);
    const warned: StrategySpec = {
      ...s,
      direction: 'SHORT',
      steps: [{ id: 'ob', type: 'ORDER_BLOCK', direction: 'BULLISH' }],
    };
    expect(specWarnings(warned)).toEqual([
      { code: 'DIRECTION_MISMATCH', path: 'steps.0.direction' },
    ]);
  });

  it('hashes the content, not the key order', () => {
    const reordered = JSON.parse(canonicalJson(LONDON_SWEEP)) as StrategySpec;
    const { schema, ...rest } = LONDON_SWEEP;
    expect(specHash({ ...rest, schema } as StrategySpec)).toBe(specHash(LONDON_SWEEP));
    expect(specHash(reordered)).toBe(specHash(LONDON_SWEEP));
    expect(specHash({ ...LONDON_SWEEP, risk: { percentPerTrade: 1 } })).not.toBe(
      specHash(LONDON_SWEEP),
    );
    expect(specHash(LONDON_SWEEP)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('creates numbered immutable versions; only the status changes later', () => {
    const strategy = {
      id: 's1',
      name: 'Londra süpürme',
      description: '',
      latestVersion: 2,
      createdAt: 1,
      updatedAt: 1,
    };
    const v = newVersion(strategy, LONDON_SWEEP, 'ilk deneme', 100);
    expect(v).toMatchObject({ strategyId: 's1', version: 3, status: 'IDEA', createdAt: 100 });
    expect(v.spec).not.toBe(LONDON_SWEEP);
    expect(v.specHash).toBe(specHash(LONDON_SWEEP));
    const t = setVersionStatus(v, 'TESTING', 200, 'backtest başladı');
    expect(t.statusHistory).toEqual([
      { status: 'IDEA', at: 100 },
      { status: 'TESTING', at: 200, note: 'backtest başladı' },
    ]);
    expect(t.spec).toBe(v.spec);
    expect(() => newVersion(strategy, { ...LONDON_SWEEP, steps: [] }, '', 1)).toThrow(/NO_STEPS/);
  });
});

describe('user sessions in a strategy (D35)', () => {
  const ict = {
    id: 'ICT_ASIA',
    name: 'ICT Asya aralığı',
    tz: 'America/New_York',
    start: '20:00' as const,
    end: '00:00' as const,
    days: [7, 1, 2, 3, 4],
    version: 1,
  };
  const withIct: StrategySpec = {
    ...LONDON_SWEEP,
    steps: [
      {
        id: 'sweep',
        type: 'LIQUIDITY_SWEEP',
        direction: 'BULLISH',
        levels: ['ICT_ASIA_LOW', 'PDL'],
      },
      ...LONDON_SWEEP.steps.slice(1),
    ],
  };

  it('requires a copy of every user session a sweep level refers to', () => {
    expect(referencedSessionIds(withIct.steps)).toEqual(['ICT_ASIA']);
    expect(referencedSessionIds(LONDON_SWEEP.steps)).toEqual([]);
    expect(validateSpec(withIct).map((p) => `${p.code}@${p.path}`)).toEqual([
      'UNKNOWN_LEVEL@steps.0.levels',
    ]);
    expect(validateSpec({ ...withIct, sessions: [ict] })).toEqual([]);
    expect(
      validateSpec({ ...withIct, sessions: [{ ...ict, id: 'ASIA' }] }).map((p) => p.code),
    ).toEqual(['BAD_SESSION', 'UNKNOWN_LEVEL']);
  });

  it('keeps the hash of specs saved before sessions existed', () => {
    expect(specHash({ ...LONDON_SWEEP, sessions: undefined })).toBe(specHash(LONDON_SWEEP));
    expect(specHash({ ...withIct, sessions: [ict] })).not.toBe(
      specHash({ ...withIct, sessions: [{ ...ict, start: '19:00' }] }),
    );
  });
});
