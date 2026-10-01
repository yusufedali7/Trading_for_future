import type { IanaTz, Instrument, ResampledCandle, SessionLevels, Timeframe } from '@trw/engine';
import type { DrawingLayerProps } from './use-drawing-layer';

export interface ChartViewProps extends DrawingLayerProps {
  candles: readonly ResampledCandle[];
  /** Visible sessions with their levels (engine layer). */
  sessions: readonly SessionLevels[];
  instrument: Instrument;
  timeframe: Timeframe;
  displayTz: IanaTz;
}
