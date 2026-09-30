import { IANAZone } from 'luxon';
import type { IanaTz, UtcMs } from './types';

export interface LocalDateTime {
  year: number;
  /** 1-12 */
  month: number;
  /** 1-31 */
  day: number;
  /** 0-23 */
  hour: number;
  minute: number;
  second?: number;
}

export interface LocalParts extends Required<LocalDateTime> {
  /** ISO weekday: 1 = Monday … 7 = Sunday */
  weekday: number;
  offsetMinutes: number;
}

export type LocalToUtcResult =
  | { kind: 'OK'; utc: UtcMs }
  /** Wall time occurred twice (clocks went back). Never resolved silently. */
  | { kind: 'AMBIGUOUS'; earlier: UtcMs; later: UtcMs }
  /** Wall time was skipped (clocks went forward). */
  | { kind: 'NONEXISTENT' };

const DAY_MS = 86_400_000;

function zone(tz: IanaTz): IANAZone {
  const z = IANAZone.create(tz);
  if (!z.isValid) throw new Error(`Unknown time zone: ${tz}`);
  return z;
}

export function isValidTimeZone(tz: string): boolean {
  return tz !== '' && IANAZone.isValidZone(tz);
}

// Modern zone transitions fall on quarter-hour UTC instants, so the offset is constant within
// each 15-minute UTC slot. Caching per slot keeps minute-by-minute scans (market hours,
// resampling) fast without changing results.
const SLOT_MS = 15 * 60_000;
const MAX_CACHED_SLOTS = 500_000;
const offsetCache = new Map<IanaTz, Map<number, number>>();

/** Offset of the zone from UTC at the given instant, in minutes (east positive). */
export function offsetMinutes(utc: UtcMs, tz: IanaTz): number {
  let byZone = offsetCache.get(tz);
  if (!byZone) {
    byZone = new Map();
    offsetCache.set(tz, byZone);
  }
  const slot = Math.floor(utc / SLOT_MS);
  let off = byZone.get(slot);
  if (off === undefined) {
    off = zone(tz).offset(slot * SLOT_MS);
    if (byZone.size >= MAX_CACHED_SLOTS) byZone.clear();
    byZone.set(slot, off);
  }
  return off;
}

function assertValidLocal(l: LocalDateTime): void {
  const second = l.second ?? 0;
  const naive = Date.UTC(l.year, l.month - 1, l.day, l.hour, l.minute, second);
  const d = new Date(naive);
  const ok =
    Number.isInteger(l.year) &&
    d.getUTCFullYear() === l.year &&
    d.getUTCMonth() === l.month - 1 &&
    d.getUTCDate() === l.day &&
    d.getUTCHours() === l.hour &&
    d.getUTCMinutes() === l.minute &&
    d.getUTCSeconds() === second;
  if (!ok) throw new Error(`Invalid local date-time: ${JSON.stringify(l)}`);
}

/**
 * Converts a wall-clock time in `tz` to UTC. DST gaps and overlaps are reported,
 * not guessed (CLAUDE.md: problems are reported, never silently fixed).
 */
export function localToUtc(local: LocalDateTime, tz: IanaTz): LocalToUtcResult {
  assertValidLocal(local);
  zone(tz); // validates the name
  const offsetAt = (t: UtcMs) => offsetMinutes(t, tz);
  // Wall time read as if it were UTC; the real instant is naive - offset.
  const naive = Date.UTC(
    local.year,
    local.month - 1,
    local.day,
    local.hour,
    local.minute,
    local.second ?? 0,
  );
  // Any offset valid for this wall time is in effect within a day of it.
  const candidateOffsets = new Set([
    offsetAt(naive - DAY_MS),
    offsetAt(naive),
    offsetAt(naive + DAY_MS),
  ]);
  const matches = [...candidateOffsets]
    .map((off) => naive - off * 60_000)
    .filter((t) => offsetAt(t) * 60_000 === naive - t)
    .sort((a, b) => a - b);
  const unique = [...new Set(matches)];
  if (unique.length === 0) return { kind: 'NONEXISTENT' };
  if (unique.length === 1) return { kind: 'OK', utc: unique[0]! };
  return { kind: 'AMBIGUOUS', earlier: unique[0]!, later: unique[unique.length - 1]! };
}

/** Wall-clock parts of a UTC instant in `tz`. */
export function utcToLocal(utc: UtcMs, tz: IanaTz): LocalParts {
  const off = offsetMinutes(utc, tz);
  const d = new Date(utc + off * 60_000);
  const dow = d.getUTCDay();
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    second: d.getUTCSeconds(),
    weekday: dow === 0 ? 7 : dow,
    offsetMinutes: off,
  };
}
