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
import { fibLevels, type Drawing, type Instrument, type SupportResistanceLevel } from '@trw/engine';
import { handlesOf, shapeOf, type PixelMapper, type Shape } from '../drawing-geometry';
import { dateRangeLabel, levelTag, positionLabels, priceRangeLabel } from '../drawing-labels';
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

function arrowHead(ctx: Ctx, x1: number, y1: number, x2: number, y2: number) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const len = 10;
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - len * Math.cos(a - Math.PI / 7), y2 - len * Math.sin(a - Math.PI / 7));
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - len * Math.cos(a + Math.PI / 7), y2 - len * Math.sin(a + Math.PI / 7));
  ctx.stroke();
}

function line(ctx: Ctx, x1: number, y1: number, x2: number, y2: number) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

const TALL = 10_000;

function drawShape(
  ctx: Ctx,
  d: Drawing,
  shape: Shape,
  m: PixelMapper,
  inst: Instrument,
  color: string,
) {
  const price = (p: number) => p.toFixed(inst.pricePrecision);
  switch (shape.type) {
    case 'hline': {
      const y = Math.round(shape.y) + 0.5;
      line(ctx, 0, y, m.width, y);
      ctx.fillStyle = color;
      ctx.textBaseline = 'top';
      ctx.fillText(price(d.anchors[0]!.p), 4, shape.y + 3);
      return;
    }
    case 'hray': {
      const y = Math.round(shape.y) + 0.5;
      line(ctx, shape.x, y, m.width, y);
      ctx.fillStyle = color;
      ctx.textBaseline = 'top';
      ctx.fillText(price(d.anchors[0]!.p), shape.x + 4, shape.y + 3);
      return;
    }
    case 'vline': {
      const x = Math.round(shape.x) + 0.5;
      line(ctx, x, -TALL, x, TALL);
      return;
    }
    case 'cross': {
      const x = Math.round(shape.x) + 0.5;
      const y = Math.round(shape.y) + 0.5;
      line(ctx, x, -TALL, x, TALL);
      line(ctx, 0, y, m.width, y);
      ctx.fillStyle = color;
      ctx.textBaseline = 'top';
      ctx.fillText(price(d.anchors[0]!.p), 4, shape.y + 3);
      return;
    }
    case 'segment':
      line(ctx, shape.x1, shape.y1, shape.x2, shape.y2);
      if (d.kind === 'ARROW') arrowHead(ctx, shape.x1, shape.y1, shape.x2, shape.y2);
      return;
    case 'channel': {
      const { a, b } = shape;
      ctx.fillStyle = withAlpha(color, 0.08);
      ctx.beginPath();
      ctx.moveTo(a.x1, a.y1);
      ctx.lineTo(a.x2, a.y2);
      ctx.lineTo(b.x2, b.y2);
      ctx.lineTo(b.x1, b.y1);
      ctx.closePath();
      ctx.fill();
      line(ctx, a.x1, a.y1, a.x2, a.y2);
      line(ctx, b.x1, b.y1, b.x2, b.y2);
      ctx.setLineDash([4, 4]);
      line(ctx, a.x1, (a.y1 + b.y1) / 2, a.x2, (a.y2 + b.y2) / 2);
      ctx.setLineDash([]);
      return;
    }
    case 'fib': {
      const kind = d.kind as 'FIB_RETRACEMENT' | 'FIB_EXTENSION';
      const rounded = new Map(fibLevels(inst, kind, d.anchors).map((l) => [l.level, l.price]));
      const w = shape.x2 - shape.x1;
      shape.levels.forEach((l, i) => {
        const next = shape.levels[i + 1];
        if (next) {
          ctx.fillStyle = withAlpha(color, i % 2 === 0 ? 0.06 : 0.11);
          ctx.fillRect(shape.x1, Math.min(l.y, next.y), w, Math.abs(next.y - l.y));
        }
        const y = Math.round(l.y) + 0.5;
        line(ctx, shape.x1, y, shape.x2, y);
        ctx.fillStyle = color;
        ctx.textBaseline = 'bottom';
        ctx.fillText(
          `${l.level} (${price(rounded.get(l.level) ?? l.price)})`,
          shape.x1 + 3,
          l.y - 2,
        );
      });
      // The points it was drawn from, dashed.
      ctx.setLineDash([4, 4]);
      const pts = d.anchors.map((a) => [m.x(a.t), m.y(a.p)] as const);
      for (let i = 1; i < pts.length; i++) {
        const [x1, y1] = pts[i - 1]!;
        const [x2, y2] = pts[i]!;
        if (x1 !== null && y1 !== null && x2 !== null && y2 !== null) line(ctx, x1, y1, x2, y2);
      }
      ctx.setLineDash([]);
      return;
    }
    case 'point': {
      if (d.kind === 'TEXT') {
        ctx.save();
        ctx.font = '13px system-ui, sans-serif';
        ctx.fillStyle = color;
        ctx.textBaseline = 'middle';
        ctx.fillText(d.text ?? '', shape.x, shape.y);
        ctx.restore();
        return;
      }
      // Direction is carried by the arrow's shape; the colour only repeats it.
      const up = d.kind === 'ARROW_UP';
      const dir = up ? 1 : -1;
      ctx.fillStyle = up ? THEME.up : THEME.down;
      ctx.beginPath();
      ctx.moveTo(shape.x, shape.y);
      ctx.lineTo(shape.x - 7, shape.y + dir * 10);
      ctx.lineTo(shape.x - 3, shape.y + dir * 10);
      ctx.lineTo(shape.x - 3, shape.y + dir * 20);
      ctx.lineTo(shape.x + 3, shape.y + dir * 20);
      ctx.lineTo(shape.x + 3, shape.y + dir * 10);
      ctx.lineTo(shape.x + 7, shape.y + dir * 10);
      ctx.closePath();
      ctx.fill();
      return;
    }
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
      if (d.kind === 'ELLIPSE') {
        ctx.fillStyle = withAlpha(color, 0.1);
        ctx.beginPath();
        ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        return;
      }
      const a = d.anchors[0]!;
      const b = d.anchors[1]!;
      const bars = m.bars ? m.bars(a.t, b.t) : null;
      if (d.kind === 'DATE_RANGE') {
        ctx.fillStyle = withAlpha(color, 0.1);
        ctx.fillRect(x, y, w, h);
        const midY = y + h / 2;
        line(ctx, shape.x1, midY, shape.x2, midY);
        arrowHead(ctx, shape.x1, midY, shape.x2, midY);
        const label = dateRangeLabel(bars, a, b);
        ctx.fillStyle = color;
        ctx.textBaseline = 'top';
        ctx.fillText(label, x + w / 2 - ctx.measureText(label).width / 2, y + h + 3);
        return;
      }
      // Price ranges: direction carries meaning, so it is colour-coded and also signed in text.
      const up = b.p >= a.p;
      const dirColor = up ? THEME.up : THEME.down;
      ctx.fillStyle = withAlpha(dirColor, 0.12);
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = dirColor;
      const midX = x + w / 2;
      line(ctx, midX, shape.y1, midX, shape.y2);
      arrowHead(ctx, midX, shape.y1, midX, shape.y2);
      let label = priceRangeLabel(inst, a, b);
      if (d.kind === 'DATE_PRICE_RANGE') {
        const midY = y + h / 2;
        line(ctx, shape.x1, midY, shape.x2, midY);
        arrowHead(ctx, shape.x1, midY, shape.x2, midY);
        label = `${label} · ${dateRangeLabel(bars, a, b)}`;
      }
      ctx.fillStyle = dirColor;
      ctx.textBaseline = up ? 'bottom' : 'top';
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
      line(ctx, x, shape.yEntry, x + w, shape.yEntry);
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
