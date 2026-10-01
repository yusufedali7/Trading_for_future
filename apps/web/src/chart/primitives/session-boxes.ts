import type {
  IChartApiBase,
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesApi,
  ISeriesPrimitive,
  Logical,
  SeriesAttachedParameter,
  SeriesType,
  Time,
} from 'lightweight-charts';
import type { SessionLevels } from '@trw/engine';
import { logicalToX, timeScaleAdapter } from '../lwc-coords';
import { SESSION_COLORS, withAlpha } from '../theme';
import { layoutSessionBoxes } from './session-layout';

type DrawTarget = Parameters<IPrimitivePaneRenderer['draw']>[0];

/**
 * Engine-derived session boxes (source ENGINE): dashed outline + label, drawn behind the candles.
 * A session still running at the data end is drawn with a lighter, open-ended outline because its
 * high/low are not final yet (rule 3: no lookahead).
 */
export class SessionBoxesPrimitive implements ISeriesPrimitive<Time> {
  private chart: IChartApiBase<Time> | null = null;
  private series: ISeriesApi<SeriesType, Time> | null = null;
  private requestUpdate: (() => void) | null = null;
  private sessions: readonly SessionLevels[] = [];
  private times: ArrayLike<number> = [];
  private tfMs = 60_000;
  private labels: Record<string, string> = {};
  private runningLabel = '';

  private readonly view: IPrimitivePaneView = {
    zOrder: () => 'bottom',
    renderer: () => ({ draw: (target) => this.draw(target) }),
  };

  setData(
    sessions: readonly SessionLevels[],
    times: ArrayLike<number>,
    tfMs: number,
    labels: Record<string, string>,
    runningLabel: string,
  ): void {
    this.sessions = sessions;
    this.times = times;
    this.tfMs = tfMs;
    this.labels = labels;
    this.runningLabel = runningLabel;
    this.requestUpdate?.();
  }

  attached(param: SeriesAttachedParameter<Time>): void {
    this.chart = param.chart;
    this.series = param.series;
    this.requestUpdate = param.requestUpdate;
  }

  detached(): void {
    this.chart = null;
    this.series = null;
    this.requestUpdate = null;
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return [this.view];
  }

  private draw(target: DrawTarget): void {
    const chart = this.chart;
    const series = this.series;
    if (!chart || !series || this.sessions.length === 0) return;
    const ts = chart.timeScale();
    const range = ts.getVisibleLogicalRange();
    if (!range) return;
    const boxes = layoutSessionBoxes(
      this.sessions,
      this.times,
      this.tfMs,
      { from: range.from, to: range.to },
      (p) => logicalToX(timeScaleAdapter(ts), p),
      (price) => series.priceToCoordinate(price),
    );
    target.useMediaCoordinateSpace(({ context: ctx }) => {
      ctx.save();
      ctx.font = '10px system-ui, sans-serif';
      ctx.textBaseline = 'bottom';
      for (const b of boxes) {
        const color = SESSION_COLORS[b.sessionId] ?? '#8a94a3';
        const w = b.x2 - b.x1;
        const h = b.yBottom - b.yTop;
        ctx.fillStyle = withAlpha(color, b.complete ? 0.08 : 0.04);
        ctx.fillRect(b.x1, b.yTop, w, h);
        ctx.strokeStyle = withAlpha(color, b.complete ? 0.75 : 0.45);
        ctx.lineWidth = 1;
        ctx.setLineDash(b.complete ? [4, 3] : [2, 4]);
        ctx.strokeRect(
          Math.round(b.x1) + 0.5,
          Math.round(b.yTop) + 0.5,
          Math.round(w),
          Math.round(h),
        );
        if (w > 28) {
          const name = this.labels[b.sessionId] ?? b.sessionId;
          ctx.fillStyle = withAlpha(color, 0.95);
          ctx.fillText(b.complete ? name : `${name} · ${this.runningLabel}`, b.x1 + 3, b.yTop - 2);
        }
      }
      ctx.restore();
    });
  }
}
