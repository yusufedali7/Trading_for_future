import type {
  IChartApiBase,
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesApi,
  ISeriesPrimitive,
  SeriesAttachedParameter,
  SeriesType,
  Time,
} from 'lightweight-charts';
import { logicalToX, timeScaleAdapter } from '../lwc-coords';
import { THEME, withAlpha } from '../theme';
import { visibleItems, type FeatureItem, type Tone } from './feature-layout';

type DrawTarget = Parameters<IPrimitivePaneRenderer['draw']>[0];

/** Engine candidates avoid the user's drawing style: thin, dashed or translucent, always labelled. */
export const TONE_COLORS: Record<Tone, string> = {
  NEUTRAL: '#b8c0cc',
  UP: THEME.up,
  DOWN: THEME.down,
  SWEEP: '#d4a72c',
  DAY: '#7fa7d9',
  WEEK: '#b48ed1',
};

/**
 * ENGINE layer (M4): candidate swings, FVGs, structure breaks, sweeps and previous day/week
 * levels. Only what the chart data contains is drawn; in replay that is what was known at the
 * cursor (the data is filtered before it gets here).
 */
export class FeaturesPrimitive implements ISeriesPrimitive<Time> {
  private chart: IChartApiBase<Time> | null = null;
  private series: ISeriesApi<SeriesType, Time> | null = null;
  private requestUpdate: (() => void) | null = null;
  private items: readonly FeatureItem[] = [];
  private lastPos = 0;

  private readonly view: IPrimitivePaneView = {
    zOrder: () => 'normal',
    renderer: () => ({ draw: (target) => this.draw(target) }),
  };

  setData(items: readonly FeatureItem[], barCount: number): void {
    this.items = items;
    this.lastPos = barCount - 0.5;
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
    if (!chart || !series || this.items.length === 0) return;
    const ts = chart.timeScale();
    const range = ts.getVisibleLogicalRange();
    if (!range) return;
    const shown = visibleItems(this.items, range.from, range.to, this.lastPos);
    if (shown.length === 0) return;
    const adapter = timeScaleAdapter(ts);
    const toX = (p: number) => logicalToX(adapter, p);
    const toY = (price: number) => series.priceToCoordinate(price);
    const barSpace = ts.options().barSpacing;
    const showText = barSpace >= 4;
    // Zoomed far out a mark per bar is noise; lines and boxes still show the structure.
    const showMarks = barSpace >= 3;

    target.useMediaCoordinateSpace(({ context: ctx }) => {
      ctx.save();
      ctx.font = '10px system-ui, sans-serif';
      ctx.lineWidth = 1;
      for (const it of shown) {
        const color = TONE_COLORS[it.tone];
        if (it.shape === 'BOX') {
          const x1 = toX(it.p1);
          const x2 = toX(it.p2 ?? this.lastPos);
          const y1 = toY(it.top);
          const y2 = toY(it.bottom);
          if (x1 === null || x2 === null || y1 === null || y2 === null) continue;
          ctx.fillStyle = withAlpha(color, 0.1);
          ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
          ctx.strokeStyle = withAlpha(color, 0.45);
          ctx.setLineDash([2, 3]);
          ctx.strokeRect(
            Math.round(x1) + 0.5,
            Math.round(y1) + 0.5,
            Math.round(x2 - x1),
            Math.round(y2 - y1),
          );
          if (showText && x2 - x1 > 30) {
            ctx.fillStyle = withAlpha(color, 0.9);
            ctx.textBaseline = 'top';
            ctx.fillText(it.label, x1 + 2, y1 + 1);
          }
        } else if (it.shape === 'LINE') {
          const x1 = toX(it.p1);
          const x2 = toX(it.p2 ?? this.lastPos);
          const y = toY(it.price);
          if (x1 === null || x2 === null || y === null) continue;
          ctx.strokeStyle = withAlpha(color, 0.8);
          ctx.setLineDash(it.dashed ? [4, 3] : []);
          ctx.beginPath();
          ctx.moveTo(x1, Math.round(y) + 0.5);
          ctx.lineTo(x2, Math.round(y) + 0.5);
          ctx.stroke();
          if (showText) {
            ctx.fillStyle = withAlpha(color, 0.95);
            ctx.textBaseline = 'bottom';
            ctx.fillText(it.label, x1 + 2, y - 1);
          }
        } else if (showMarks) {
          const x = toX(it.p);
          const y = toY(it.price);
          if (x === null || y === null) continue;
          // Small triangle just beyond the wick: ▼ above highs, ▲ below lows.
          const d = it.above ? -1 : 1;
          const tip = y + d * (4 + it.stack * (showText && barSpace >= 8 ? 22 : 9));
          ctx.fillStyle = withAlpha(color, 0.9);
          ctx.beginPath();
          ctx.moveTo(x, tip);
          ctx.lineTo(x - 3.5, tip + d * 6);
          ctx.lineTo(x + 3.5, tip + d * 6);
          ctx.closePath();
          ctx.fill();
          if (showText && barSpace >= 8) {
            ctx.textAlign = 'center';
            ctx.textBaseline = it.above ? 'bottom' : 'top';
            ctx.fillText(it.label, x, tip + d * 8);
            ctx.textAlign = 'start';
          }
        }
      }
      ctx.restore();
    });
  }
}
