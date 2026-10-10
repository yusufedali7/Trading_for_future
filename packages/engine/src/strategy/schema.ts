import { createTextHasher } from '../core/hash';
import { isTimeframe, type Timeframe } from '../core/timeframe';
import { isValidTimeZone } from '../core/tz';
import type { IanaTz, LocalTime, UtcMs } from '../core/types';
import type { Direction } from '../execution/trade-sim';
import { FEATURE_DEFAULTS, type FeatureParams } from '../features/compute';
import type { FeatureDirection, LiquidityKind } from '../features/types';
import { listInstruments } from '../instruments/registry';
import { CHART_PATTERN_IDS } from '../patterns/chart-registry';
import {
  BUILTIN_SESSIONS,
  allSessionDefs,
  validateSessionDefinition,
  type SessionDefinition,
} from '../session/sessions';

/** Strategy schema v1 (D31): typed, ordered event steps; no free-text conditions. */
export type StepType =
  | 'LIQUIDITY_SWEEP'
  | 'STRUCTURE_BREAK'
  | 'FVG'
  | 'SWING'
  | 'ORDER_BLOCK'
  | 'IFVG'
  | 'BREAKER'
  | 'OTE'
  | 'PATTERN_EVENT';

interface StepBase {
  /** Lower-case id used in references (`sweep.extreme`). */
  id: string;
  /** Steps after the first: must be confirmed within this many bars after the previous step. */
  maxBars?: number;
}
export interface SweepStep extends StepBase {
  type: 'LIQUIDITY_SWEEP';
  direction?: FeatureDirection;
  /** Only sweeps of these level kinds; empty/missing = any. */
  levels?: LiquidityKind[];
}
export interface BreakStep extends StepBase {
  type: 'STRUCTURE_BREAK';
  direction?: FeatureDirection;
  kind?: 'BOS' | 'CHOCH';
}
export interface FvgStep extends StepBase {
  type: 'FVG';
  direction?: FeatureDirection;
}
export interface SwingStep extends StepBase {
  type: 'SWING';
  kind?: 'HIGH' | 'LOW';
}
/** D58: the M9 SMC concepts that have a single direction + invalidation price (D49–D50). */
export interface OrderBlockStep extends StepBase {
  type: 'ORDER_BLOCK';
  direction?: FeatureDirection;
}
export interface IfvgStep extends StepBase {
  type: 'IFVG';
  direction?: FeatureDirection;
}
export interface BreakerStep extends StepBase {
  type: 'BREAKER';
  direction?: FeatureDirection;
}
export interface OteStep extends StepBase {
  type: 'OTE';
  direction?: FeatureDirection;
}
/**
 * D63: any of the 21 M9 chart-pattern detectors (`patterns/chart-registry.ts`) that share the
 * `ChartPattern` shape (direction + invalidation/target price). Candlestick and harmonic patterns
 * are a different shape and aren't usable here yet (see that registry's own doc comment).
 */
export interface PatternEventStep extends StepBase {
  type: 'PATTERN_EVENT';
  /** A `CHART_PATTERN_IDS` entry, e.g. "double_bottom". */
  patternId: string;
  direction?: FeatureDirection;
}
export type EventStep =
  | SweepStep
  | BreakStep
  | FvgStep
  | SwingStep
  | OrderBlockStep
  | IfvgStep
  | BreakerStep
  | OteStep
  | PatternEventStep;

/** `stepId.field` */
export type Ref = string;

export type EntryRule =
  { type: 'MARKET' } | { type: 'LIMIT_AT' | 'STOP_AT'; ref: Ref; expireBars: number };

export type StopRule =
  { type: 'BEYOND_REF'; ref: Ref; bufferPips: number } | { type: 'FIXED_PIPS'; pips: number };

export type TargetRule =
  | { type: 'R_MULTIPLE'; r: number }
  | { type: 'FIXED_PIPS'; pips: number }
  | { type: 'AT_REF'; ref: Ref; bufferPips: number };

export interface TimeWindow {
  start: LocalTime;
  end: LocalTime;
  tz: IanaTz;
}

export interface StrategySpec {
  schema: 'strategy/v1';
  instrument: string;
  timeframe: Timeframe;
  direction: Direction;
  /** The setup (last step) must be confirmed inside this local-time window; null = any time. */
  window: TimeWindow | null;
  steps: EventStep[];
  entry: EntryRule;
  stop: StopRule;
  target: TargetRule;
  risk: { percentPerTrade: number };
  maxTradesPerDay: number | null;
  /** Detector parameters are part of the strategy, so a version always reproduces. */
  features: FeatureParams;
  /**
   * Copies of the user sessions this version refers to (D35): editing or deleting a session later
   * never changes the results of a saved version. Built-in sessions are not copied.
   */
  sessions?: SessionDefinition[];
}

export type StrategyStatus =
  'IDEA' | 'RESEARCH' | 'TESTING' | 'VALIDATED_ON_SAMPLE' | 'PAPER' | 'LIVE_CANDIDATE';

export const STRATEGY_STATUSES: readonly StrategyStatus[] = [
  'IDEA',
  'RESEARCH',
  'TESTING',
  'VALIDATED_ON_SAMPLE',
  'PAPER',
  'LIVE_CANDIDATE',
];

/** Strategy-data domain: the named idea; its rules live in immutable versions. */
export interface Strategy {
  id: string;
  name: string;
  description: string;
  latestVersion: number;
  createdAt: UtcMs;
  updatedAt: UtcMs;
}

/** An immutable rule set (D6). Only `status`/`statusHistory` may change after saving. */
export interface StrategyVersion {
  strategyId: string;
  version: number;
  spec: StrategySpec;
  specHash: string;
  changeNote: string;
  createdAt: UtcMs;
  status: StrategyStatus;
  statusHistory: { status: StrategyStatus; at: UtcMs; note?: string }[];
}

export const REF_FIELDS: Record<StepType, readonly string[]> = {
  LIQUIDITY_SWEEP: ['level', 'extreme'],
  STRUCTURE_BREAK: ['level'],
  FVG: ['top', 'bottom', 'mid'],
  SWING: ['price'],
  ORDER_BLOCK: ['top', 'bottom', 'mid'],
  IFVG: ['top', 'bottom', 'mid'],
  BREAKER: ['top', 'bottom', 'mid'],
  OTE: ['top', 'bottom', 'mid', 'sweetSpot'],
  /** `targetPrice`/`invalidationRef` are sometimes absent at runtime (some chart patterns define
   * no target or no invalidation level, e.g. `symmetrical_triangle`) - a step referencing a ref
   * that a particular match lacks simply fails that match (D63, same as a missing feature ref). */
  PATTERN_EVENT: ['confirmationRef', 'targetPrice', 'invalidationRef'],
};

/** Every reference the steps make available, in step order. */
export function availableRefs(steps: readonly EventStep[]): Ref[] {
  return steps.flatMap((s) => REF_FIELDS[s.type].map((f) => `${s.id}.${f}`));
}

export function defaultSpec(instrument = 'EURUSD'): StrategySpec {
  return {
    schema: 'strategy/v1',
    instrument,
    timeframe: '15m',
    direction: 'LONG',
    window: null,
    steps: [{ id: 'sweep', type: 'LIQUIDITY_SWEEP', direction: 'BULLISH' }],
    entry: { type: 'MARKET' },
    stop: { type: 'BEYOND_REF', ref: 'sweep.extreme', bufferPips: 1 },
    target: { type: 'R_MULTIPLE', r: 2 },
    risk: { percentPerTrade: 0.5 },
    maxTradesPerDay: null,
    features: FEATURE_DEFAULTS,
  };
}

export type SpecProblemCode =
  | 'UNKNOWN_INSTRUMENT'
  | 'BAD_TIMEFRAME'
  | 'NO_STEPS'
  | 'BAD_STEP_ID'
  | 'DUPLICATE_STEP_ID'
  | 'MAX_BARS'
  | 'BAD_REF'
  | 'EXPIRE_BARS'
  | 'BAD_NUMBER'
  | 'RISK_RANGE'
  | 'BAD_WINDOW'
  | 'MAX_PER_DAY'
  | 'FEATURE_PARAMS'
  | 'BAD_SESSION'
  | 'UNKNOWN_LEVEL'
  | 'UNKNOWN_PATTERN';

export interface SpecProblem {
  code: SpecProblemCode;
  /** Where in the spec, e.g. "steps.1.maxBars". */
  path: string;
}

export type SpecWarningCode = 'DIRECTION_MISMATCH';
export interface SpecWarning {
  code: SpecWarningCode;
  path: string;
}

const ID_RE = /^[a-z][a-z0-9_]{0,23}$/;
const FIXED_LEVELS = ['SWING_HIGH', 'SWING_LOW', 'PDH', 'PDL', 'PWH', 'PWL'];

/** Ids of the user sessions a spec's sweep steps refer to (to copy into `spec.sessions`). */
export function referencedSessionIds(steps: readonly EventStep[]): string[] {
  const builtin = new Set(BUILTIN_SESSIONS.map((d) => d.id));
  const ids = steps.flatMap((st) =>
    st.type === 'LIQUIDITY_SWEEP'
      ? (st.levels ?? [])
          .filter((l) => !FIXED_LEVELS.includes(l))
          .map((l) => l.replace(/_(HIGH|LOW)$/, ''))
      : [],
  );
  return [...new Set(ids)].filter((id) => !builtin.has(id));
}
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const posInt = (x: unknown) => Number.isInteger(x) && (x as number) >= 1;
const nonNeg = (x: unknown) => typeof x === 'number' && Number.isFinite(x) && x >= 0;
const pos = (x: unknown) => typeof x === 'number' && Number.isFinite(x) && x > 0;

/** Static checks before a version can be saved (D31). Empty list = valid. */
export function validateSpec(s: StrategySpec): SpecProblem[] {
  const out: SpecProblem[] = [];
  const bad = (code: SpecProblemCode, path: string) => out.push({ code, path });
  if (!listInstruments().some((i) => i.symbol === s.instrument))
    bad('UNKNOWN_INSTRUMENT', 'instrument');
  if (!isTimeframe(s.timeframe)) bad('BAD_TIMEFRAME', 'timeframe');
  if (s.steps.length === 0) bad('NO_STEPS', 'steps');
  const seen = new Set<string>();
  s.steps.forEach((st, i) => {
    if (!ID_RE.test(st.id)) bad('BAD_STEP_ID', `steps.${i}.id`);
    else if (seen.has(st.id)) bad('DUPLICATE_STEP_ID', `steps.${i}.id`);
    seen.add(st.id);
    if (i > 0 && !posInt(st.maxBars)) bad('MAX_BARS', `steps.${i}.maxBars`);
  });
  const refs = new Set(availableRefs(s.steps));
  const checkRef = (ref: string, path: string) => {
    if (!refs.has(ref)) bad('BAD_REF', path);
  };
  if (s.entry.type !== 'MARKET') {
    checkRef(s.entry.ref, 'entry.ref');
    if (!posInt(s.entry.expireBars)) bad('EXPIRE_BARS', 'entry.expireBars');
  }
  if (s.stop.type === 'BEYOND_REF') {
    checkRef(s.stop.ref, 'stop.ref');
    if (!nonNeg(s.stop.bufferPips)) bad('BAD_NUMBER', 'stop.bufferPips');
  } else if (!pos(s.stop.pips)) bad('BAD_NUMBER', 'stop.pips');
  if (s.target.type === 'R_MULTIPLE' && !pos(s.target.r)) bad('BAD_NUMBER', 'target.r');
  if (s.target.type === 'FIXED_PIPS' && !pos(s.target.pips)) bad('BAD_NUMBER', 'target.pips');
  if (s.target.type === 'AT_REF') {
    checkRef(s.target.ref, 'target.ref');
    if (!nonNeg(s.target.bufferPips)) bad('BAD_NUMBER', 'target.bufferPips');
  }
  const risk = s.risk.percentPerTrade;
  if (!pos(risk) || risk > 5) bad('RISK_RANGE', 'risk.percentPerTrade');
  if (s.window) {
    const w = s.window;
    if (
      !TIME_RE.test(w.start) ||
      !TIME_RE.test(w.end) ||
      w.start === w.end ||
      !isValidTimeZone(w.tz)
    )
      bad('BAD_WINDOW', 'window');
  }
  if (s.maxTradesPerDay !== null && !posInt(s.maxTradesPerDay))
    bad('MAX_PER_DAY', 'maxTradesPerDay');
  const f = s.features;
  if (
    !posInt(f.swing.left) ||
    !posInt(f.swing.right) ||
    !nonNeg(f.fvg.minSizePips) ||
    !posInt(f.sweep.swingMaxAgeBars) ||
    (f.structure.breakBy !== 'CLOSE' && f.structure.breakBy !== 'WICK')
  )
    bad('FEATURE_PARAMS', 'features');
  const sessions = s.sessions ?? [];
  sessions.forEach((d, i) => {
    const others = sessions.filter((_, k) => k !== i).map((x) => x.id);
    if (validateSessionDefinition(d, others, isValidTimeZone).length > 0)
      bad('BAD_SESSION', `sessions.${i}`);
  });
  const known = new Set([
    ...FIXED_LEVELS,
    ...allSessionDefs(sessions).flatMap((d) => [`${d.id}_HIGH`, `${d.id}_LOW`]),
  ]);
  s.steps.forEach((st, i) => {
    if (st.type === 'LIQUIDITY_SWEEP' && st.levels?.some((l) => !known.has(l)))
      bad('UNKNOWN_LEVEL', `steps.${i}.levels`);
    if (st.type === 'PATTERN_EVENT' && !CHART_PATTERN_IDS.includes(st.patternId))
      bad('UNKNOWN_PATTERN', `steps.${i}.patternId`);
  });
  return out;
}

/** Not errors, but probably not what was meant (e.g. a long after a bearish break). */
const DIRECTIONAL_STEP_TYPES: readonly StepType[] = [
  'STRUCTURE_BREAK',
  'FVG',
  'ORDER_BLOCK',
  'IFVG',
  'BREAKER',
  'OTE',
  'PATTERN_EVENT',
];

export function specWarnings(s: StrategySpec): SpecWarning[] {
  const against: FeatureDirection = s.direction === 'LONG' ? 'BEARISH' : 'BULLISH';
  return s.steps.flatMap((st, i) =>
    DIRECTIONAL_STEP_TYPES.includes(st.type) && 'direction' in st && st.direction === against
      ? [{ code: 'DIRECTION_MISMATCH' as const, path: `steps.${i}.direction` }]
      : [],
  );
}

/** JSON with object keys sorted, so equal specs always serialise (and hash) the same. */
export function canonicalJson(x: unknown): string {
  if (Array.isArray(x)) return `[${x.map(canonicalJson).join(',')}]`;
  if (x !== null && typeof x === 'object') {
    const entries = Object.entries(x as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
  }
  return JSON.stringify(x);
}

export function specHash(s: StrategySpec): string {
  return createTextHasher().update(canonicalJson(s)).hex();
}

/** A new immutable version; the caller stores it and bumps `latestVersion`. */
export function newVersion(
  strategy: Strategy,
  spec: StrategySpec,
  changeNote: string,
  at: UtcMs,
): StrategyVersion {
  const problems = validateSpec(spec);
  if (problems.length > 0)
    throw new Error(`invalid strategy: ${problems.map((p) => `${p.code}@${p.path}`).join(', ')}`);
  return {
    strategyId: strategy.id,
    version: strategy.latestVersion + 1,
    spec: JSON.parse(JSON.stringify(spec)) as StrategySpec,
    specHash: specHash(spec),
    changeNote,
    createdAt: at,
    status: 'IDEA',
    statusHistory: [{ status: 'IDEA', at }],
  };
}

/** Status changes are the only edit allowed on a saved version. */
export function setVersionStatus(
  v: StrategyVersion,
  status: StrategyStatus,
  at: UtcMs,
  note?: string,
): StrategyVersion {
  if (v.status === status) return v;
  const entry = note ? { status, at, note } : { status, at };
  return { ...v, status, statusHistory: [...v.statusHistory, entry] };
}
