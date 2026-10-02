import type { IanaTz, Instrument, ResampledCandle, SessionLevels, Timeframe } from '@trw/engine';
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
}

export interface TradeLine {
  kind: 'ENTRY' | 'ORDER' | 'STOP' | 'TARGET';
  price: number;
}
