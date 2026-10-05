import {
  positionStats,
  priceRangeStats,
  type Anchor,
  type Instrument,
  type SupportResistanceLevel,
} from '@trw/engine';
import { tr } from '../i18n/tr';

const MINUS = '−';

function num(n: number, digits: number): string {
  return Math.abs(n).toLocaleString('tr-TR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function signed(n: number, digits: number): string {
  return `${n < 0 ? MINUS : '+'}${num(n, digits)}`;
}

/** "1g 2s", "2s 0dk", "45dk" — the two most significant units. */
export function formatDuration(ms: number): string {
  const totalMin = Math.round(ms / 60_000);
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  const u = tr.drawings.units;
  if (d > 0) return `${d}${u.day} ${h}${u.hour}`;
  if (h > 0) return `${h}${u.hour} ${m}${u.minute}`;
  return `${m}${u.minute}`;
}

export function priceRangeLabel(inst: Instrument, a: Anchor, b: Anchor): string {
  const s = priceRangeStats(inst, a, b);
  return `${signed(s.pips, 1)} pip · ${signed(s.percent, 2)}% · ${formatDuration(s.durationMs)}`;
}

export function dateRangeLabel(bars: number | null, a: Anchor, b: Anchor): string {
  const duration = formatDuration(Math.abs(b.t - a.t));
  return bars === null ? duration : `${tr.drawings.bars(bars)} · ${duration}`;
}

export function positionLabels(
  inst: Instrument,
  kind: 'POSITION_LONG' | 'POSITION_SHORT',
  entry: number,
  stop: number,
  target: number,
) {
  const s = positionStats(inst, kind, entry, stop, target);
  return {
    target: tr.drawings.target(num(s.rewardPips, 1)),
    stop: tr.drawings.stop(num(s.riskPips, 1)),
    ratio: s.valid ? tr.drawings.ratio(num(s.rr, 2)) : tr.drawings.invalidPosition,
    valid: s.valid,
  };
}

export function levelTag(level: Pick<SupportResistanceLevel, 'kind' | 'timeframe' | 'status'>) {
  return `${tr.levels.kinds[level.kind]} · ${level.timeframe} · ${tr.levels.statuses[level.status]}`;
}
