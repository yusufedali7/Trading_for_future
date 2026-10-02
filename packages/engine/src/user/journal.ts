import type { Timeframe } from '../core/timeframe';
import type { UtcMs } from '../core/types';
import type {
  AmbiguityRule,
  CostModel,
  ExitReason,
  SimResult,
  TradeOrder,
} from '../execution/trade-sim';
import type { Instrument } from '../instruments/registry';
import { sessionInstances, type SessionDefinition } from '../session/sessions';

export type Emotion = 'CALM' | 'CONFIDENT' | 'FOMO' | 'FEAR' | 'REVENGE' | 'BORED' | 'OTHER';
export type Decision = 'LONG' | 'SHORT' | 'NO_TRADE';

/** Snapshot of how a journaled trade ended (copied from the simulator when it closed). */
export interface JournalResult {
  r: number;
  exitReason: ExitReason;
  maeR: number;
  mfeR: number;
  durationMs: number;
  ambiguous: boolean;
}

/** User-data domain: one decision during replay, including "no trade" decisions. */
export interface JournalEntry {
  id: string;
  instrument: string;
  decision: Decision;
  /** Replay cursor when the decision was made (UTC). */
  decidedAt: UtcMs;
  timeframe: Timeframe;
  /** Sessions active at decidedAt (automatic tag). */
  sessions: string[];
  tradeId: string | null;
  result: JournalResult | null;
  /** Free text until strategies exist (M5). */
  strategy: string;
  reason: string;
  emotion: Emotion;
  emotionIntensity: 1 | 2 | 3 | 4 | 5;
  lesson: string;
  tags: string[];
  screenshotIds: string[];
  createdAt: UtcMs;
  updatedAt: UtcMs;
}

/**
 * User-data domain: a manual trade taken during replay. The order and cost settings are stored so
 * the result can be recomputed deterministically; `result` is the last simulated snapshot.
 */
export interface ReplayTrade {
  id: string;
  instrument: string;
  datasetId: string;
  timeframe: Timeframe;
  order: TradeOrder;
  costs: CostModel;
  ambiguity: AmbiguityRule;
  /** Set when the user closes the trade manually. */
  closeAt: UtcMs | null;
  result: SimResult;
  journalId: string | null;
  createdAt: UtcMs;
  updatedAt: UtcMs;
}

const DAY_MS = 86_400_000;

/** Ids of the sessions (in definition order) whose occurrence contains instant t. */
export function activeSessions(
  defs: readonly SessionDefinition[],
  inst: Instrument,
  t: UtcMs,
): string[] {
  return defs
    .filter((d) =>
      sessionInstances(d, inst, t - DAY_MS, t + 1).some((s) => s.startUtc <= t && t < s.endUtc),
    )
    .map((d) => d.id);
}

export interface TradeStats {
  trades: number;
  wins: number;
  losses: number;
  breakeven: number;
  winRate: number | null;
  avgR: number | null;
  totalR: number;
  /** Gross win R / gross loss R; null without losses. */
  profitFactor: number | null;
  longestWinStreak: number;
  longestLossStreak: number;
  largestWinR: number | null;
  largestLossR: number | null;
  /** Largest peak-to-trough fall of cumulative R. */
  maxDrawdownR: number;
  ambiguous: number;
  /** Fewer than 30 trades: results are mostly noise (CLAUDE.md honesty rule). */
  lowSample: boolean;
}

const LOW_SAMPLE = 30;
const round = (x: number) => Math.round(x * 1e9) / 1e9;

/** Measured statistics only — never a predicted win probability (rule 6). */
export function tradeStats(results: readonly { r: number; ambiguous?: boolean }[]): TradeStats {
  let wins = 0;
  let losses = 0;
  let grossWin = 0;
  let grossLoss = 0;
  let cum = 0;
  let peak = 0;
  let maxDd = 0;
  let winStreak = 0;
  let lossStreak = 0;
  let longestWin = 0;
  let longestLoss = 0;
  let largestWin: number | null = null;
  let largestLoss: number | null = null;
  let ambiguous = 0;
  for (const { r, ambiguous: amb } of results) {
    if (amb) ambiguous++;
    if (r > 0) {
      wins++;
      grossWin += r;
      winStreak++;
      lossStreak = 0;
      largestWin = largestWin === null ? r : Math.max(largestWin, r);
    } else if (r < 0) {
      losses++;
      grossLoss += -r;
      lossStreak++;
      winStreak = 0;
      largestLoss = largestLoss === null ? r : Math.min(largestLoss, r);
    } else {
      winStreak = 0;
      lossStreak = 0;
    }
    longestWin = Math.max(longestWin, winStreak);
    longestLoss = Math.max(longestLoss, lossStreak);
    cum += r;
    peak = Math.max(peak, cum);
    maxDd = Math.max(maxDd, peak - cum);
  }
  const n = results.length;
  return {
    trades: n,
    wins,
    losses,
    breakeven: n - wins - losses,
    winRate: n === 0 ? null : round(wins / n),
    avgR: n === 0 ? null : round(cum / n),
    totalR: round(cum),
    profitFactor: grossLoss === 0 ? null : round(grossWin / grossLoss),
    longestWinStreak: longestWin,
    longestLossStreak: longestLoss,
    largestWinR: largestWin,
    largestLossR: largestLoss,
    maxDrawdownR: round(maxDd),
    ambiguous,
    lowSample: n < LOW_SAMPLE,
  };
}

export type Outcome = 'WIN' | 'LOSS' | 'BE' | 'NONE';

export interface JournalFilter {
  instrument?: string;
  decision?: Decision;
  session?: string;
  emotion?: Emotion;
  outcome?: Outcome;
  /** decidedAt >= from */
  from?: UtcMs;
  /** decidedAt < to */
  to?: UtcMs;
}

export function outcomeOf(e: JournalEntry): Outcome {
  if (!e.result) return 'NONE';
  return e.result.r > 0 ? 'WIN' : e.result.r < 0 ? 'LOSS' : 'BE';
}

export function filterJournal(entries: readonly JournalEntry[], f: JournalFilter): JournalEntry[] {
  return entries.filter(
    (e) =>
      (f.instrument === undefined || e.instrument === f.instrument) &&
      (f.decision === undefined || e.decision === f.decision) &&
      (f.session === undefined || e.sessions.includes(f.session)) &&
      (f.emotion === undefined || e.emotion === f.emotion) &&
      (f.outcome === undefined || outcomeOf(e) === f.outcome) &&
      (f.from === undefined || e.decidedAt >= f.from) &&
      (f.to === undefined || e.decidedAt < f.to),
  );
}
