import { utcToLocal, type IanaTz, type UtcMs } from '@trw/engine';

const pad = (n: number) => String(n).padStart(2, '0');

/** "2026-01-06 15:00" in the given zone (UTC by default). */
export function formatTime(t: UtcMs, tz: IanaTz = 'UTC'): string {
  const l = utcToLocal(t, tz);
  return `${l.year}-${pad(l.month)}-${pad(l.day)} ${pad(l.hour)}:${pad(l.minute)}`;
}

export function formatTimeUtc(t: UtcMs): string {
  return `${formatTime(t)} UTC`;
}
