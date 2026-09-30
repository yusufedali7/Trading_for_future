import type { IanaTz, LocalTime } from '../core/types';

export type AssetClass = 'FX' | 'METAL' | 'INDEX' | 'CRYPTO';

interface WeekBoundary {
  day: 'SUN' | 'FRI';
  time: LocalTime;
  tz: IanaTz;
}

export type TradingHours =
  { kind: 'FX_24_5'; weekOpen: WeekBoundary; weekClose: WeekBoundary } | { kind: 'ALWAYS' };

export interface Instrument {
  symbol: string;
  assetClass: AssetClass;
  base: string;
  quote: string;
  /** Smallest quoted price step. Must be 1/N for an integer N. */
  tickSize: number;
  /** Conventional move unit used for stops and targets. Whole multiple of tickSize. */
  pipSize: number;
  pricePrecision: number;
  /** Units of base per 1.0 lot. */
  contractSize: number;
  tradingHours: TradingHours;
  /** Optional daily maintenance break inside trading hours. */
  dailyBreak?: { start: LocalTime; end: LocalTime; tz: IanaTz };
  /** End of the trading day; 1D and 4H candles align to it (DECISIONS D11). */
  dailyClose: { time: LocalTime; tz: IanaTz };
  /** Bumped whenever defaults change, so results can record which metadata they used. */
  metaVersion: number;
}

const NY = 'America/New_York';

const FX_HOURS: TradingHours = {
  kind: 'FX_24_5',
  weekOpen: { day: 'SUN', time: '17:00', tz: NY },
  weekClose: { day: 'FRI', time: '17:00', tz: NY },
};

const NY_CLOSE = { time: '17:00', tz: NY } as const;

function fxPair(symbol: string, pipSize: number, tickSize: number, precision: number): Instrument {
  return {
    symbol,
    assetClass: 'FX',
    base: symbol.slice(0, 3),
    quote: symbol.slice(3, 6),
    tickSize,
    pipSize,
    pricePrecision: precision,
    contractSize: 100_000,
    tradingHours: FX_HOURS,
    dailyClose: NY_CLOSE,
    metaVersion: 1,
  };
}

// Single source of truth for instrument metadata (CLAUDE.md). Data is loaded for EURUSD and
// XAUUSD (DECISIONS D13); the others exist for pip and lot-size test cases.
const REGISTRY: readonly Instrument[] = [
  fxPair('EURUSD', 0.0001, 0.00001, 5),
  fxPair('GBPUSD', 0.0001, 0.00001, 5),
  fxPair('USDJPY', 0.01, 0.001, 3),
  {
    symbol: 'XAUUSD',
    assetClass: 'METAL',
    base: 'XAU',
    quote: 'USD',
    // Price precision of the Dukascopy feed is not yet verified (DECISIONS D12);
    // import validation reports prices finer than this tick.
    tickSize: 0.001,
    pipSize: 0.1,
    pricePrecision: 3,
    contractSize: 100,
    tradingHours: FX_HOURS,
    dailyBreak: { start: '17:00', end: '18:00', tz: NY },
    dailyClose: NY_CLOSE,
    metaVersion: 1,
  },
];

export function listInstruments(): readonly Instrument[] {
  return REGISTRY;
}

export function getInstrument(symbol: string): Instrument {
  const found = REGISTRY.find((i) => i.symbol === symbol);
  if (!found) throw new Error(`Unknown instrument: ${symbol}`);
  return found;
}

function ticksPerUnit(i: Instrument): number {
  return Math.round(1 / i.tickSize);
}

function ticksPerPip(i: Instrument): number {
  return Math.round(i.pipSize / i.tickSize);
}

/** Price distance → pips, computed through whole ticks to avoid float noise. */
export function priceToPips(i: Instrument, priceDiff: number): number {
  const ticks = Math.round(priceDiff * ticksPerUnit(i));
  return ticks / ticksPerPip(i);
}

export function pipsToPrice(i: Instrument, pips: number): number {
  const ticks = Math.round(pips * ticksPerPip(i));
  return ticks / ticksPerUnit(i);
}

export function roundToTick(i: Instrument, price: number): number {
  return Math.round(price * ticksPerUnit(i)) / ticksPerUnit(i);
}

export type InstrumentOverrides = Partial<Pick<Instrument, 'pipSize' | 'contractSize'>>;

/** Returns a copy with user overrides applied; the registry itself is never mutated. */
export function withOverrides(i: Instrument, o: InstrumentOverrides): Instrument {
  const next = { ...i, ...o };
  const ratio = next.pipSize / next.tickSize;
  if (!(ratio >= 1) || Math.abs(ratio - Math.round(ratio)) > 1e-9) {
    throw new Error(
      `pipSize ${next.pipSize} must be a whole multiple of tickSize ${next.tickSize}`,
    );
  }
  if (!(next.contractSize > 0)) throw new Error('contractSize must be positive');
  return next;
}
