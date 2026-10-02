import type { IanaTz, Instrument, ResampledCandle, SessionLevels, Timeframe } from '@trw/engine';
import type { MutableRefObject } from 'react';
import type { DrawingLayerProps } from './use-drawing-layer';

export interface ChartViewProps extends DrawingLayerProps {
  candles: readonly ResampledCandle[];
  /** Visible sessions with their levels (engine layer). */
  sessions: readonly SessionLevels[];
  instrument: Instrument;
  timeframe: Timeframe;
  displayTz: IanaTz;
  /** Replay: keep the newest bar in view as the cursor advances. */
  followLatest?: boolean;
  /** Replay trade: entry (or pending order), stop and target as horizontal price lines. */
  tradeLines?: readonly TradeLine[];
  /** Filled by the chart with a function that captures it as an image (for the journal). */
  screenshotRef?: MutableRefObject<ChartScreenshot | null>;
}

export type ChartScreenshot = () => Promise<{ mime: string; data: ArrayBuffer } | null>;

export interface TradeLine {
  kind: 'ENTRY' | 'ORDER' | 'STOP' | 'TARGET';
  price: number;
}
