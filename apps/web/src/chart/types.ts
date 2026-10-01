import type { IanaTz, Instrument, ResampledCandle, SessionLevels, Timeframe } from '@trw/engine';

export interface ChartViewProps {
  candles: readonly ResampledCandle[];
  /** Visible sessions with their levels (engine layer). */
  sessions: readonly SessionLevels[];
  instrument: Instrument;
  timeframe: Timeframe;
  displayTz: IanaTz;
}
