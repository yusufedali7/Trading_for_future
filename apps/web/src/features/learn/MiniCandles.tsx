import type { Bars } from '@trw/engine';

const W = 640;
const H = 220;
const PAD = 8;

export interface MiniCandlesProps {
  bars: Bars;
  from: number;
  /** Last bar drawn (inclusive). */
  to: number;
  /** Bar the question is about. */
  subject: number;
  /** "Now" for the learner while answering; drawn as a line once later bars are shown. */
  cursor: number;
  /** Shown after answering: a price line (swing) or a price band (gap). */
  mark?: { price: number } | { top: number; bottom: number; from: number };
  label: string;
}

/** A small, self-contained candle chart for practice questions (no chart-library state). */
export function MiniCandles(p: MiniCandlesProps) {
  const idx = Array.from({ length: p.to - p.from + 1 }, (_, i) => p.from + i);
  let lo = Math.min(...idx.map((i) => p.bars.l[i]!));
  let hi = Math.max(...idx.map((i) => p.bars.h[i]!));
  if (p.mark && 'top' in p.mark) {
    lo = Math.min(lo, p.mark.bottom);
    hi = Math.max(hi, p.mark.top);
  }
  const span = hi - lo || 1;
  const slot = (W - 2 * PAD) / idx.length;
  const x = (i: number) => PAD + (i - p.from + 0.5) * slot;
  const y = (price: number) => PAD + ((hi - price) / span) * (H - 2 * PAD);
  const body = Math.max(1, slot * 0.6);
  return (
    <svg className="mini-candles" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={p.label}>
      <rect x={x(p.subject) - slot / 2} y={0} width={slot} height={H} className="mini-subject" />
      {p.to > p.cursor && (
        <line
          x1={x(p.cursor) + slot / 2}
          x2={x(p.cursor) + slot / 2}
          y1={0}
          y2={H}
          className="mini-cursor"
        />
      )}
      {p.mark && 'price' in p.mark && (
        <line
          x1={PAD}
          x2={W - PAD}
          y1={y(p.mark.price)}
          y2={y(p.mark.price)}
          className="mini-mark"
        />
      )}
      {p.mark && 'top' in p.mark && (
        <rect
          x={x(p.mark.from) - slot / 2}
          y={y(p.mark.top)}
          width={x(p.to) - x(p.mark.from) + slot}
          height={Math.max(1, y(p.mark.bottom) - y(p.mark.top))}
          className="mini-zone"
        />
      )}
      {idx.map((i) => {
        const o = p.bars.o[i]!;
        const c = p.bars.c[i]!;
        const up = c >= o;
        return (
          <g key={i} className={up ? 'mini-up' : 'mini-down'}>
            <line x1={x(i)} x2={x(i)} y1={y(p.bars.h[i]!)} y2={y(p.bars.l[i]!)} />
            <rect
              x={x(i) - body / 2}
              y={y(Math.max(o, c))}
              width={body}
              height={Math.max(1, Math.abs(y(o) - y(c)))}
            />
          </g>
        );
      })}
    </svg>
  );
}
