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
import type { Drawing, Instrument, SupportResistanceLevel } from '@trw/engine';
import { handlesOf, shapeOf, type PixelMapper, type Shape } from '../drawing-geometry';
import { levelTag, positionLabels, priceRangeLabel } from '../drawing-labels';
import { THEME, withAlpha } from '../theme';

type DrawTarget = Parameters<IPrimitivePaneRenderer['draw']>[0];
type Ctx = CanvasRenderingContext2D;

export const DEFAULT_DRAWING_COLOR = '#c9d1d9';

export interface DrawingsLayerState {
  drawings: readonly Drawing[];
  levels: readonly SupportResistanceLevel[];
  selectedId: string | null;
  /** Drawing being created (first anchor placed, second follows the pointer). */
  preview: Drawing | null;
  instrument: Instrument;
  mapper: () => PixelMapper | null;
}

/** User drawings (source USER): solid lines, drawn above the candles. */
export class DrawingsPrimitive implements ISeriesPrimitive<Time> {
  private chart: IChartApiBase<Time> | null = null;
  private series: ISeriesApi<SeriesType, Time> | null = null;
  private requestUpdate: (() => void) | null = null;
  private state: DrawingsLayerState | null = null;

  private readonly view: IPrimitivePaneView = {
    zOrder: () => 'top',
    renderer: () => ({ draw: (target) => this.draw(target) }),
  };

  setState(state: DrawingsLayerState): void {
    this.state = state;
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
    const s = this.state;
    if (!s || !this.chart || !this.series) return;
    const m = s.mapper();
    if (!m) return;
    const levelByDrawing = new Map(s.levels.map((l) => [l.drawingId, l]));
    target.useMediaCoordinateSpace(({ context: ctx }) => {
      ctx.save();
      ctx.font = '11px system-ui, sans-serif';
      for (const d of s.drawings) {
        if (d.hidden) continue;
        this.drawOne(ctx, d, m, s.instrument, levelByDrawing.get(d.id), d.id === s.selectedId);
      }
      if (s.preview) this.drawOne(ctx, s.preview, m, s.instrument, undefined, false, true);
      ctx.restore();
    });
  }

  private drawOne(
    ctx: Ctx,
    d: Drawing,
    m: PixelMapper,
    inst: Instrument,
    level: SupportResistanceLevel | undefined,
    selected: boolean,
    preview = false,
  ): void {
    const shape = shapeOf(d, m);
    if (!shape) return;
    const color = d.style.color ?? DEFAULT_DRAWING_COLOR;
    ctx.strokeStyle = color;
    ctx.lineWidth = selected ? 2 : 1.5;
    ctx.setLineDash(preview ? [5, 4] : []);
    drawShape(ctx, d, shape, m, inst, color);
    if (level) {
      ctx.fillStyle = color;
      ctx.textBaseline = 'bottom';
      const tag = levelTag(level);
      const y =
        shape.type === 'hline' ? shape.y : shape.type === 'box' ? Math.min(shape.y1, shape.y2) : 0;
      const textW = ctx.measureText(tag).width;
      ctx.fillText(tag, Math.max(4, m.width - textW - 8), y - 3);
    }
    if (selected) {
      ctx.setLineDash([]);
      for (const h of handlesOf(d, m)) {
        const x = shape.type === 'hline' ? Math.min(Math.max(h.x, 6), m.width - 6) : h.x;
        ctx.fillStyle = THEME.bg;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.fillRect(x - 4, h.y - 4, 8, 8);
        ctx.strokeRect(x - 4, h.y - 4, 8, 8);
      }
    }
  }
}

function drawShape(
  ctx: Ctx,
  d: Drawing,
  shape: Shape,
  m: PixelMapper,
  inst: Instrument,
  color: string,
) {
  switch (shape.type) {
    case 'hline': {
      ctx.beginPath();
      ctx.moveTo(0, Math.round(shape.y) + 0.5);
      ctx.lineTo(m.width, Math.round(shape.y) + 0.5);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.textBaseline = 'top';
      ctx.fillText(d.anchors[0]!.p.toFixed(inst.pricePrecision), 4, shape.y + 3);
      return;
    }
    case 'segment':
      ctx.beginPath();
      ctx.moveTo(shape.x1, shape.y1);
      ctx.lineTo(shape.x2, shape.y2);
      ctx.stroke();
      return;
    case 'box': {
      const x = Math.min(shape.x1, shape.x2);
      const y = Math.min(shape.y1, shape.y2);
      const w = Math.abs(shape.x2 - shape.x1);
      const h = Math.abs(shape.y2 - shape.y1);
      if (d.kind === 'RECT') {
        ctx.fillStyle = withAlpha(color, 0.12);
        ctx.fillRect(x, y, w, h);
        ctx.strokeRect(x, y, w, h);
        return;
      }
      // Price range: direction carries meaning, so it is colour-coded and also signed in text.
      const up = d.anchors[1]!.p >= d.anchors[0]!.p;
      const dirColor = up ? THEME.up : THEME.down;
      ctx.fillStyle = withAlpha(dirColor, 0.12);
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = dirColor;
      ctx.beginPath();
      const midX = x + w / 2;
      ctx.moveTo(midX, shape.y1);
      ctx.lineTo(midX, shape.y2);
      ctx.stroke();
      ctx.fillStyle = dirColor;
      ctx.textBaseline = up ? 'bottom' : 'top';
      const label = priceRangeLabel(inst, d.anchors[0]!, d.anchors[1]!);
      const tw = ctx.measureText(label).width;
      ctx.fillText(label, midX - tw / 2, up ? y - 3 : y + h + 3);
      return;
    }
    case 'position': {
      const kind = d.kind as 'POSITION_LONG' | 'POSITION_SHORT';
      const labels = positionLabels(inst, kind, d.anchors[0]!.p, d.anchors[1]!.p, d.anchors[2]!.p);
      const x = Math.min(shape.x1, shape.x2);
      const w = Math.abs(shape.x2 - shape.x1);
      const profit = labels.valid ? THEME.up : THEME.incomplete;
      const loss = labels.valid ? THEME.down : THEME.incomplete;
      ctx.fillStyle = withAlpha(profit, 0.18);
      ctx.fillRect(
        x,
        Math.min(shape.yEntry, shape.yTarget),
        w,
        Math.abs(shape.yTarget - shape.yEntry),
      );
      ctx.fillStyle = withAlpha(loss, 0.18);
      ctx.fillRect(x, Math.min(shape.yEntry, shape.yStop), w, Math.abs(shape.yStop - shape.yEntry));
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(x, shape.yEntry);
      ctx.lineTo(x + w, shape.yEntry);
      ctx.stroke();
      ctx.textBaseline = 'middle';
      ctx.fillStyle = profit;
      ctx.fillText(labels.target, x + 4, (shape.yEntry + shape.yTarget) / 2);
      ctx.fillStyle = loss;
      ctx.fillText(labels.stop, x + 4, (shape.yEntry + shape.yStop) / 2);
      ctx.fillStyle = color;
      ctx.textBaseline = 'bottom';
      ctx.fillText(labels.ratio, x + 4, shape.yEntry - 3);
      return;
    }
  }
}
