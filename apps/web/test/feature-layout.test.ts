import { describe, expect, it } from 'vitest';
import type { FeatureSet, SmcSet } from '@trw/engine';
import {
  FEATURE_LAYERS,
  layoutFeatures,
  layoutSmc,
  visibleItems,
} from '../src/chart/primitives/feature-layout';
import { tr } from '../src/i18n/tr';

// SYNTHETIC: ten 15m bars and one candidate of each kind.
const TF = 15 * 60_000;
const T0 = Date.parse('2026-01-06T08:00:00Z');
const times = Array.from({ length: 10 }, (_, i) => T0 + i * TF);
const at = (i: number) => T0 + i * TF;
const timing = (formed: number, confirmed: number) => ({
  id: `x${formed}`,
  defVersion: 'v1' as const,
  formedAt: at(formed),
  formedIndex: formed,
  confirmedAt: at(confirmed + 1),
  confirmedIndex: confirmed,
});
const set: FeatureSet = {
  swings: [{ ...timing(2, 5), type: 'SWING', kind: 'HIGH', price: 1.2 }],
  fvgs: [
    {
      ...timing(3, 4),
      type: 'FVG',
      direction: 'BULLISH',
      top: 1.15,
      bottom: 1.14,
      touchedAt: null,
      filledAt: at(7),
    },
    {
      ...timing(6, 7),
      type: 'FVG',
      direction: 'BEARISH',
      top: 1.17,
      bottom: 1.16,
      touchedAt: null,
      filledAt: null,
    },
  ],
  breaks: [
    {
      ...timing(8, 8),
      type: 'STRUCTURE_BREAK',
      direction: 'BULLISH',
      kind: 'CHOCH',
      level: 1.2,
      swingId: 'x2',
      swingAt: at(2),
    },
  ],
  sweeps: [
    {
      ...timing(9, 9),
      type: 'LIQUIDITY_SWEEP',
      direction: 'BEARISH',
      levelId: 'p',
      levelKind: 'PDH',
      level: 1.21,
      extreme: 1.215,
    },
  ],
  periods: [
    {
      id: 'p',
      defVersion: 'v1',
      period: 'DAY',
      start: at(-96),
      end: at(1),
      high: 1.21,
      low: 1.1,
      knownAt: at(1),
      validUntil: at(97),
    },
  ],
};
const ALL = new Set(['SWING', 'FVG', 'STRUCTURE', 'SWEEP', 'PREV_DAY', 'PREV_WEEK'] as const);

describe('layoutFeatures', () => {
  const items = layoutFeatures(set, ALL, times, TF, tr.features.labels);

  it('places each candidate on the bar-position axis with a candidate label', () => {
    expect(items).toEqual([
      {
        shape: 'LINE',
        layer: 'PREV_DAY',
        p1: 0.5,
        p2: 96.5,
        price: 1.21,
        tone: 'DAY',
        label: 'PDH',
        dashed: true,
      },
      {
        shape: 'LINE',
        layer: 'PREV_DAY',
        p1: 0.5,
        p2: 96.5,
        price: 1.1,
        tone: 'DAY',
        label: 'PDL',
        dashed: true,
      },
      {
        shape: 'BOX',
        layer: 'FVG',
        p1: 2.5,
        p2: 6.5,
        top: 1.15,
        bottom: 1.14,
        tone: 'UP',
        label: 'Aday FVG ↑',
      },
      {
        shape: 'BOX',
        layer: 'FVG',
        p1: 5.5,
        p2: null,
        top: 1.17,
        bottom: 1.16,
        tone: 'DOWN',
        label: 'Aday FVG ↓',
      },
      {
        shape: 'LINE',
        layer: 'STRUCTURE',
        p1: 2,
        p2: 8,
        price: 1.2,
        tone: 'UP',
        label: 'CHoCH ↑',
        dashed: false,
      },
      {
        shape: 'MARK',
        layer: 'SWING',
        p: 2,
        price: 1.2,
        above: true,
        stack: 0,
        tone: 'NEUTRAL',
        label: 'T',
      },
      {
        shape: 'MARK',
        layer: 'SWEEP',
        p: 9,
        price: 1.215,
        above: true,
        stack: 0,
        tone: 'SWEEP',
        label: 'Süpürme PDH',
      },
    ]);
  });

  it('merges sweeps of one bar into one mark and stacks it beyond a swing mark', () => {
    const sweep = set.sweeps[0]!;
    const busy: FeatureSet = {
      ...set,
      swings: [{ ...timing(9, 12), type: 'SWING', kind: 'HIGH', price: 1.215 }],
      sweeps: [sweep, { ...sweep, id: 'y', levelId: 'a', levelKind: 'ASIA_HIGH' }],
    };
    const marks = layoutFeatures(busy, ALL, times, TF, tr.features.labels).filter(
      (i) => i.shape === 'MARK',
    );
    expect(marks.map((m) => [m.label, m.shape === 'MARK' && m.stack])).toEqual([
      ['T', 0],
      ['Süpürme PDH, Asya Y', 1],
    ]);
  });

  it('draws an old gap box for at most 50 bars (display only)', () => {
    const long = Array.from({ length: 120 }, (_, i) => T0 + i * TF);
    const [open] = layoutFeatures(
      { ...set, fvgs: [set.fvgs[1]!], periods: [] },
      new Set(['FVG'] as const),
      long,
      TF,
      tr.features.labels,
    );
    expect(open).toMatchObject({ shape: 'BOX', p1: 5.5, p2: 55.5 });
  });

  it('draws only the enabled layers', () => {
    const only = layoutFeatures(set, new Set(['SWEEP'] as const), times, TF, tr.features.labels);
    expect(only.map((i) => i.layer)).toEqual(['SWEEP']);
  });

  it('keeps items that overlap the visible range; open boxes run to the newest bar', () => {
    const shown = visibleItems(items, 7, 9, 9.5);
    expect(shown.map((i) => i.label)).toEqual([
      'PDH',
      'PDL',
      'Aday FVG ↓',
      'CHoCH ↑',
      'Süpürme PDH',
    ]);
  });
});

describe('layoutSmc', () => {
  // SYNTHETIC: one candidate of each SMC kind (M9 2.–3. dilim).
  const smcSet: SmcSet = {
    displacements: [],
    orderBlocks: [
      {
        ...timing(2, 3),
        type: 'ORDER_BLOCK',
        direction: 'BULLISH',
        top: 1.2,
        bottom: 1.1,
        breakId: 'b1',
      },
    ],
    ifvgs: [
      {
        ...timing(4, 5),
        type: 'IFVG',
        direction: 'BEARISH',
        top: 1.3,
        bottom: 1.25,
        sourceFvgId: 'f1',
      },
    ],
    breakers: [
      {
        ...timing(1, 2),
        type: 'BREAKER',
        direction: 'BULLISH',
        top: 1.05,
        bottom: 1.0,
        sourceOrderBlockId: 'ob1',
      },
    ],
    equalLevels: [
      { ...timing(0, 3), type: 'EQUAL_LEVELS', side: 'HIGH', price: 1.21, swingIds: ['s1', 's2'] },
    ],
    premiumDiscount: [
      { ...timing(1, 1), type: 'PREMIUM_DISCOUNT', top: 1.3, bottom: 1.1, equilibrium: 1.2 },
      { ...timing(5, 5), type: 'PREMIUM_DISCOUNT', top: 1.35, bottom: 1.15, equilibrium: 1.25 },
    ],
    ote: [
      {
        ...timing(3, 4),
        type: 'OTE',
        direction: 'BEARISH',
        top: 1.5,
        bottom: 1.4,
        sweetSpot: 1.45,
        startSwingId: 's3',
        endSwingId: 's4',
      },
    ],
    candidateSr: [
      {
        ...timing(0, 2),
        type: 'CANDIDATE_SR',
        top: 1.22,
        bottom: 1.18,
        price: 1.2,
        touches: 3,
        swingIds: ['s5', 's6', 's7'],
      },
    ],
  };
  const SMC_LAYERS = new Set(FEATURE_LAYERS.filter((l) => l !== 'SWING'));

  it('lays out every SMC candidate kind, open boxes/lines to the newest bar', () => {
    const smcItems = layoutSmc(smcSet, SMC_LAYERS, times, TF, tr.features.smcLabels);
    expect(smcItems).toEqual([
      {
        shape: 'BOX',
        layer: 'ORDER_BLOCK',
        p1: 1.5,
        p2: null,
        top: 1.2,
        bottom: 1.1,
        tone: 'UP',
        label: 'Order block ↑',
      },
      {
        shape: 'BOX',
        layer: 'IFVG',
        p1: 3.5,
        p2: null,
        top: 1.3,
        bottom: 1.25,
        tone: 'DOWN',
        label: 'Ters FVG ↓',
      },
      {
        shape: 'BOX',
        layer: 'BREAKER',
        p1: 0.5,
        p2: null,
        top: 1.05,
        bottom: 1.0,
        tone: 'UP',
        label: 'Breaker ↑',
      },
      {
        shape: 'BOX',
        layer: 'OTE',
        p1: 2.5,
        p2: null,
        top: 1.5,
        bottom: 1.4,
        tone: 'DOWN',
        label: 'OTE ↓',
      },
      {
        shape: 'BOX',
        layer: 'CANDIDATE_SR',
        p1: -0.5,
        p2: null,
        top: 1.22,
        bottom: 1.18,
        tone: 'NEUTRAL',
        label: 'Aday S/D',
      },
      {
        shape: 'LINE',
        layer: 'EQUAL_LEVELS',
        p1: 0,
        p2: 3.5,
        price: 1.21,
        tone: 'NEUTRAL',
        label: 'EQH',
        dashed: true,
      },
      {
        shape: 'LINE',
        layer: 'PREMIUM_DISCOUNT',
        p1: 1.5,
        p2: 5.5,
        price: 1.2,
        tone: 'NEUTRAL',
        label: 'Denge (P/D)',
        dashed: true,
      },
      {
        shape: 'LINE',
        layer: 'PREMIUM_DISCOUNT',
        p1: 5.5,
        p2: null,
        price: 1.25,
        tone: 'NEUTRAL',
        label: 'Denge (P/D)',
        dashed: true,
      },
    ]);
  });

  it('draws only the enabled SMC layers', () => {
    const only = layoutSmc(smcSet, new Set(['BREAKER'] as const), times, TF, tr.features.smcLabels);
    expect(only.map((i) => i.layer)).toEqual(['BREAKER']);
  });
});
