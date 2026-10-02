import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type MouseEventParams,
  type Time,
} from 'lightweight-charts';
import { BUILTIN_SESSIONS, timeframeMs, type ResampledCandle } from '@trw/engine';
import { tr } from '../i18n/tr';
import { positionToTime, timeToPosition } from './coords';
import { indexAtOrAfter, startOfLocalDay } from './goto';
import { fromChartTime, tickLabel, timeLabel, toCandleData, toVolumeData } from './lwc-adapter';
import { SessionBoxesPrimitive } from './primitives/session-boxes';
import { THEME } from './theme';
import type { ChartViewProps } from './types';
import { useDrawingLayer } from './use-drawing-layer';

const COLORS = { up: THEME.up, down: THEME.down, incomplete: THEME.incomplete };
const VOLUME_PANE_HEIGHT = 80;
const INITIAL_BARS = 150;
const SESSION_LABELS = Object.fromEntries(BUILTIN_SESSIONS.map((s) => [s.id, s.name]));

export function ChartView(props: ChartViewProps) {
  const { candles, sessions, instrument, timeframe, displayTz } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const sessionBoxesRef = useRef<SessionBoxesPrimitive | null>(null);
  // Previous bar times + timeframe, to keep the same time span visible across timeframe switches.
  const shownRef = useRef<{ times: number[]; tfMs: number } | null>(null);
  const [hovered, setHovered] = useState<ResampledCandle | null>(null);
  const [gotoValue, setGotoValue] = useState('');

  const byTime = useMemo(() => new Map(candles.map((c) => [c.t, c])), [candles]);
  const times = useMemo(() => candles.map((c) => c.t), [candles]);

  // Create the chart once.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: THEME.bg },
        textColor: THEME.text,
        fontSize: 11,
        attributionLogo: true, // Lightweight Charts licence attribution (NOTICE)
        panes: { separatorColor: THEME.border },
      },
      grid: { vertLines: { color: THEME.grid }, horzLines: { color: THEME.grid } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: THEME.border },
      timeScale: { borderColor: THEME.border, secondsVisible: false },
    });
    candleSeriesRef.current = chart.addSeries(CandlestickSeries, {
      upColor: THEME.up,
      downColor: THEME.down,
      borderUpColor: THEME.up,
      borderDownColor: THEME.down,
      wickUpColor: THEME.up,
      wickDownColor: THEME.down,
    });
    const boxes = new SessionBoxesPrimitive();
    candleSeriesRef.current.attachPrimitive(boxes);
    sessionBoxesRef.current = boxes;
    chartRef.current = chart;
    return () => {
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      sessionBoxesRef.current = null;
      shownRef.current = null;
    };
  }, []);

  // Price precision follows the instrument.
  useEffect(() => {
    candleSeriesRef.current?.applyOptions({
      priceFormat: {
        type: 'price',
        precision: instrument.pricePrecision,
        minMove: instrument.tickSize,
      },
    });
  }, [instrument]);

  // Labels follow the display zone; timestamps stay UTC.
  useEffect(() => {
    chartRef.current?.applyOptions({
      localization: {
        locale: 'tr-TR',
        timeFormatter: (time: Time) =>
          timeLabel(fromChartTime(time), timeframe, displayTz, instrument),
      },
      timeScale: {
        timeVisible: timeframe !== '1D' && timeframe !== '1W',
        tickMarkFormatter: (time: Time, type: number) =>
          tickLabel(fromChartTime(time), type, timeframe, displayTz, instrument),
      },
    });
  }, [timeframe, displayTz, instrument]);

  // Data.
  useEffect(() => {
    const chart = chartRef.current;
    const candleSeries = candleSeriesRef.current;
    if (!chart || !candleSeries) return;
    // Remember which time span was on screen before replacing the bars.
    const prev = shownRef.current;
    const prevRange = chart.timeScale().getVisibleLogicalRange();
    const keep =
      prev && prevRange && prev.times.length > 0
        ? {
            from: positionToTime(prev.times, prev.tfMs, prevRange.from),
            to: positionToTime(prev.times, prev.tfMs, prevRange.to),
          }
        : null;
    candleSeries.setData(toCandleData(candles, COLORS));
    const volume = toVolumeData(candles, COLORS);
    if (volume) {
      if (!volumeSeriesRef.current) {
        volumeSeriesRef.current = chart.addSeries(
          HistogramSeries,
          { priceFormat: { type: 'volume' }, priceLineVisible: false, lastValueVisible: false },
          1,
        );
        chart.panes()[1]?.setHeight(VOLUME_PANE_HEIGHT);
      }
      volumeSeriesRef.current.setData(volume);
    } else if (volumeSeriesRef.current) {
      chart.removeSeries(volumeSeriesRef.current);
      volumeSeriesRef.current = null;
    }
    const tfMs = timeframeMs(timeframe);
    const n = times.length;
    if (keep) {
      let from = timeToPosition(times, tfMs, keep.from);
      let to = timeToPosition(times, tfMs, keep.to);
      // Replay: when the newest bar reaches the right edge, slide the window with it.
      if (props.followLatest && n > 0 && n - 1 > to - 2) {
        const width = to - from;
        to = n + 2;
        from = to - width;
      }
      chart.timeScale().setVisibleLogicalRange({ from, to });
    } else if (n > 0) {
      chart.timeScale().setVisibleLogicalRange({ from: n - INITIAL_BARS, to: n + 5 });
    }
    shownRef.current = { times, tfMs };
    // timeframe/times change together with candles; candles is the trigger.
  }, [candles]);

  // Session boxes (engine layer). Hidden on daily/weekly charts where a session is narrower than a bar.
  useEffect(() => {
    const daily = timeframe === '1D' || timeframe === '1W';
    sessionBoxesRef.current?.setData(
      daily ? [] : sessions,
      times,
      timeframeMs(timeframe),
      SESSION_LABELS,
      tr.sessions.running,
    );
  }, [sessions, times, timeframe]);

  // User drawings (create, select, drag handles).
  useDrawingLayer(chartRef, candleSeriesRef, containerRef, { ...props, times });

  // Legend follows the crosshair; falls back to the last candle.
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const onMove = (p: MouseEventParams<Time>) => {
      setHovered(p.time === undefined ? null : (byTime.get(fromChartTime(p.time)) ?? null));
    };
    chart.subscribeCrosshairMove(onMove);
    return () => chart.unsubscribeCrosshairMove(onMove);
  }, [byTime]);

  const shown = hovered ?? candles[candles.length - 1] ?? null;
  const fmt = (x: number) => x.toFixed(instrument.pricePrecision);

  const onGoto = (e: FormEvent) => {
    e.preventDefault();
    const target = startOfLocalDay(gotoValue, displayTz);
    const chart = chartRef.current;
    if (target === null || !chart || times.length === 0) return;
    const i = indexAtOrAfter(times, target);
    chart.timeScale().setVisibleLogicalRange({ from: i - 20, to: i + 100 });
  };

  return (
    <div className="chart-wrap">
      <div className="chart-bar">
        <div className="legend" aria-live="off">
          {shown && (
            <>
              <span className="legend-sym">
                {instrument.symbol} · {timeframe}
              </span>
              <span>{timeLabel(shown.t, timeframe, displayTz, instrument)}</span>
              <span>
                {tr.legend.o} {fmt(shown.o)}
              </span>
              <span>
                {tr.legend.h} {fmt(shown.h)}
              </span>
              <span>
                {tr.legend.l} {fmt(shown.l)}
              </span>
              <span className={shown.c >= shown.o ? 'up' : 'down'}>
                {tr.legend.c} {fmt(shown.c)} {shown.c >= shown.o ? '▲' : '▼'}
              </span>
              {shown.v !== undefined && (
                <span>
                  {tr.legend.v} {shown.v.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}
                </span>
              )}
              {shown.sourceCount < shown.expectedCount && (
                <span className="warn">
                  {tr.legend.missing(shown.expectedCount - shown.sourceCount, shown.expectedCount)}
                </span>
              )}
              {!shown.complete && <span className="warn">{tr.legend.forming}</span>}
            </>
          )}
        </div>
        <form className="goto" onSubmit={onGoto}>
          <input
            type="date"
            value={gotoValue}
            onChange={(e) => setGotoValue(e.target.value)}
            aria-label={tr.toolbar.goTo}
          />
          <button type="submit" className="btn">
            {tr.toolbar.goToButton}
          </button>
        </form>
      </div>
      <div className="chart" data-testid="chart" ref={containerRef} />
    </div>
  );
}
