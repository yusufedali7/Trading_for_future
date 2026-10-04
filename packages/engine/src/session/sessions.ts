import { localToUtc, offsetMinutes } from '../core/tz';
import type { IanaTz, LocalTime, UtcMs } from '../core/types';
import { marketState } from '../instruments/hours';
import type { Instrument } from '../instruments/registry';

/** A trading session defined in local wall-clock time (CLAUDE.md: "Londra 08:00–17:00 Europe/London"). */
export interface SessionDefinition {
  id: string;
  name: string;
  tz: IanaTz;
  start: LocalTime;
  /** end <= start means the session ends on the next local day. */
  end: LocalTime;
  /** ISO weekdays (1 = Monday … 7 = Sunday) of the local start date. */
  days: number[];
  version: number;
}

export interface SessionInstance {
  sessionId: string;
  version: number;
  /** Local start date in the session's zone, YYYY-MM-DD. */
  date: string;
  startUtc: UtcMs;
  endUtc: UtcMs;
}

const WEEKDAYS = [1, 2, 3, 4, 5];

/**
 * Defaults, documented in docs/definitions/session-v1.md. There is no single official definition
 * of these sessions; users can add their own (e.g. an ICT-style 20:00–00:00 New York Asia range).
 */
export const BUILTIN_SESSIONS: readonly SessionDefinition[] = [
  {
    id: 'ASIA',
    name: 'Asya (Tokyo)',
    tz: 'Asia/Tokyo',
    start: '09:00',
    end: '18:00',
    days: WEEKDAYS,
    version: 1,
  },
  {
    id: 'LONDON',
    name: 'Londra',
    tz: 'Europe/London',
    start: '08:00',
    end: '17:00',
    days: WEEKDAYS,
    version: 1,
  },
  {
    id: 'NEW_YORK',
    name: 'New York',
    tz: 'America/New_York',
    start: '08:00',
    end: '17:00',
    days: WEEKDAYS,
    version: 1,
  },
];

/** Built-in sessions followed by the user's own (D35). */
export function allSessionDefs(user: readonly SessionDefinition[]): SessionDefinition[] {
  return [...BUILTIN_SESSIONS, ...user];
}

export type SessionProblem =
  | 'BAD_ID'
  | 'RESERVED_ID'
  | 'DUPLICATE_ID'
  | 'NO_NAME'
  | 'BAD_TZ'
  | 'BAD_TIME'
  | 'SAME_TIME'
  | 'NO_DAYS';

/** Upper-case id; liquidity levels are named `<ID>_HIGH` / `<ID>_LOW`. */
export const SESSION_ID_RE = /^[A-Z][A-Z0-9_]{1,15}$/;
const RESERVED_IDS = new Set([...BUILTIN_SESSIONS.map((s) => s.id), 'SWING', 'NONE']);
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Problems with a user session definition; `otherIds` are the ids already taken by other user sessions. */
export function validateSessionDefinition(
  def: SessionDefinition,
  otherIds: readonly string[],
  isValidTz: (tz: string) => boolean,
): SessionProblem[] {
  const out: SessionProblem[] = [];
  if (!SESSION_ID_RE.test(def.id)) out.push('BAD_ID');
  else if (RESERVED_IDS.has(def.id)) out.push('RESERVED_ID');
  else if (otherIds.includes(def.id)) out.push('DUPLICATE_ID');
  if (def.name.trim() === '') out.push('NO_NAME');
  if (!isValidTz(def.tz)) out.push('BAD_TZ');
  if (!TIME_RE.test(def.start) || !TIME_RE.test(def.end)) out.push('BAD_TIME');
  else if (def.start === def.end) out.push('SAME_TIME');
  if (def.days.length === 0 || def.days.some((d) => !Number.isInteger(d) || d < 1 || d > 7))
    out.push('NO_DAYS');
  return out;
}

export function getBuiltinSession(id: string): SessionDefinition {
  const s = BUILTIN_SESSIONS.find((d) => d.id === id);
  if (!s) throw new Error(`Unknown session: ${id}`);
  return s;
}

const DAY_MS = 86_400_000;
const SLOT_MS = 15 * 60_000;
const pad = (n: number) => String(n).padStart(2, '0');

function hm(time: LocalTime): [number, number] {
  const [h, m] = time.split(':').map(Number);
  return [h ?? 0, m ?? 0];
}

/**
 * Local wall time → UTC. Session boundaries are configuration, not data, so DST edge cases are
 * resolved deterministically instead of rejected: an overlap takes the earlier instant, a gap
 * moves the time forward by the gap length (the same rule as JS Date / Temporal "compatible").
 */
function wallToUtc(y: number, m: number, d: number, time: LocalTime, tz: IanaTz): UtcMs {
  const date = new Date(Date.UTC(y, m - 1, d));
  const [hh, mm] = hm(time);
  const local = {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: hh,
    minute: mm,
  };
  const res = localToUtc(local, tz);
  if (res.kind === 'OK') return res.utc;
  if (res.kind === 'AMBIGUOUS') return res.earlier;
  const naive = Date.UTC(local.year, local.month - 1, local.day, hh, mm);
  return naive - offsetMinutes(naive - DAY_MS, tz) * 60_000;
}

function hasOpenMarket(inst: Instrument, from: UtcMs, to: UtcMs): boolean {
  for (let s = from; s < to; s += SLOT_MS) if (marketState(inst, s) === 'OPEN') return true;
  return false;
}

/** Session occurrences overlapping [fromUtc, toUtc), in start order. Closed-market days are skipped. */
export function sessionInstances(
  def: SessionDefinition,
  inst: Instrument,
  fromUtc: UtcMs,
  toUtc: UtcMs,
): SessionInstance[] {
  const crossesMidnight =
    hm(def.end)[0] * 60 + hm(def.end)[1] <= hm(def.start)[0] * 60 + hm(def.start)[1];
  // Walk local calendar dates with a margin; the UTC overlap test below trims the edges.
  const first = new Date(fromUtc - 2 * DAY_MS);
  const last = new Date(toUtc + DAY_MS);
  const out: SessionInstance[] = [];
  for (
    let day = Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), first.getUTCDate());
    day <= last.getTime();
    day += DAY_MS
  ) {
    const date = new Date(day);
    const y = date.getUTCFullYear();
    const m = date.getUTCMonth() + 1;
    const d = date.getUTCDate();
    const weekday = date.getUTCDay() === 0 ? 7 : date.getUTCDay();
    if (!def.days.includes(weekday)) continue;
    const startUtc = wallToUtc(y, m, d, def.start, def.tz);
    const endUtc = wallToUtc(y, m, d + (crossesMidnight ? 1 : 0), def.end, def.tz);
    if (startUtc >= toUtc || endUtc <= fromUtc) continue;
    if (!hasOpenMarket(inst, startUtc, endUtc)) continue;
    out.push({
      sessionId: def.id,
      version: def.version,
      date: `${y}-${pad(m)}-${pad(d)}`,
      startUtc,
      endUtc,
    });
  }
  return out.sort((a, b) => a.startUtc - b.startUtc);
}
