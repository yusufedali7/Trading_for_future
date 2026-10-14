import { describe, expect, it } from 'vitest';
import { getInstrument, withOverrides } from '../src/instruments/registry';
import { lotRules, pipValuePerLot, positionSize, tradePnl } from '../src/risk/sizing';

const EUR = getInstrument('EURUSD');
const JPY = getInstrument('USDJPY');
const XAU = getInstrument('XAUUSD');

describe('pip value', () => {
  it('USD-quoted, USD-based and gold', () => {
    expect(pipValuePerLot(EUR, 1.1)).toBe(10);
    expect(pipValuePerLot(JPY, 150)).toBeCloseTo(1000 / 150, 10);
    expect(pipValuePerLot(XAU, 2650)).toBeCloseTo(10, 10); // 0.1 × 100 oz
  });

  it('crosses are not supported without a conversion rate', () => {
    const cross = { ...EUR, symbol: 'EURGBP', quote: 'GBP' };
    expect(pipValuePerLot(cross, 0.85)).toBeNull();
    expect(positionSize(cross, 10_000, 1, 0.85, 0.849)).toEqual({
      ok: false,
      reason: 'CROSS_PAIR',
    });
  });
});

describe('positionSize', () => {
  it('risks at most the asked percentage, rounding lots down to the step', () => {
    // 10 000 USD × 0.5 % = 50 USD; 20 pip stop × 10 USD/pip/lot = 200 USD per lot → 0.25 lot.
    expect(positionSize(EUR, 10_000, 0.5, 1.1, 1.098)).toEqual({
      ok: true,
      lots: 0.25,
      riskAmount: 50,
    });
    // 15 pip stop: 50 / 150 = 0.333… → 0.33 lot, 49.5 USD at risk.
    expect(positionSize(EUR, 10_000, 0.5, 1.1, 1.0985)).toEqual({
      ok: true,
      lots: 0.33,
      riskAmount: 49.5,
    });
    // Float trap: 7 steps exactly.
    expect(positionSize(EUR, 1_400, 1, 1.1, 1.098)).toMatchObject({ lots: 0.07 });
  });

  it('USD-based pairs convert at the entry price', () => {
    // 20 pip on USDJPY at 150: 0.2 × 100 000 / 150 = 133.33 USD per lot; 100 USD → 0.75 lot.
    expect(positionSize(JPY, 10_000, 1, 150, 149.8)).toMatchObject({ ok: true, lots: 0.75 });
  });

  it('skips a trade when even the smallest lot would risk too much', () => {
    expect(positionSize(EUR, 100, 0.5, 1.1, 1.09)).toEqual({ ok: false, reason: 'SIZE_TOO_SMALL' });
    expect(positionSize(EUR, 10_000, 1, 1.1, 1.1)).toEqual({ ok: false, reason: 'NO_RISK' });
  });

  it('follows configurable lot rules and contract size', () => {
    const mini = withOverrides(EUR, { contractSize: 10_000 });
    expect(positionSize(mini, 10_000, 0.5, 1.1, 1.098, { lotStep: 0.1, minLot: 0.1 })).toEqual({
      ok: true,
      lots: 2.5,
      riskAmount: 50,
    });
  });
});

describe('tradePnl', () => {
  it('in USD for longs and shorts', () => {
    expect(tradePnl(EUR, 'LONG', 0.25, 1.1, 1.104)).toBe(100);
    expect(tradePnl(EUR, 'SHORT', 0.25, 1.1, 1.104)).toBe(-100);
    expect(tradePnl(XAU, 'LONG', 1, 2650, 2652)).toBe(200);
    expect(tradePnl(JPY, 'LONG', 1, 150, 150.3)).toBeCloseTo(199.6, 1);
  });
});

describe('lotRules', () => {
  it('reads the lot step and minimum lot from the instrument', () => {
    expect(lotRules(EUR)).toEqual({ lotStep: 0.01, minLot: 0.01 });
    expect(lotRules(withOverrides(XAU, { lotStep: 0.1, minLot: 0.1 }))).toEqual({
      lotStep: 0.1,
      minLot: 0.1,
    });
  });
});
