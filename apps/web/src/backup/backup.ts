import {
  ENGINE_VERSION,
  canonicalJson,
  validateDrawing,
  type Drawing,
  type Hypothesis,
  type JournalEntry,
  type ReplayTrade,
  type StoredBacktest,
  type Strategy,
  type StrategyVersion,
  type SupportResistanceLevel,
} from '@trw/engine';
import { DEFAULT_PREFS, type Prefs, type PrefsRepo } from '../storage/db-user';
import type { DrawingsRepo } from '../storage/drawings-repo';
import type { JournalRepo } from '../storage/journal-repo';
import type { SessionsRepo, UserSession } from '../storage/sessions-repo';
import { validateResearchNote } from '../features/research-notes/parse';
import type {
  PaperSession,
  ResearchRepo,
  StoredResearchNote,
  StrategyRepo,
} from '../storage/strategy-repo';

/** Everything the user created, in one file (rule 10). Price data is not included. */
export interface BackupFile {
  format: 'trw-backup';
  formatVersion: 1;
  createdAt: number;
  engineVersion: string;
  user: {
    prefs: Prefs;
    drawings: Drawing[];
    levels: SupportResistanceLevel[];
    trades: ReplayTrade[];
    journal: JournalEntry[];
    screenshots: { id: string; mime: string; base64: string }[];
    sessions: UserSession[];
  };
  strategy: { strategies: Strategy[]; versions: StrategyVersion[] };
  research: {
    runs: StoredBacktest[];
    hypotheses: Hypothesis[];
    paperSessions: PaperSession[];
    researchNotes: StoredResearchNote[];
  };
}

export interface BackupRepos {
  prefs: PrefsRepo;
  drawings: DrawingsRepo;
  journal: JournalRepo;
  sessions: SessionsRepo;
  strategies: StrategyRepo;
  research: ResearchRepo;
}

export const BACKUP_KINDS = [
  'sessions',
  'strategies',
  'versions',
  'hypotheses',
  'runs',
  'paperSessions',
  'researchNotes',
  'drawings',
  'levels',
  'trades',
  'screenshots',
  'journal',
  'prefs',
] as const;
export type BackupKind = (typeof BACKUP_KINDS)[number];

export type BackupProblem = 'NOT_JSON' | 'NOT_BACKUP' | 'NEWER_FORMAT' | 'MALFORMED';
export class BackupError extends Error {
  constructor(readonly problem: BackupProblem) {
    super(problem);
  }
}

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

function fromBase64(b64: string): ArrayBuffer {
  const s = atob(b64);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes.buffer;
}

export async function createBackup(r: BackupRepos, now: number): Promise<BackupFile> {
  const [
    prefs,
    all,
    trades,
    journal,
    sessions,
    strategies,
    runs,
    hypotheses,
    paperSessions,
    researchNotes,
  ] = await Promise.all([
    r.prefs.load(),
    r.drawings.listAll(),
    r.journal.listAllTrades(),
    r.journal.listEntries(),
    r.sessions.list(),
    r.strategies.listStrategies(),
    r.research.listRuns(),
    r.research.listHypotheses(),
    r.research.listPaperSessions(),
    r.research.listResearchNotes(),
  ]);
  const versions = (
    await Promise.all(strategies.map((s) => r.strategies.listVersions(s.id)))
  ).flat();
  const screenshots: BackupFile['user']['screenshots'] = [];
  for (const id of journal.flatMap((e) => e.screenshotIds)) {
    const shot = await r.journal.getScreenshot(id);
    if (shot) screenshots.push({ id: shot.id, mime: shot.mime, base64: toBase64(shot.data) });
  }
  return {
    format: 'trw-backup',
    formatVersion: 1,
    createdAt: now,
    engineVersion: ENGINE_VERSION,
    user: {
      prefs,
      drawings: all.drawings,
      levels: all.levels,
      trades,
      journal,
      screenshots,
      sessions,
    },
    strategy: { strategies, versions },
    research: { runs, hypotheses, paperSessions, researchNotes },
  };
}

const isObj = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x);

/** Reads a backup file; refuses anything that is not one of ours (nothing is written here). */
export function parseBackup(text: string): BackupFile {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new BackupError('NOT_JSON');
  }
  if (!isObj(data) || data.format !== 'trw-backup') throw new BackupError('NOT_BACKUP');
  if (typeof data.formatVersion !== 'number' || data.formatVersion > 1) {
    throw new BackupError('NEWER_FORMAT');
  }
  const { user, strategy, research } = data;
  const arrays = (o: unknown, keys: string[]) => isObj(o) && keys.every((k) => Array.isArray(o[k]));
  // researchNotes (D80) is checked separately, tolerating its absence: a backup made before it
  // existed must still open (it is normalized to [] below), but a present-and-malformed value
  // is still rejected.
  if (
    !arrays(user, ['drawings', 'levels', 'trades', 'journal', 'screenshots', 'sessions']) ||
    !isObj((user as Record<string, unknown>).prefs) ||
    !arrays(strategy, ['strategies', 'versions']) ||
    !arrays(research, ['runs', 'hypotheses', 'paperSessions']) ||
    (isObj(research) && 'researchNotes' in research && !Array.isArray(research.researchNotes))
  ) {
    throw new BackupError('MALFORMED');
  }
  const researchNotes =
    isObj(research) && Array.isArray(research.researchNotes)
      ? (research.researchNotes as StoredResearchNote[])
      : [];
  const file = data as unknown as BackupFile;
  return { ...file, research: { ...file.research, researchNotes } };
}

export interface KindCount {
  add: number;
  same: number;
  /** Same id, different content: the existing record is kept. */
  conflict: number;
  invalid: number;
}

export interface RestorePlan {
  counts: Record<BackupKind, KindCount>;
  apply: () => Promise<void>;
}

/** JSON round trip first, so stored and file copies compare equal when they are the same. */
const same = (a: unknown, b: unknown) =>
  canonicalJson(JSON.parse(JSON.stringify(a))) === canonicalJson(b);

/**
 * What a restore would do, without writing. Nothing existing is ever overwritten: a record is
 * added when its id is new, skipped when identical, reported as a conflict when it differs.
 */
export async function planRestore(r: BackupRepos, f: BackupFile): Promise<RestorePlan> {
  const counts = Object.fromEntries(
    BACKUP_KINDS.map((k) => [k, { add: 0, same: 0, conflict: 0, invalid: 0 }]),
  ) as Record<BackupKind, KindCount>;
  const writes: (() => Promise<void>)[] = [];

  const [prefs, all, trades, journal, sessions, strategies, runs, hypotheses, papers, notes] =
    await Promise.all([
      r.prefs.load(),
      r.drawings.listAll(),
      r.journal.listAllTrades(),
      r.journal.listEntries(),
      r.sessions.list(),
      r.strategies.listStrategies(),
      r.research.listRuns(),
      r.research.listHypotheses(),
      r.research.listPaperSessions(),
      r.research.listResearchNotes(),
    ]);
  const versions = (
    await Promise.all(strategies.map((s) => r.strategies.listVersions(s.id)))
  ).flat();

  /** One kind: compare by key, queue the writes for new records. */
  function merge<T>(
    kind: BackupKind,
    incoming: readonly T[],
    existing: readonly T[],
    key: (x: T) => string | null,
    valid: (x: T) => boolean,
    write: (x: T) => Promise<void>,
  ) {
    const have = new Map(existing.map((x) => [key(x), x]));
    const c = counts[kind];
    for (const x of incoming) {
      const k = isObj(x) ? key(x) : null;
      const ok = (() => {
        try {
          return k !== null && valid(x);
        } catch {
          return false; // a malformed record must not stop the restore
        }
      })();
      if (k === null || !ok) {
        c.invalid++;
        continue;
      }
      const cur = have.get(k);
      if (cur === undefined) {
        c.add++;
        have.set(k, x);
        writes.push(() => write(x));
      } else if (same(cur, x)) c.same++;
      else c.conflict++;
    }
    return have;
  }
  const id = (x: { id?: unknown }) => (typeof x.id === 'string' ? x.id : null);

  merge(
    'sessions',
    f.user.sessions,
    sessions,
    id,
    () => true,
    (s) => r.sessions.save(s),
  );
  const strategyIds = merge(
    'strategies',
    f.strategy.strategies,
    strategies,
    id,
    () => true,
    (s) => r.strategies.importStrategy(s),
  );
  merge(
    'versions',
    [...f.strategy.versions].sort((a, b) => a.version - b.version),
    versions,
    (v) =>
      typeof v.strategyId === 'string' && Number.isInteger(v.version)
        ? `${v.strategyId}#${v.version}`
        : null,
    (v) => strategyIds.has(v.strategyId),
    (v) => r.strategies.importVersion(v),
  );
  merge(
    'hypotheses',
    f.research.hypotheses,
    hypotheses,
    id,
    () => true,
    (h) => r.research.saveHypothesis(h),
  );
  merge(
    'runs',
    f.research.runs,
    runs,
    (b) => (isObj(b.run) && typeof b.run.id === 'string' ? b.run.id : null),
    () => true,
    (b) => r.research.saveRun(b),
  );
  merge(
    'paperSessions',
    f.research.paperSessions,
    papers,
    id,
    () => true,
    (p) => r.research.savePaperSession(p),
  );
  merge(
    'researchNotes',
    f.research.researchNotes,
    notes,
    id,
    // Runs the note through the same allowlist/type validator as a live import (D80 finding):
    // a restore must not be a way to smuggle in an unknown or decision-like field.
    (sn) => typeof sn.importedAt === 'number' && !!validateResearchNote(sn.note),
    (note) => r.research.saveResearchNote(note),
  );
  const drawingIds = merge(
    'drawings',
    f.user.drawings,
    all.drawings,
    id,
    (d) => validateDrawing(d).length === 0,
    (d) => r.drawings.saveDrawing(d),
  );
  merge(
    'levels',
    f.user.levels,
    all.levels,
    id,
    (l) => drawingIds.has(l.drawingId),
    (l) => r.drawings.saveLevel(l),
  );
  merge(
    'trades',
    f.user.trades,
    trades,
    id,
    () => true,
    (t) => r.journal.saveTrade(t),
  );
  const existingShots = new Map<string, { id: string; mime: string; base64: string }>();
  for (const sid of journal.flatMap((e) => e.screenshotIds)) {
    const s = await r.journal.getScreenshot(sid);
    if (s) existingShots.set(s.id, { id: s.id, mime: s.mime, base64: toBase64(s.data) });
  }
  merge(
    'screenshots',
    f.user.screenshots,
    [...existingShots.values()],
    id,
    (s) => typeof s.base64 === 'string' && typeof s.mime === 'string',
    (s) => r.journal.saveScreenshot({ id: s.id, mime: s.mime, data: fromBase64(s.base64) }),
  );
  merge(
    'journal',
    f.user.journal,
    journal,
    id,
    () => true,
    (e) => r.journal.saveEntry(e),
  );

  // Preferences are one record: restored only over untouched defaults, otherwise kept.
  // The backup time itself is not a preference worth a conflict.
  const core = ({ lastBackupAt: _, ...p }: Prefs) => p;
  const pc = counts.prefs;
  if (same(core(prefs), core({ ...DEFAULT_PREFS, ...f.user.prefs }))) pc.same++;
  else if (same(core(prefs), core(DEFAULT_PREFS))) {
    pc.add++;
    writes.push(() => r.prefs.save(f.user.prefs));
  } else pc.conflict++;

  return {
    counts,
    apply: async () => {
      for (const w of writes) await w();
    },
  };
}
