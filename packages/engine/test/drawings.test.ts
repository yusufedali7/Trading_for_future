import { describe, expect, it } from 'vitest';
import { getInstrument } from '../src/instruments/registry';
import {
  ANCHOR_COUNT,
  FIB_EXTENSION_LEVELS,
  FIB_RETRACEMENT_LEVELS,
  defaultPosition,
  fibLevels,
  positionStats,
  priceRangeStats,
  setLevelStatus,
  validateDrawing,
  type Drawing,
  type SupportResistanceLevel,
} from '../src/user/drawings';

const eurusd = getInstrument('EURUSD');
const xauusd = getInstrument('XAUUSD');
const t = (iso: string) => Date.parse(iso);

function drawing(kind: Drawing['kind'], anchors: Drawing['anchors']): Drawing {
  return {
    id: 'd1',
    source: 'USER',
    kind,
    instrument: 'EURUSD',
    createdOnTimeframe: '15m',
    anchors,
    style: {},
    locked: false,
    hidden: false,
    createdAt: 0,
    updatedAt: 0,
  };
}

describe('anchor counts', () => {
  it('defines how many anchors each tool uses', () => {
    expect(ANCHOR_COUNT).toEqual({
      HLINE: 1,
      HRAY: 1,
      VLINE: 1,
      CROSSLINE: 1,
      TRENDLINE: 2,
      RAY: 2,
      EXTENDED_LINE: 2,
      CHANNEL: 3,
      FIB_RETRACEMENT: 2,
      FIB_EXTENSION: 3,
      RECT: 2,
      ELLIPSE: 2,
      ARROW: 2,
      TEXT: 1,
      ARROW_UP: 1,
      ARROW_DOWN: 1,
      PRICE_RANGE: 2,
      DATE_RANGE: 2,
      DATE_PRICE_RANGE: 2,
      POSITION_LONG: 3,
      POSITION_SHORT: 3,
    });
  });
});

describe('fibonacci levels (our defaults, D41)', () => {
  const a = { t: t('2026-01-06T10:00:00Z'), p: 1.08 };
  const b = { t: t('2026-01-06T12:00:00Z'), p: 1.09 };

  it('retracement: 0 at the second point, 1 at the first, prices on the tick grid', () => {
    const levels = fibLevels(eurusd, 'FIB_RETRACEMENT', [a, b]);
    expect(levels.map((l) => l.level)).toEqual(FIB_RETRACEMENT_LEVELS);
    expect(levels.find((l) => l.level === 0)!.price).toBe(1.09);
    expect(levels.find((l) => l.level === 1)!.price).toBe(1.08);
    expect(levels.find((l) => l.level === 0.5)!.price).toBe(1.085);
    expect(levels.find((l) => l.level === 0.618)!.price).toBe(1.08382);
  });

  it('trend-based extension projects the first move from the third point', () => {
    const c = { t: t('2026-01-06T13:00:00Z'), p: 1.086 };
    const levels = fibLevels(eurusd, 'FIB_EXTENSION', [a, b, c]);
    expect(levels.map((l) => l.level)).toEqual(FIB_EXTENSION_LEVELS);
    expect(levels.find((l) => l.level === 0)!.price).toBe(1.086);
    expect(levels.find((l) => l.level === 1)!.price).toBe(1.096);
    expect(levels.find((l) => l.level === 1.618)!.price).toBe(1.10218);
  });
});

describe('validateDrawing', () => {
  it('accepts a well-formed trend line', () => {
    const d = drawing('TRENDLINE', [
      { t: t('2026-01-06T10:00:00Z'), p: 1.085 },
      { t: t('2026-01-06T12:00:00Z'), p: 1.087 },
    ]);
    expect(validateDrawing(d)).toEqual([]);
  });

  it('a text drawing needs some text', () => {
    const d = drawing('TEXT', [{ t: t('2026-01-06T10:00:00Z'), p: 1.085 }]);
    expect(validateDrawing(d)).toEqual(['NO_TEXT']);
    expect(validateDrawing({ ...d, text: '  ' })).toEqual(['NO_TEXT']);
    expect(validateDrawing({ ...d, text: 'Londra açılışı' })).toEqual([]);
  });

  it('rejects the wrong number of anchors and non-finite values', () => {
    expect(validateDrawing(drawing('RECT', [{ t: 0, p: 1 }]))).toContain('ANCHOR_COUNT');
    expect(validateDrawing(drawing('HLINE', [{ t: 0, p: Number.NaN }]))).toContain('NON_FINITE');
  });

  it('rejects engine drawings: only user drawings are stored', () => {
    expect(validateDrawing({ ...drawing('HLINE', [{ t: 0, p: 1 }]), source: 'ENGINE' })).toContain(
      'NOT_USER',
    );
  });
});

describe('priceRangeStats', () => {
  it('measures a 20 pip up move over 2 hours', () => {
    expect(
      priceRangeStats(
        eurusd,
        { t: t('2026-01-06T10:00:00Z'), p: 1.085 },
        { t: t('2026-01-06T12:00:00Z'), p: 1.087 },
      ),
    ).toEqual({ diff: 0.002, pips: 20, percent: 0.1843, durationMs: 7_200_000 });
  });

  it('reports a down move with negative values regardless of anchor order in time', () => {
    const s = priceRangeStats(eurusd, { t: 2, p: 1.087 }, { t: 1, p: 1.085 });
    expect(s.pips).toBe(-20);
    expect(s.durationMs).toBe(1);
  });
});

describe('positionStats', () => {
  it('computes risk, reward and R:R for a long', () => {
    expect(positionStats(eurusd, 'POSITION_LONG', 1.085, 1.083, 1.089)).toEqual({
      riskPips: 20,
      rewardPips: 40,
      rr: 2,
      valid: true,
    });
  });

  it('computes a short with gold pips (0.1)', () => {
    expect(positionStats(xauusd, 'POSITION_SHORT', 2650, 2655, 2640)).toEqual({
      riskPips: 50,
      rewardPips: 100,
      rr: 2,
      valid: true,
    });
  });

  it('flags a stop on the wrong side of the entry as invalid', () => {
    expect(positionStats(eurusd, 'POSITION_LONG', 1.085, 1.087, 1.09).valid).toBe(false);
    expect(positionStats(eurusd, 'POSITION_SHORT', 1.085, 1.083, 1.08).valid).toBe(false);
  });
});

describe('defaultPosition', () => {
  it('places a long with a 20 pip stop and 2R target, 20 bars wide', () => {
    expect(defaultPosition(eurusd, 'POSITION_LONG', { t: 1000, p: 1.085 }, 60_000)).toEqual([
      { t: 1000, p: 1.085 },
      { t: 1000 + 20 * 60_000, p: 1.083 },
      { t: 1000 + 20 * 60_000, p: 1.089 },
    ]);
  });

  it('mirrors stop and target for a short', () => {
    const [, stop, target] = defaultPosition(eurusd, 'POSITION_SHORT', { t: 0, p: 1.085 }, 60_000);
    expect([stop!.p, target!.p]).toEqual([1.087, 1.081]);
  });
});

describe('setLevelStatus', () => {
  const level: SupportResistanceLevel = {
    id: 'l1',
    drawingId: 'd1',
    instrument: 'EURUSD',
    kind: 'SUPPORT',
    timeframe: '4h',
    note: '',
    status: 'ACTIVE',
    statusHistory: [{ status: 'ACTIVE', at: 100 }],
    createdAt: 100,
    updatedAt: 100,
  };

  it('records each status change with its time and note, without mutating the input', () => {
    const broken = setLevelStatus(level, 'BROKEN', 200, 'H4 kapanış altında');
    expect(broken.status).toBe('BROKEN');
    expect(broken.updatedAt).toBe(200);
    expect(broken.statusHistory).toEqual([
      { status: 'ACTIVE', at: 100 },
      { status: 'BROKEN', at: 200, note: 'H4 kapanış altında' },
    ]);
    expect(level.status).toBe('ACTIVE');
    expect(level.statusHistory).toHaveLength(1);
  });

  it('ignores a "change" to the current status', () => {
    expect(setLevelStatus(level, 'ACTIVE', 300)).toBe(level);
  });
});
