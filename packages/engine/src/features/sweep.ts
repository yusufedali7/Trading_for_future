import type { Instrument } from '../instruments/registry';
import type { SessionLevels } from '../session/levels';
import { BUILTIN_SESSIONS, sessionInstances, type SessionDefinition } from '../session/sessions';
import type { Bars } from './bars';
import type {
  LiquidityKind,
  LiquidityLevel,
  LiquiditySweep,
  PeriodLevel,
  SweepParams,
  Swing,
} from './types';

export const SWEEP_DEFAULTS: SweepParams = { swingMaxAgeBars: 100 };

const DAY_MS = 86_400_000;

/** Start of the next occurrence of a session after `after` (calendar only). */
function nextSessionStart(
  inst: Instrument,
  def: SessionDefinition | undefined,
  after: number,
): number {
  if (!def) return after + DAY_MS;
  const next = sessionInstances(def, inst, after, after + 5 * DAY_MS).find(
    (s) => s.startUtc >= after,
  );
  return next ? next.startUtc : after + DAY_MS;
}

export interface LiquiditySources {
  swings: readonly Swing[];
  /** Previous day and week levels (periodLevels). */
  periods: readonly PeriodLevel[];
  /** Sessions with their levels; only finished ones become levels. */
  sessions: readonly SessionLevels[];
  /** Definitions of those sessions (built-in by default), for how long a level stays valid. */
  sessionDefs?: readonly SessionDefinition[];
  /** Chart timeframe length, for the swing level age limit. */
  barMs: number;
}

/**
 * Levels where liquidity is assumed to rest, definition v1 (docs/definitions/liquidity-sweep-v1.md):
 * confirmed swing highs/lows (for `swingMaxAgeBars` bars after they formed), previous day and
 * week high/low (during the next trading day/week) and finished session highs/lows (until the
 * same session starts again). Each is usable from the moment it is known.
 */
export function liquidityLevels(
  inst: Instrument,
  src: LiquiditySources,
  p: SweepParams = SWEEP_DEFAULTS,
): LiquidityLevel[] {
  const out: LiquidityLevel[] = [];
  const defs = new Map((src.sessionDefs ?? BUILTIN_SESSIONS).map((d) => [d.id, d]));
  for (const s of src.swings) {
    out.push({
      id: s.id,
      kind: s.kind === 'HIGH' ? 'SWING_HIGH' : 'SWING_LOW',
      side: s.kind,
      price: s.price,
      knownAt: s.confirmedAt,
      validUntil: s.formedAt + p.swingMaxAgeBars * src.barMs,
    });
  }
  for (const d of src.periods) {
    const [hi, lo]: [LiquidityKind, LiquidityKind] =
      d.period === 'DAY' ? ['PDH', 'PDL'] : ['PWH', 'PWL'];
    const common = { knownAt: d.knownAt, validUntil: d.validUntil };
    out.push({ id: `${d.id}:HIGH`, kind: hi, side: 'HIGH', price: d.high, ...common });
    out.push({ id: `${d.id}:LOW`, kind: lo, side: 'LOW', price: d.low, ...common });
  }
  for (const s of src.sessions) {
    if (!s.complete || s.high === null || s.low === null) continue;
    const common = {
      knownAt: s.endUtc,
      validUntil: nextSessionStart(inst, defs.get(s.sessionId), s.endUtc),
    };
    const id = `SESSION:${s.sessionId}:${s.startUtc}`;
    const kind = (side: 'HIGH' | 'LOW') => `${s.sessionId}_${side}` as LiquidityKind;
    out.push({ id: `${id}:HIGH`, kind: kind('HIGH'), side: 'HIGH', price: s.high, ...common });
    out.push({ id: `${id}:LOW`, kind: kind('LOW'), side: 'LOW', price: s.low, ...common });
  }
  return out.sort((a, b) => a.knownAt - b.knownAt || a.id.localeCompare(b.id));
}

/**
 * Liquidity sweeps, definition v1. A level is "taken" by the first bar that trades beyond it
 * (high above a HIGH level, low below a LOW level). If that bar also closes back on the level's
 * side (close ≤ a high level, ≥ a low level) it is a sweep; a close beyond is a break and no sweep.
 * Either way the level is used up. Only levels known before the bar opened and still valid count.
 */
export function detectSweeps(b: Bars, levels: readonly LiquidityLevel[]): LiquiditySweep[] {
  const pending = [...levels].sort((a, c) => a.knownAt - c.knownAt || a.id.localeCompare(c.id));
  const out: LiquiditySweep[] = [];
  let next = 0;
  let active: LiquidityLevel[] = [];
  for (let i = 0; i < b.length; i++) {
    const t = b.t[i]!;
    while (next < pending.length && pending[next]!.knownAt <= t) active.push(pending[next++]!);
    const keep: LiquidityLevel[] = [];
    for (const lv of active) {
      if (t >= lv.validUntil) continue;
      const high = lv.side === 'HIGH';
      const beyond = high ? b.h[i]! > lv.price : b.l[i]! < lv.price;
      if (!beyond) {
        keep.push(lv);
        continue;
      }
      const back = high ? b.c[i]! <= lv.price : b.c[i]! >= lv.price;
      if (back)
        out.push({
          id: `LIQUIDITY_SWEEP:v1:${lv.id}:${t}`,
          defVersion: 'v1',
          type: 'LIQUIDITY_SWEEP',
          direction: high ? 'BEARISH' : 'BULLISH',
          levelId: lv.id,
          levelKind: lv.kind,
          level: lv.price,
          extreme: high ? b.h[i]! : b.l[i]!,
          formedAt: t,
          formedIndex: i,
          confirmedAt: b.end[i]!,
          confirmedIndex: i,
        });
    }
    active = keep;
  }
  return out;
}
