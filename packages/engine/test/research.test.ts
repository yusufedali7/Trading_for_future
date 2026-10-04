import { describe, expect, it } from 'vitest';
import {
  conclude,
  oosState,
  recordOos,
  reopen,
  validateHypothesis,
  type Hypothesis,
} from '../src/research/hypothesis';
import { applyParam, sweepGrid, sweepableParams } from '../src/research/sweep';
import { specHash } from '../src/strategy/schema';
import { LONDON_SWEEP } from './helpers/strategies';

describe('parameter sweep', () => {
  it('lists only the parameters the rules use', () => {
    expect(sweepableParams(LONDON_SWEEP).map((p) => `${p.id}=${p.current}`)).toEqual([
      'target.r=2',
      'stop.bufferPips=1',
      'entry.expireBars=8',
      'steps.1.maxBars=12',
      'steps.2.maxBars=6',
      'features.swing.left=3',
      'features.swing.right=3',
      'features.fvg.minSizePips=1',
      'features.sweep.swingMaxAgeBars=100',
    ]);
  });

  it('changes one value in a copy and refuses unknown paths', () => {
    const s = applyParam(LONDON_SWEEP, 'steps.1.maxBars', 20);
    expect(s.steps[1]!.maxBars).toBe(20);
    expect(LONDON_SWEEP.steps[1]!.maxBars).toBe(12);
    expect(() => applyParam(LONDON_SWEEP, 'target.nope', 1)).toThrow();
    expect(() => applyParam(LONDON_SWEEP, 'steps.9.maxBars', 1)).toThrow();
  });

  it('builds the grid in a fixed order with one hash per combination', () => {
    const grid = sweepGrid(LONDON_SWEEP, [
      { id: 'target.r', values: [1.5, 2, 3, 2] },
      { id: 'stop.bufferPips', values: [0, 1] },
    ]);
    expect(grid.map((v) => v.values)).toEqual([
      { 'target.r': 1.5, 'stop.bufferPips': 0 },
      { 'target.r': 1.5, 'stop.bufferPips': 1 },
      { 'target.r': 2, 'stop.bufferPips': 0 },
      { 'target.r': 2, 'stop.bufferPips': 1 },
      { 'target.r': 3, 'stop.bufferPips': 0 },
      { 'target.r': 3, 'stop.bufferPips': 1 },
    ]);
    expect(new Set(grid.map((v) => v.specHash)).size).toBe(6);
    // The unchanged combination has the version's own hash.
    expect(grid[3]!.specHash).toBe(specHash(LONDON_SWEEP));
  });

  it('marks invalid combinations instead of running them', () => {
    const grid = sweepGrid(LONDON_SWEEP, [{ id: 'steps.1.maxBars', values: [0, 2.5, 6] }]);
    expect(grid.map((v) => v.problems.map((p) => p.code))).toEqual([
      ['MAX_BARS'],
      ['MAX_BARS'],
      [],
    ]);
    expect(() => sweepGrid(LONDON_SWEEP, [])).toThrow();
    expect(() =>
      sweepGrid(LONDON_SWEEP, [
        { id: 'target.r', values: Array.from({ length: 11 }, (_, i) => i + 1) },
        { id: 'stop.bufferPips', values: Array.from({ length: 10 }, (_, i) => i) },
      ]),
    ).toThrow(/100/);
  });
});

describe('hypotheses', () => {
  const h: Hypothesis = {
    id: 'h1',
    title: 'ICT Asya dibi süpürmesi',
    statement: 'Londra MSS girişleri maliyet sonrası pozitif ortalama R verir.',
    strategyId: 's1',
    strategyVersion: 1,
    setup: {
      datasetId: 'ds',
      contentHash: 'c',
      from: 0,
      boundary: 10,
      to: 20,
      costs: { spreadPips: 0.2, slippagePips: 0.1, commissionPerLotPerSide: 3.5 },
      ambiguity: 'STOP_FIRST',
      startEquity: 10_000,
      lots: { lotStep: 0.01, minLot: 0.01 },
    },
    status: 'OPEN',
    conclusion: '',
    evidenceRunIds: [],
    oosRunIds: [],
    createdAt: 1,
    updatedAt: 1,
  };

  it('validates the statement, the split and the costs', () => {
    expect(validateHypothesis(h)).toEqual([]);
    expect(
      validateHypothesis({
        ...h,
        title: '',
        statement: ' ',
        setup: { ...h.setup, boundary: 30, costs: { ...h.setup.costs, spreadPips: -1 } },
      }),
    ).toEqual(['NO_TITLE', 'NO_STATEMENT', 'BAD_RANGE', 'BAD_COSTS']);
  });

  it('tracks the out-of-sample gate and flags a second look', () => {
    expect(oosState(h)).toEqual({ opened: false, repeated: false });
    const once = recordOos(h, 'r1', 5);
    expect(oosState(once)).toEqual({ opened: true, repeated: false });
    expect(oosState(recordOos(once, 'r2', 6))).toEqual({ opened: true, repeated: true });
  });

  it('needs evidence to conclude, and reopening keeps the run history', () => {
    expect(() => conclude(h, 'SUPPORTED', 'iyi', [], 9)).toThrow();
    const done = conclude(recordOos(h, 'r1', 5), 'NOT_SUPPORTED', 'OOS negatif', ['r1'], 9);
    expect(done).toMatchObject({ status: 'NOT_SUPPORTED', evidenceRunIds: ['r1'], updatedAt: 9 });
    expect(conclude(h, 'INCONCLUSIVE', 'az işlem', [], 9).status).toBe('INCONCLUSIVE');
    expect(reopen(done, 10)).toMatchObject({
      status: 'OPEN',
      evidenceRunIds: [],
      oosRunIds: ['r1'],
    });
  });
});
