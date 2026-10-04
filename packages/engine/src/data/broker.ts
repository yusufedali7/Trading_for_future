import { offsetMinutes } from '../core/tz';
import type { UtcMs } from '../core/types';
import { marketState } from '../instruments/hours';
import type { Instrument } from '../instruments/registry';
import type { CandleRow } from './columnar';

/** A 1m bar as a broker terminal gives it: open time in broker *server* time, epoch seconds. */
export interface BrokerBar {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export type OffsetResult =
  | { ok: true; offsetMs: number }
  | { ok: false; reason: 'NO_TICK' | 'MARKET_CLOSED' | 'STALE_TICK' };

const QUARTER = 15 * 60_000;
const TOLERANCE = 2 * 60_000;
const MAX_OFFSET = 14 * 3_600_000;

/**
 * Server time minus UTC, measured from the last tick (D39). Only trusted while the market is open
 * (a fresh tick), and only when the difference is within 2 minutes of a whole quarter hour; the
 * offset is never guessed or hard-coded.
 */
export function detectServerOffset(
  lastTickServerSec: number | null,
  utcNowMs: UtcMs,
  inst: Instrument,
): OffsetResult {
  if (lastTickServerSec === null) return { ok: false, reason: 'NO_TICK' };
  if (marketState(inst, utcNowMs) !== 'OPEN') return { ok: false, reason: 'MARKET_CLOSED' };
  const diff = lastTickServerSec * 1000 - utcNowMs;
  const rounded = Math.round(diff / QUARTER) * QUARTER;
  if (Math.abs(diff - rounded) > TOLERANCE || Math.abs(rounded) > MAX_OFFSET)
    return { ok: false, reason: 'STALE_TICK' };
  return { ok: true, offsetMs: rounded === 0 ? 0 : rounded };
}

/** Zones whose DST changes commonly move broker server clocks. */
const DST_ZONES = ['America/New_York', 'Europe/London', 'Europe/Athens'];

/**
 * Whether a DST change in New York, London or Eastern Europe falls inside [from, to]: bars older
 * than such a change may have been stamped with a different server offset than the measured one.
 */
export function offsetMayHaveChanged(from: UtcMs, to: UtcMs): boolean {
  return DST_ZONES.some((tz) => offsetMinutes(from, tz) !== offsetMinutes(to, tz));
}

export interface MergeResult {
  rows: CandleRow[];
  added: number;
  /** Bars already stored whose prices differ in the new data (the broker revised them). */
  revised: number;
}

/**
 * Merges broker bars (converted to UTC with the measured offset) into stored rows: sorted, one bar
 * per minute, newer data wins. Revisions are counted, never hidden.
 */
export function mergeBrokerBars(
  existing: readonly CandleRow[],
  bars: readonly BrokerBar[],
  offsetMs: number,
): MergeResult {
  const byTime = new Map(existing.map((r) => [r.t, r]));
  let added = 0;
  let revised = 0;
  for (const b of bars) {
    const t = b.t * 1000 - offsetMs;
    const row: CandleRow = { t, o: b.o, h: b.h, l: b.l, c: b.c, v: b.v };
    const old = byTime.get(t);
    if (!old) added++;
    else if (old.o !== row.o || old.h !== row.h || old.l !== row.l || old.c !== row.c) revised++;
    byTime.set(t, row);
  }
  return { rows: [...byTime.values()].sort((a, b) => a.t - b.t), added, revised };
}
