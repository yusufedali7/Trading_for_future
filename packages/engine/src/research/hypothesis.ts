import type { UtcMs } from '../core/types';
import type { AmbiguityRule } from '../execution/trade-sim';
import type { LotRules } from '../risk/sizing';
import type { BacktestCosts } from '../backtest/run';

export type HypothesisStatus = 'OPEN' | 'SUPPORTED' | 'NOT_SUPPORTED' | 'INCONCLUSIVE';

/** The fixed test setup of a hypothesis: every run of it uses exactly this (D37). */
export interface ExperimentSetup {
  datasetId: string;
  /** The data the setup was made for; a different hash means different data. */
  contentHash: string;
  from: UtcMs;
  /** In-sample is [from, boundary), out-of-sample [boundary, to). */
  boundary: UtcMs;
  to: UtcMs;
  costs: BacktestCosts;
  ambiguity: AmbiguityRule;
  startEquity: number;
  lots: LotRules;
}

/** Research domain: a testable statement, its strategy, its setup and how it ended. */
export interface Hypothesis {
  id: string;
  title: string;
  /** The testable sentence, written before testing. */
  statement: string;
  strategyId: string;
  strategyVersion: number;
  setup: ExperimentSetup;
  status: HypothesisStatus;
  conclusion: string;
  /** Runs the conclusion relies on (rule 6: every number refers to a run). */
  evidenceRunIds: string[];
  /** Out-of-sample runs in order; more than one is flagged permanently. */
  oosRunIds: string[];
  createdAt: UtcMs;
  updatedAt: UtcMs;
}

export type HypothesisProblem = 'NO_TITLE' | 'NO_STATEMENT' | 'BAD_RANGE' | 'BAD_COSTS';

export function validateHypothesis(h: Hypothesis): HypothesisProblem[] {
  const out: HypothesisProblem[] = [];
  if (!h.title.trim()) out.push('NO_TITLE');
  if (!h.statement.trim()) out.push('NO_STATEMENT');
  const s = h.setup;
  if (!(s.from < s.boundary && s.boundary < s.to)) out.push('BAD_RANGE');
  const c = s.costs;
  if (
    ![c.spreadPips, c.slippagePips, c.commissionPerLotPerSide].every(
      (x) => Number.isFinite(x) && x >= 0,
    ) ||
    !(s.startEquity > 0) ||
    !(s.lots.lotStep > 0) ||
    !(s.lots.minLot > 0)
  )
    out.push('BAD_COSTS');
  return out;
}

export interface OosState {
  opened: boolean;
  /** Out-of-sample looked at more than once: its result is no longer untouched. */
  repeated: boolean;
}

export function oosState(h: Pick<Hypothesis, 'oosRunIds'>): OosState {
  return { opened: h.oosRunIds.length > 0, repeated: h.oosRunIds.length > 1 };
}

/** A hypothesis after an out-of-sample run. */
export function recordOos(h: Hypothesis, runId: string, at: UtcMs): Hypothesis {
  return { ...h, oosRunIds: [...h.oosRunIds, runId], updatedAt: at };
}

/** Concluding needs at least one run as evidence, except for "inconclusive". */
export function conclude(
  h: Hypothesis,
  status: Exclude<HypothesisStatus, 'OPEN'>,
  conclusion: string,
  evidenceRunIds: string[],
  at: UtcMs,
): Hypothesis {
  if (status !== 'INCONCLUSIVE' && evidenceRunIds.length === 0)
    throw new Error('a conclusion needs at least one run as evidence');
  return { ...h, status, conclusion, evidenceRunIds: [...evidenceRunIds], updatedAt: at };
}

/** Reopening keeps the history of runs; only the verdict is cleared. */
export function reopen(h: Hypothesis, at: UtcMs): Hypothesis {
  return { ...h, status: 'OPEN', conclusion: '', evidenceRunIds: [], updatedAt: at };
}
