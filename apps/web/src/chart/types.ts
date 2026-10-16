import type {
  ChartPattern,
  FeatureSet,
  HarmonicPattern,
  IanaTz,
  Instrument,
  ResampledCandle,
  SessionLevels,
  SmcSet,
  Timeframe,
  UtcMs,
} from '@trw/engine';
import type { IndicatorSettings } from './indicator-settings';
import type { FeatureLayer } from './primitives/feature-layout';
import type { MutableRefObject } from 'react';
import type { DrawingLayerProps } from './use-drawing-layer';

export interface ChartViewProps extends DrawingLayerProps {
  candles: readonly ResampledCandle[];
  /** Names and colours of user sessions (built-in ones are known to the chart). */
  sessionStyles?: Record<string, { name: string; color: string }>;
  /** Visible sessions with their levels (engine layer). */
  sessions: readonly SessionLevels[];
  instrument: Instrument;
  timeframe: Timeframe;
  /** Timeframe of the stored data (for the missing-bars note). */
  baseTimeframe?: Timeframe;
  displayTz: IanaTz;
  /** Replay: keep the newest bar in view as the cursor advances. */
  followLatest?: boolean;
  /** Replay trade: entry (or pending order), stop and target as horizontal price lines. */
  tradeLines?: readonly TradeLine[];
  /** Engine candidates on this timeframe (already cut at the cursor in replay). */
  features?: FeatureSet;
  /** SMC candidates on this timeframe (already cut at the cursor in replay). */
  smc?: SmcSet;
  /** Harmonic (XABCD) candidates on this timeframe (already cut at the cursor in replay). */
  harmonics?: HarmonicPattern[];
  /** Chart (price-action) pattern candidates on this timeframe (already cut at the cursor). */
  chartPatterns?: ChartPattern[];
  /** Setups of the strategy version shown on the chart (M5). */
  setups?: { signalBarsAt: readonly number[]; long: boolean; label: string } | null;
  /** Which candidate layers to draw. */
  featureLayers?: readonly FeatureLayer[];
  /** Filled by the chart with a function that captures it as an image (for the journal). */
  screenshotRef?: MutableRefObject<ChartScreenshot | null>;
  /** Bring this time into view; a new `seq` repeats the jump (concept library examples). */
  focus?: { at: UtcMs; seq: number } | null;
  /** Overlays and oscillator (M8); omitted means none drawn. */
  indicators?: IndicatorSettings;
}

export type ChartScreenshot = () => Promise<{ mime: string; data: ArrayBuffer } | null>;

export interface TradeLine {
  kind: 'ENTRY' | 'ORDER' | 'STOP' | 'TARGET';
  price: number;
}
