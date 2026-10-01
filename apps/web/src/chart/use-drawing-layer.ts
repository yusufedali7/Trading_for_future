import { useEffect, useRef, type RefObject } from 'react';
import type { IChartApi, ISeriesApi, MouseEventParams, Time } from 'lightweight-charts';
import {
  defaultPosition,
  roundToTick,
  timeframeMs,
  type Anchor,
  type Drawing,
  type DrawingKind,
  type Instrument,
  type SupportResistanceLevel,
  type Timeframe,
} from '@trw/engine';
import { positionToTime, timeToPosition } from './coords';
import { hitTestDrawings, hitTestHandle, type PixelMapper, type Point } from './drawing-geometry';
import { logicalToX, timeScaleAdapter, xToLogical } from './lwc-coords';
import { DrawingsPrimitive } from './primitives/drawings';

export type Tool = 'SELECT' | DrawingKind;

export interface DrawingLayerProps {
  drawings: readonly Drawing[];
  levels: readonly SupportResistanceLevel[];
  selectedId: string | null;
  tool: Tool;
  onDrawn: (kind: DrawingKind, anchors: Anchor[]) => void;
  onSelect: (id: string | null) => void;
  onChange: (d: Drawing) => void;
}

interface Inputs extends DrawingLayerProps {
  times: number[];
  timeframe: Timeframe;
  instrument: Instrument;
}

/** Moves one handle; positions keep stop and target on the same end time. */
export function moveAnchor(d: Drawing, index: number, to: Anchor): Drawing {
  const anchors = d.anchors.map((a) => ({ ...a }));
  if (d.kind === 'HLINE') anchors[0] = { t: anchors[0]!.t, p: to.p };
  else if ((d.kind === 'POSITION_LONG' || d.kind === 'POSITION_SHORT') && index > 0) {
    anchors[index] = { t: to.t, p: to.p };
    anchors[index === 1 ? 2 : 1]!.t = to.t;
  } else anchors[index] = to;
  return { ...d, anchors };
}

/**
 * User drawing layer: creation by clicks (with a live preview for two-point tools), selection,
 * and dragging handles. Drawings are stored in UTC + price, so they survive timeframe changes.
 */
export function useDrawingLayer(
  chartRef: RefObject<IChartApi | null>,
  seriesRef: RefObject<ISeriesApi<'Candlestick'> | null>,
  containerRef: RefObject<HTMLDivElement | null>,
  inputs: Inputs,
): void {
  const primitiveRef = useRef<DrawingsPrimitive | null>(null);
  const latest = useRef(inputs);
  latest.current = inputs;
  const pendingRef = useRef<Anchor | null>(null);
  const previewRef = useRef<Drawing | null>(null);
  const draftRef = useRef<Drawing | null>(null);
  const suppressClickRef = useRef(false);

  const mapper = (): PixelMapper | null => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!chart || !series) return null;
    const { times, timeframe } = latest.current;
    const ts = chart.timeScale();
    const adapter = timeScaleAdapter(ts);
    const tfMs = timeframeMs(timeframe);
    return {
      x: (t) => logicalToX(adapter, timeToPosition(times, tfMs, t)),
      y: (p) => series.priceToCoordinate(p),
      width: ts.width(),
    };
  };

  const anchorAt = (pt: Point): Anchor | null => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!chart || !series) return null;
    const { times, timeframe, instrument } = latest.current;
    const price = series.coordinateToPrice(pt.y);
    const logical = xToLogical(timeScaleAdapter(chart.timeScale()), pt.x);
    if (price === null || logical === null || times.length === 0) return null;
    return {
      t: positionToTime(times, timeframeMs(timeframe), logical),
      p: roundToTick(instrument, price),
    };
  };

  const render = () => {
    const prim = primitiveRef.current;
    if (!prim) return;
    const s = latest.current;
    const draft = draftRef.current;
    prim.setState({
      drawings: draft ? s.drawings.map((d) => (d.id === draft.id ? draft : d)) : s.drawings,
      levels: s.levels,
      selectedId: s.selectedId,
      preview: previewRef.current,
      instrument: s.instrument,
      mapper,
    });
  };

  // Attach the primitive once (the chart is created by the parent's first effect).
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    const prim = new DrawingsPrimitive();
    series.attachPrimitive(prim);
    primitiveRef.current = prim;
    render();
    return () => {
      primitiveRef.current = null;
    };
  }, []);

  // Re-render on any input change; switching tools cancels a half-finished drawing.
  const toolRef = useRef(inputs.tool);
  useEffect(() => {
    if (toolRef.current !== inputs.tool) {
      toolRef.current = inputs.tool;
      pendingRef.current = null;
      previewRef.current = null;
    }
    render();
  });

  // Clicks: create or select.
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const onClick = (param: MouseEventParams<Time>) => {
      if (suppressClickRef.current) {
        suppressClickRef.current = false;
        return;
      }
      if (!param.point) return;
      const s = latest.current;
      if (s.tool === 'SELECT') {
        const m = mapper();
        s.onSelect(m ? hitTestDrawings(s.drawings, param.point, m) : null);
        return;
      }
      const a = anchorAt(param.point);
      if (!a) return;
      const kind = s.tool;
      if (kind === 'HLINE') s.onDrawn(kind, [a]);
      else if (kind === 'POSITION_LONG' || kind === 'POSITION_SHORT') {
        s.onDrawn(kind, defaultPosition(s.instrument, kind, a, timeframeMs(s.timeframe)));
      } else if (!pendingRef.current) {
        pendingRef.current = a;
      } else {
        const first = pendingRef.current;
        pendingRef.current = null;
        previewRef.current = null;
        s.onDrawn(kind, [first, a]);
      }
    };
    const onMove = (param: MouseEventParams<Time>) => {
      const first = pendingRef.current;
      const s = latest.current;
      if (!first || !param.point || s.tool === 'SELECT') return;
      const b = anchorAt(param.point);
      if (!b) return;
      previewRef.current = {
        id: '__preview__',
        source: 'USER',
        kind: s.tool,
        instrument: s.instrument.symbol,
        createdOnTimeframe: s.timeframe,
        anchors: [first, b],
        style: {},
        locked: false,
        hidden: false,
        createdAt: 0,
        updatedAt: 0,
      };
      render();
    };
    chart.subscribeClick(onClick);
    chart.subscribeCrosshairMove(onMove);
    return () => {
      chart.unsubscribeClick(onClick);
      chart.unsubscribeCrosshairMove(onMove);
    };
  }, []);

  // Dragging handles of the selected drawing (select tool only).
  useEffect(() => {
    const el = containerRef.current;
    const chart = chartRef.current;
    if (!el || !chart) return;
    let drag: { index: number; base: Drawing; pointerId: number } | null = null;
    const local = (e: PointerEvent): Point => {
      const r = el.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const onDown = (e: PointerEvent) => {
      const s = latest.current;
      if (s.tool !== 'SELECT' || !s.selectedId) return;
      const selected = s.drawings.find((d) => d.id === s.selectedId);
      const m = mapper();
      if (!selected || selected.locked || !m) return;
      const index = hitTestHandle(selected, local(e), m);
      if (index === null) return;
      e.preventDefault();
      e.stopPropagation();
      chart.applyOptions({ handleScroll: false, handleScale: false });
      drag = { index, base: selected, pointerId: e.pointerId };
      el.setPointerCapture(e.pointerId);
    };
    const onMovePtr = (e: PointerEvent) => {
      if (!drag) return;
      const a = anchorAt(local(e));
      if (!a) return;
      draftRef.current = moveAnchor(drag.base, drag.index, a);
      render();
    };
    const onUp = () => {
      if (!drag) return;
      const draft = draftRef.current;
      el.releasePointerCapture(drag.pointerId);
      drag = null;
      draftRef.current = null;
      chart.applyOptions({ handleScroll: true, handleScale: true });
      suppressClickRef.current = true;
      if (draft) latest.current.onChange(draft);
      render();
    };
    // Capture phase so the chart does not start panning when a handle is grabbed.
    el.addEventListener('pointerdown', onDown, { capture: true });
    el.addEventListener('pointermove', onMovePtr);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    return () => {
      el.removeEventListener('pointerdown', onDown, { capture: true });
      el.removeEventListener('pointermove', onMovePtr);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
    };
  }, []);
}
