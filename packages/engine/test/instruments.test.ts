import { describe, expect, it } from 'vitest';
import {
  getInstrument,
  listInstruments,
  priceToPips,
  pipsToPrice,
  roundToTick,
  withOverrides,
} from '../src/instruments/registry';

describe('instrument registry', () => {
  it('defines EURUSD with standard FX metadata', () => {
    const eu = getInstrument('EURUSD');
    expect(eu).toMatchObject({
      symbol: 'EURUSD',
      assetClass: 'FX',
      base: 'EUR',
      quote: 'USD',
      pipSize: 0.0001,
      tickSize: 0.00001,
      pricePrecision: 5,
      contractSize: 100_000,
      dailyClose: { time: '17:00', tz: 'America/New_York' },
    });
    expect(eu.tradingHours.kind).toBe('FX_24_5');
  });

  it('defines XAUUSD with a 0.1 pip by default, 100 oz contract and a daily break', () => {
    const xau = getInstrument('XAUUSD');
    expect(xau).toMatchObject({
      assetClass: 'METAL',
      base: 'XAU',
      quote: 'USD',
      pipSize: 0.1,
      contractSize: 100,
      dailyBreak: { start: '17:00', end: '18:00', tz: 'America/New_York' },
    });
  });

  it('defines USDJPY with a 0.01 pip', () => {
    expect(getInstrument('USDJPY').pipSize).toBe(0.01);
  });

  it('throws for unknown symbols', () => {
    expect(() => getInstrument('FOOBAR')).toThrow(/Unknown instrument/);
  });

  it('lists every instrument once', () => {
    const symbols = listInstruments().map((i) => i.symbol);
    expect(new Set(symbols).size).toBe(symbols.length);
    expect(symbols).toEqual(expect.arrayContaining(['EURUSD', 'XAUUSD']));
  });

  it('keeps pip size a whole multiple of tick size for every instrument', () => {
    for (const i of listInstruments()) {
      const ratio = i.pipSize / i.tickSize;
      expect(Math.abs(ratio - Math.round(ratio))).toBeLessThan(1e-9);
    }
  });
});

describe('pip arithmetic', () => {
  it('measures a 20 pip EURUSD move exactly', () => {
    expect(priceToPips(getInstrument('EURUSD'), 1.087 - 1.085)).toBe(20);
  });

  it('measures fractional pips (pipettes)', () => {
    expect(priceToPips(getInstrument('EURUSD'), 1.08503 - 1.085)).toBe(0.3);
  });

  it('measures a 10 pip gold move with the default 0.1 pip', () => {
    expect(priceToPips(getInstrument('XAUUSD'), 2651.5 - 2650.5)).toBe(10);
  });

  it('converts pips back to a price distance', () => {
    expect(pipsToPrice(getInstrument('EURUSD'), 15)).toBe(0.0015);
    expect(pipsToPrice(getInstrument('USDJPY'), 15)).toBe(0.15);
  });

  it('rounds prices to the instrument tick', () => {
    expect(roundToTick(getInstrument('EURUSD'), 1.0850049)).toBe(1.085);
    expect(roundToTick(getInstrument('EURUSD'), 1.0850051)).toBe(1.08501);
  });
});

describe('overrides', () => {
  it('lets the user redefine the gold pip without mutating the registry', () => {
    const custom = withOverrides(getInstrument('XAUUSD'), { pipSize: 0.01 });
    expect(custom.pipSize).toBe(0.01);
    expect(priceToPips(custom, 1)).toBe(100);
    expect(getInstrument('XAUUSD').pipSize).toBe(0.1);
  });

  it('rejects a pip size that is not a multiple of the tick size', () => {
    expect(() => withOverrides(getInstrument('EURUSD'), { pipSize: 0.000015 })).toThrow();
  });
});
