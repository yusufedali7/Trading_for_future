import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  timeframeMs,
  type DataSetMeta,
  type IanaTz,
  type Timeframe,
  type UtcMs,
} from '@trw/engine';
import { startOfLocalDay } from '../../chart/goto';
import { composeReplay, type CandleSource, type ChartData } from '../../compute/candle-source';

/**
 * Replay state: a cursor on bar boundaries of the current timeframe. The chart only ever receives
 * data as known at the cursor; while a step is loading the previous (past-only) view stays.
 */
export function useReplay(
  source: CandleSource,
  active: DataSetMeta | null,
  data: (ChartData & { tf: Timeframe }) | null,
  displayTz: IanaTz,
) {
  const [cursor, setCursor] = useState<UtcMs | null>(null);
  const [view, setView] = useState<{ cursor: UtcMs; data: ChartData } | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speedMs, setSpeedMs] = useState(1000);

  const times = useMemo(() => data?.candles.map((c) => c.t) ?? [], [data]);
  /** One base bar after the last stored bar: everything is known. */
  const endCursor = active ? active.range.to + timeframeMs(active.baseTimeframe) : 0;
  const atEnd = cursor !== null && cursor >= endCursor;

  /** First index with times[i] >= x, or times.length. */
  const lowerBound = useCallback(
    (x: number) => {
      let lo = 0;
      let hi = times.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (times[mid]! < x) lo = mid + 1;
        else hi = mid;
      }
      return lo;
    },
    [times],
  );
  /** Next bar boundary after c; past the last bar, the end of the data. */
  const next = useCallback(
    (c: UtcMs) => times[lowerBound(c + 1)] ?? Math.max(c, endCursor),
    [times, lowerBound, endCursor],
  );
  /** Previous bar boundary before c. */
  const prev = useCallback((c: UtcMs) => times[lowerBound(c) - 1] ?? c, [times, lowerBound]);

  // Load the view for the cursor (and whenever the timeframe data changes under it).
  const requestRef = useRef(0);
  useEffect(() => {
    if (cursor === null || !active || !data) return;
    const request = ++requestRef.current;
    void source.replay(active, data.tf, cursor).then((tail) => {
      if (request === requestRef.current)
        setView({ cursor, data: composeReplay(data, tail, cursor) });
    });
  }, [source, active, data, cursor]);

  // Autoplay.
  useEffect(() => {
    if (!playing || cursor === null) return;
    if (atEnd) {
      setPlaying(false);
      return;
    }
    const id = setTimeout(() => setCursor((c) => (c === null ? c : next(c))), speedMs);
    return () => clearTimeout(id);
  }, [playing, cursor, atEnd, next, speedMs]);

  const start = (date: string) => {
    const t0 = startOfLocalDay(date, displayTz);
    if (t0 === null || times.length === 0) return;
    setView(null);
    setCursor(times[lowerBound(t0)] ?? endCursor);
  };

  return {
    cursor,
    /** Data as known at the cursor; null outside replay or until the first step has loaded. */
    view: cursor !== null && view ? view.data : null,
    playing,
    speedMs,
    atEnd,
    start,
    step: (dir: 1 | -1) => {
      setPlaying(false);
      setCursor((c) => (c === null ? c : dir === 1 ? next(c) : prev(c)));
    },
    togglePlay: () => setPlaying((p) => !p),
    pause: () => setPlaying(false),
    setSpeed: setSpeedMs,
    exit: () => {
      setPlaying(false);
      setCursor(null);
      setView(null);
    },
  };
}
