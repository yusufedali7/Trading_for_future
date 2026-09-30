import {
  getInstrument,
  resample,
  timeframeMs,
  type CandleSeries,
  type DataSetMeta,
  type ResampledCandle,
  type Timeframe,
} from '@trw/engine';

/**
 * Candles for display. Data is historical, so `asOf` is the close of the last stored bar:
 * a bucket still open at that instant is marked incomplete.
 */
export async function candlesFor(
  meta: DataSetMeta,
  series: CandleSeries,
  tf: Timeframe,
): Promise<ResampledCandle[]> {
  const last = series.t[series.length - 1];
  if (last === undefined) return [];
  const asOf = last + timeframeMs(meta.baseTimeframe);
  return resample(series, getInstrument(meta.instrument), tf, {
    asOf,
    baseTimeframe: meta.baseTimeframe,
  });
}
