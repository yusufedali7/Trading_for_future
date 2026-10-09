import type { LocalTime } from '../core/types';
import { FEATURE_DEFAULTS } from '../features/compute';
import type { StrategySpec } from '../strategy/schema';

/**
 * `catalog/strategies/*.json` adapted to today's `StrategySpec` (D61). Only the strategies that
 * fit the current schema are here - 5 of the catalog's 6 use step types the engine does not have
 * yet (`PATTERN_EVENT` referencing one of the M9 catalog's 111 pattern detectors, `EMA_TREND`/
 * `ATR_MULTIPLE`/rolling-window indicator conditions, `RANDOM_ENTRY`). Building those would mean
 * extending `EventStep` far beyond this slice's scope (`docs/DECISIONS.md` D61); they stay
 * un-adapted until that happens. `baseline_random_entry` isn't a `StrategySpec` at all - it's
 * `backtest/random-baseline.ts`'s `randomEntryBaseline()` instead.
 *
 * `london_asia_sweep` is the one buildable today, and its own `ambiguities` turned out to be
 * exactly the catalog's stated convention elsewhere ("test as two versions") applied to its two
 * open questions:
 * - "MSS için displacement zorunlu mu?" - `fvg` version: no (plain STRUCTURE_BREAK); `order_block`
 *   version: yes (ORDER_BLOCK, D59, which already requires an accompanying displacement by its
 *   own definition).
 * - "FVG yoksa setup iptal mi, yoksa OB girişi mi?" - `fvg` version cancels (no match = no setup,
 *   the engine's existing behaviour); `order_block` version enters at the order block directly.
 * A third question ("Asya seansı hangi saat dilimiyle?") wasn't actually open: the catalog file's
 * own "şimdilik Asia/Tokyo 00:00-09:00" note predates this project's own `BUILTIN_SESSIONS` ASIA
 * definition (Asia/Tokyo 09:00-18:00, used everywhere else since M2/D23) - the already-established
 * project default was used instead of the stale catalog note.
 */
export interface CatalogStrategy {
  /** `catalog/strategies/<catalogId>.json`'s own `id`. */
  catalogId: string;
  /** Which resolved ambiguity this version picks, e.g. "fvg" vs "order_block". */
  versionLabel: string;
  name: string;
  description: string;
  spec: StrategySpec;
}

const LONDON_ASIA_SWEEP_BASE = {
  schema: 'strategy/v1' as const,
  instrument: 'EURUSD',
  timeframe: '15m' as const,
  direction: 'LONG' as const,
  window: { start: '08:00' as LocalTime, end: '11:00' as LocalTime, tz: 'Europe/London' },
  risk: { percentPerTrade: 0.5 },
  maxTradesPerDay: null,
  features: FEATURE_DEFAULTS,
};

export const CATALOG_STRATEGIES: readonly CatalogStrategy[] = [
  {
    catalogId: 'london_asia_sweep',
    versionLabel: 'fvg',
    name: "Londra'da Asya dibi süpürmesi (FVG girişli)",
    description:
      'Asya dibi süpürülür, yapı kırılımı (displacement şartsız) ve ardından oluşan FVG üzerinden limit giriş. FVG oluşmazsa kurulum iptal.',
    spec: {
      ...LONDON_ASIA_SWEEP_BASE,
      steps: [
        { id: 'sweep', type: 'LIQUIDITY_SWEEP', direction: 'BULLISH', levels: ['ASIA_LOW'] },
        { id: 'mss', type: 'STRUCTURE_BREAK', direction: 'BULLISH', maxBars: 12 },
        { id: 'fvg', type: 'FVG', direction: 'BULLISH', maxBars: 6 },
      ],
      entry: { type: 'LIMIT_AT', ref: 'fvg.top', expireBars: 8 },
      stop: { type: 'BEYOND_REF', ref: 'sweep.extreme', bufferPips: 1 },
      target: { type: 'R_MULTIPLE', r: 2 },
    },
  },
  {
    catalogId: 'london_asia_sweep',
    versionLabel: 'order_block',
    name: "Londra'da Asya dibi süpürmesi (order block girişli)",
    description:
      'Asya dibi süpürülür, ardından oluşan order block (displacement + yapı kırılımı zorunlu) üzerinden limit giriş.',
    spec: {
      ...LONDON_ASIA_SWEEP_BASE,
      steps: [
        { id: 'sweep', type: 'LIQUIDITY_SWEEP', direction: 'BULLISH', levels: ['ASIA_LOW'] },
        { id: 'ob', type: 'ORDER_BLOCK', direction: 'BULLISH', maxBars: 12 },
      ],
      entry: { type: 'LIMIT_AT', ref: 'ob.top', expireBars: 8 },
      stop: { type: 'BEYOND_REF', ref: 'sweep.extreme', bufferPips: 1 },
      target: { type: 'R_MULTIPLE', r: 2 },
    },
  },
];
