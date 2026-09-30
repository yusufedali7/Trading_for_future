import type { IanaTz, Instrument, ResampledCandle, Timeframe } from '@trw/engine';

export interface ChartViewProps {
  candles: readonly ResampledCandle[];
  instrument: Instrument;
  timeframe: Timeframe;
  displayTz: IanaTz;
}
