import type { LocalTime } from '../core/types';
import { FEATURE_DEFAULTS } from '../features/compute';
import type { StrategySpec } from '../strategy/schema';

/**
 * `catalog/strategies/*.json` adapted to today's `StrategySpec` (D61, D63). Only the strategies
 * that fit the current schema are here. `double_bottom_confirmed` became buildable once the
 * `PATTERN_EVENT` step type (D63) could reference one of the 21 `ChartPattern`-family M9
 * detectors. The other 3 blocked strategies still use step types the engine doesn't have:
 * `EMA_TREND`/`ATR_MULTIPLE`/rolling-window indicator conditions (`d1_trend_pullback`,
 * `donchian_breakout_d1`), or BOTH `PATTERN_EVENT` and a non-directional `PRICE_IN_ZONE`
 * (`engulfing_at_candidate_sr` - `candidate_sr` has no single direction/invalidation price, same
 * reason it's not an `EventStep` on its own, D59). `baseline_random_entry` isn't a `StrategySpec`
 * at all - it's `backtest/random-baseline.ts`'s `randomEntryBaseline()` instead.
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
 *
 * `double_bottom_confirmed`'s own open question ("hedef ölçülen hareket mi, sabit 2R mi?") is
 * resolved the same way, as two versions. Its stop wants an ATR-relative buffer (`bufferAtr: 0.2`)
 * that the engine's `BEYOND_REF` doesn't have (only `bufferPips`) - the same ATR-threshold gap
 * blocking `d1_trend_pullback`/`donchian_breakout_d1`; here it's substituted with a fixed 3-pip
 * buffer, explicitly flagged rather than silently treated as equivalent. Its `NEXT_OPEN` entry is
 * just the engine's existing `MARKET` entry under another name (fills after the signal bar's
 * close - the D7/D8 model), so no new entry type was needed.
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

const DOUBLE_BOTTOM_BASE = {
  schema: 'strategy/v1' as const,
  instrument: 'EURUSD',
  timeframe: '4h' as const,
  direction: 'LONG' as const,
  window: null,
  risk: { percentPerTrade: 0.5 },
  maxTradesPerDay: null,
  features: FEATURE_DEFAULTS,
  steps: [{ id: 'pattern', type: 'PATTERN_EVENT' as const, patternId: 'double_bottom' }],
  entry: { type: 'MARKET' as const },
  stop: { type: 'BEYOND_REF' as const, ref: 'pattern.invalidationRef', bufferPips: 3 },
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
  {
    catalogId: 'double_bottom_confirmed',
    versionLabel: 'measured_move',
    name: 'Onaylı ikili dip (ölçülen hareket hedefi)',
    description: 'İkili dip onaylandığında piyasa girişi; hedef formasyonun ölçülen hareketi.',
    spec: {
      ...DOUBLE_BOTTOM_BASE,
      target: { type: 'AT_REF', ref: 'pattern.targetPrice', bufferPips: 0 },
    },
  },
  {
    catalogId: 'double_bottom_confirmed',
    versionLabel: 'fixed_2r',
    name: 'Onaylı ikili dip (sabit 2R hedef)',
    description: 'İkili dip onaylandığında piyasa girişi; hedef sabit 2R.',
    spec: {
      ...DOUBLE_BOTTOM_BASE,
      target: { type: 'R_MULTIPLE', r: 2 },
    },
  },
];
