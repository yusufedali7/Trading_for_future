import { useState, type MouseEvent } from 'react';
import type { IanaTz } from '@trw/engine';
import { formatTime } from '../../format';

const W = 640;
const H = 200;
const PAD = { l: 56, r: 12, t: 10, b: 24 };

/** About four clean tick values covering [lo, hi]. */
export function niceTicks(lo: number, hi: number, count = 4): number[] {
  if (!(hi > lo)) return [lo];
  const raw = (hi - lo) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step)
    out.push(Math.round(v * 1e6) / 1e6);
  return out;
}

const money = (v: number) => v.toLocaleString('tr-TR', { maximumFractionDigits: 0 });

/** Single-series equity line: 2px line, 10% wash, hairline grid, crosshair tooltip on hover. */
export function EquityChart({
  points,
  displayTz,
  title,
}: {
  points: readonly { t: number; equity: number }[];
  displayTz: IanaTz;
  title: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2) return null;
  const values = points.map((p) => p.equity);
  const ticks = niceTicks(Math.min(...values), Math.max(...values));
  const lo = Math.min(ticks[0]!, ...values);
  const hi = Math.max(ticks[ticks.length - 1]!, ...values);
  const x = (i: number) => PAD.l + (i / (points.length - 1)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo || 1)) * (H - PAD.t - PAD.b);
  const line = points.map((p, i) => `${x(i).toFixed(1)},${y(p.equity).toFixed(1)}`).join(' ');
  const area = `${x(0)},${H - PAD.b} ${line} ${x(points.length - 1)},${H - PAD.b}`;
  const onMove = (e: MouseEvent<SVGRectElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * (W - PAD.l - PAD.r);
    setHover(
      Math.max(
        0,
        Math.min(points.length - 1, Math.round((px / (W - PAD.l - PAD.r)) * (points.length - 1))),
      ),
    );
  };
  const h = hover === null ? null : points[hover]!;
  return (
    <figure className="chart-figure">
      <figcaption>{title}</figcaption>
      <div className="chart-box">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title}>
          {ticks.map((v) => (
            <g key={v}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} className="grid" />
              <text
                x={PAD.l - 6}
                y={y(v)}
                className="tick"
                textAnchor="end"
                dominantBaseline="middle"
              >
                {money(v)}
              </text>
            </g>
          ))}
          <polygon points={area} className="area" />
          <polyline points={line} className="line" />
          {h && (
            <g>
              <line x1={x(hover!)} x2={x(hover!)} y1={PAD.t} y2={H - PAD.b} className="crosshair" />
              <circle cx={x(hover!)} cy={y(h.equity)} r={4} className="dot" />
            </g>
          )}
          <rect
            x={PAD.l}
            y={PAD.t}
            width={W - PAD.l - PAD.r}
            height={H - PAD.t - PAD.b}
            fill="transparent"
            onMouseMove={onMove}
            onMouseLeave={() => setHover(null)}
          />
        </svg>
        {h && (
          <div
            className="chart-tip"
            style={{ left: `${(x(hover!) / W) * 100}%`, top: `${(y(h.equity) / H) * 100}%` }}
          >
            <span>{formatTime(h.t, displayTz)}</span>
            <strong>{money(h.equity)} USD</strong>
          </div>
        )}
      </div>
    </figure>
  );
}

/** Columns per 0.5 R bucket; losses and wins in the direction colours, each with an axis label. */
export function RHistogram({
  buckets,
  title,
}: {
  buckets: readonly { from: number; count: number }[];
  title: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  if (buckets.length === 0) return null;
  const first = buckets[0]!.from;
  const last = buckets[buckets.length - 1]!.from;
  const all: { from: number; count: number }[] = [];
  for (let f = first; f <= last + 1e-9; f = Math.round((f + 0.5) * 2) / 2)
    all.push({ from: f, count: buckets.find((b) => b.from === f)?.count ?? 0 });
  const max = Math.max(...all.map((b) => b.count));
  const ticks = niceTicks(0, max, Math.min(4, max)).filter((v) => Number.isInteger(v));
  const slot = (W - PAD.l - PAD.r) / all.length;
  const bw = Math.min(24, slot - 2);
  const y = (v: number) => PAD.t + (1 - v / (max || 1)) * (H - PAD.t - PAD.b);
  const labelEvery = Math.ceil(all.length / 12);
  const h = hover === null ? null : all[hover]!;
  return (
    <figure className="chart-figure">
      <figcaption>{title}</figcaption>
      <div className="chart-box">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title}>
          {ticks.map((v) => (
            <g key={v}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} className="grid" />
              <text
                x={PAD.l - 6}
                y={y(v)}
                className="tick"
                textAnchor="end"
                dominantBaseline="middle"
              >
                {v}
              </text>
            </g>
          ))}
          {all.map((b, i) => {
            const cx = PAD.l + slot * (i + 0.5);
            const top = y(b.count);
            const height = H - PAD.b - top;
            const r = Math.min(4, height / 2, bw / 2);
            // Rounded data-end, square at the baseline.
            const d = `M${cx - bw / 2},${H - PAD.b} V${top + r} Q${cx - bw / 2},${top} ${cx - bw / 2 + r},${top} H${cx + bw / 2 - r} Q${cx + bw / 2},${top} ${cx + bw / 2},${top + r} V${H - PAD.b} Z`;
            return (
              <g key={b.from}>
                {b.count > 0 && <path d={d} className={b.from < 0 ? 'bar-down' : 'bar-up'} />}
                {i % labelEvery === 0 && (
                  <text x={cx} y={H - 8} className="tick" textAnchor="middle">
                    {b.from.toLocaleString('tr-TR')}
                  </text>
                )}
                <rect
                  x={cx - slot / 2}
                  y={PAD.t}
                  width={slot}
                  height={H - PAD.t - PAD.b}
                  fill="transparent"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                />
              </g>
            );
          })}
        </svg>
        {h && (
          <div
            className="chart-tip"
            style={{
              left: `${((PAD.l + slot * (hover! + 0.5)) / W) * 100}%`,
              top: `${(y(h.count) / H) * 100}%`,
            }}
          >
            <span>
              {h.from.toLocaleString('tr-TR')}R … {(h.from + 0.5).toLocaleString('tr-TR')}R
            </span>
            <strong>{h.count}</strong>
          </div>
        )}
      </div>
    </figure>
  );
}
