import { useEffect, useRef, type RefObject } from 'react';
import {
  HistogramSeries,
  LineSeries,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
} from 'lightweight-charts';
import type { Instrument, ResampledCandle, Timeframe } from '@trw/engine';
import { computeIndicators, toLinePoints, type IndicatorSettings } from './indicator-settings';
import { toChartTime } from './lwc-adapter';
import { withAlpha } from './theme';

/** Candle-time/value pairs in the chart library's own time unit. */
function seriesData(candles: readonly ResampledCandle[], values: readonly (number | null)[]) {
  return toLinePoints(candles, values).map((p) => ({ time: toChartTime(p.time), value: p.value }));
}

// Same palette as the drawing tools (DrawingPanel.DRAWING_COLORS), kept independent to avoid a
// chart -> features import.
const BLUE = '#5b9bd5';
const AMBER = '#d4a72c';
const PURPLE = '#9b8bd4';
const COPPER = '#d0905e';
const GRAY = '#5c6573';

const OSCILLATOR_PANE = 2;
const OSCILLATOR_PANE_HEIGHT = 110;

type LineRef = ISeriesApi<'Line'> | null;

/** Draws SMA/EMA/Bollinger/VWAP on the price pane and RSI/MACD on their own pane. */
export function useIndicatorSeries(
  chartRef: RefObject<IChartApi | null>,
  candles: readonly ResampledCandle[],
  instrument: Instrument,
  timeframe: Timeframe,
  settings: IndicatorSettings | undefined,
): void {
  const sma = useRef<LineRef>(null);
  const ema = useRef<LineRef>(null);
  const bbUpper = useRef<LineRef>(null);
  const bbMiddle = useRef<LineRef>(null);
  const bbLower = useRef<LineRef>(null);
  const vwap = useRef<LineRef>(null);
  const oscLine = useRef<LineRef>(null);
  const oscSignal = useRef<ISeriesApi<'Histogram'> | LineRef>(null);
  const oscHist = useRef<ISeriesApi<'Histogram'> | null>(null);
  const oscType = useRef<'NONE' | 'RSI' | 'MACD'>('NONE');

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const s = settings;

    const line = (ref: RefObject<LineRef>, on: boolean, color: string, dashed = false) => {
      if (on && !ref.current) {
        ref.current = chart.addSeries(LineSeries, {
          color,
          lineWidth: 1,
          lineStyle: dashed ? LineStyle.Dashed : LineStyle.Solid,
          priceLineVisible: false,
          lastValueVisible: false,
        });
      } else if (!on && ref.current) {
        chart.removeSeries(ref.current);
        ref.current = null;
      }
      return ref.current;
    };

    if (candles.length === 0 || !s) {
      // No data (or no settings, e.g. tests): drop every overlay rather than show stale lines.
      line(sma, false, '');
      line(ema, false, '');
      line(bbUpper, false, '');
      line(bbMiddle, false, '');
      line(bbLower, false, '');
      line(vwap, false, '');
      if (oscLine.current) {
        chart.removeSeries(oscLine.current);
        oscLine.current = null;
      }
      if (oscSignal.current) {
        chart.removeSeries(oscSignal.current);
        oscSignal.current = null;
      }
      if (oscHist.current) {
        chart.removeSeries(oscHist.current);
        oscHist.current = null;
      }
      oscType.current = 'NONE';
      return;
    }

    const computed = computeIndicators(candles, instrument, timeframe, s);

    const smaS = line(sma, s.sma.on, BLUE);
    if (smaS && computed.sma) smaS.setData(seriesData(candles, computed.sma));

    const emaS = line(ema, s.ema.on, AMBER);
    if (emaS && computed.ema) emaS.setData(seriesData(candles, computed.ema));

    const vwapS = line(vwap, s.vwap.on, COPPER);
    if (vwapS && computed.vwap) vwapS.setData(seriesData(candles, computed.vwap));

    const upperS = line(bbUpper, s.bollinger.on, withAlpha(PURPLE, 0.7), true);
    const middleS = line(bbMiddle, s.bollinger.on, PURPLE, true);
    const lowerS = line(bbLower, s.bollinger.on, withAlpha(PURPLE, 0.7), true);
    if (computed.bollinger) {
      upperS?.setData(seriesData(candles, computed.bollinger.upper));
      middleS?.setData(seriesData(candles, computed.bollinger.middle));
      lowerS?.setData(seriesData(candles, computed.bollinger.lower));
    }

    // Oscillator pane: tear down on a type change, since RSI and MACD use different series.
    if (oscType.current !== s.oscillator) {
      if (oscLine.current) chart.removeSeries(oscLine.current);
      if (oscSignal.current) chart.removeSeries(oscSignal.current);
      if (oscHist.current) chart.removeSeries(oscHist.current);
      oscLine.current = null;
      oscSignal.current = null;
      oscHist.current = null;
      oscType.current = s.oscillator;
    }

    if (s.oscillator === 'RSI' && computed.rsi) {
      if (!oscLine.current) {
        oscLine.current = chart.addSeries(
          LineSeries,
          { color: BLUE, lineWidth: 1, priceLineVisible: false, lastValueVisible: false },
          OSCILLATOR_PANE,
        );
        chart.panes()[OSCILLATOR_PANE]?.setHeight(OSCILLATOR_PANE_HEIGHT);
        oscLine.current.createPriceLine({
          price: 70,
          color: GRAY,
          lineStyle: LineStyle.Dashed,
          lineWidth: 1,
          axisLabelVisible: true,
          title: '',
        });
        oscLine.current.createPriceLine({
          price: 30,
          color: GRAY,
          lineStyle: LineStyle.Dashed,
          lineWidth: 1,
          axisLabelVisible: true,
          title: '',
        });
      }
      oscLine.current.setData(seriesData(candles, computed.rsi));
    } else if (s.oscillator === 'MACD' && computed.macd) {
      if (!oscLine.current) {
        oscLine.current = chart.addSeries(
          LineSeries,
          { color: BLUE, lineWidth: 1, priceLineVisible: false, lastValueVisible: false },
          OSCILLATOR_PANE,
        );
        oscSignal.current = chart.addSeries(
          LineSeries,
          { color: AMBER, lineWidth: 1, priceLineVisible: false, lastValueVisible: false },
          OSCILLATOR_PANE,
        ) as LineRef;
        oscHist.current = chart.addSeries(
          HistogramSeries,
          { color: GRAY, priceLineVisible: false, lastValueVisible: false },
          OSCILLATOR_PANE,
        );
        chart.panes()[OSCILLATOR_PANE]?.setHeight(OSCILLATOR_PANE_HEIGHT);
      }
      oscLine.current.setData(seriesData(candles, computed.macd.line));
      (oscSignal.current as LineRef)?.setData(seriesData(candles, computed.macd.signal));
      oscHist.current?.setData(seriesData(candles, computed.macd.histogram));
    }
  }, [chartRef, candles, instrument, timeframe, settings]);
}
