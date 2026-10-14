import Dexie, { type Table } from 'dexie';
import type {
  Drawing,
  IanaTz,
  JournalEntry,
  ReplayTrade,
  SupportResistanceLevel,
  Timeframe,
} from '@trw/engine';
import type { FeatureLayer } from '../chart/primitives/feature-layout';
import { DEFAULT_INDICATORS, type IndicatorSettings } from '../chart/indicator-settings';
import { assertValidDrawing, byCreated, type DrawingsRepo } from './drawings-repo';
import { newestDecisionFirst, type JournalRepo, type Screenshot } from './journal-repo';
import { byCreatedSession, type SessionsRepo, type UserSession } from './sessions-repo';

export interface Prefs {
  datasetId: string | null;
  timeframe: Timeframe;
  displayTz: IanaTz;
  /** Ids of sessions drawn on the chart. */
  sessions: string[];
  /** Engine candidate layers drawn on the chart (M4). */
  features: FeatureLayer[];
  /** MT5 feed (M6.3): kept here so auto-update survives tab switches and reloads. */
  paperFeed: PaperFeedPrefs;
  /** When the last backup file was made (M7.2); drives the reminder. */
  lastBackupAt: number | null;
  /** Chart overlays and oscillator (M8). */
  indicators: IndicatorSettings;
  /** Learning path progress (D73); part of the backup like every other preference. */
  learning: LearningPrefs;
}

export interface LearningPrefs {
  completed: string[];
  /** The "next lesson" strip on the chart was dismissed. */
  hideHint: boolean;
}

export interface PaperFeedPrefs {
  instrument: string;
  brokerSymbol: string;
  auto: boolean;
}

export const DEFAULT_PREFS: Prefs = {
  datasetId: null,
  timeframe: '15m',
  displayTz: 'Europe/Istanbul',
  sessions: ['ASIA', 'LONDON', 'NEW_YORK'],
  features: ['SWING', 'STRUCTURE', 'PREV_DAY'],
  paperFeed: { instrument: 'EURUSD', brokerSymbol: '', auto: false },
  lastBackupAt: null,
  indicators: DEFAULT_INDICATORS,
  learning: { completed: [], hideHint: false },
};

export interface PrefsRepo {
  load(): Promise<Prefs>;
  save(patch: Partial<Prefs>): Promise<void>;
}

interface PrefRow {
  key: 'prefs';
  value: Prefs;
}

class UserDb extends Dexie {
  prefs!: Table<PrefRow, string>;
  drawings!: Table<Drawing, string>;
  levels!: Table<SupportResistanceLevel, string>;
  trades!: Table<ReplayTrade, string>;
  journal!: Table<JournalEntry, string>;
  screenshots!: Table<Screenshot, string>;
  sessions!: Table<UserSession, string>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({ prefs: 'key' });
    // v2 (M2): user drawings and support/resistance levels. v1 data is kept as is.
    this.version(2).stores({
      prefs: 'key',
      drawings: 'id, instrument',
      levels: 'id, instrument, drawingId',
    });
    // v3 (M3): replay trades, journal entries and their screenshots.
    this.version(3).stores({
      prefs: 'key',
      drawings: 'id, instrument',
      levels: 'id, instrument, drawingId',
      trades: 'id, instrument',
      journal: 'id, instrument, decidedAt',
      screenshots: 'id',
    });
    // v4 (M6.1): the user's own session definitions.
    this.version(4).stores({
      prefs: 'key',
      drawings: 'id, instrument',
      levels: 'id, instrument, drawingId',
      trades: 'id, instrument',
      journal: 'id, instrument, decidedAt',
      screenshots: 'id',
      sessions: 'id',
    });
  }
}

function prefsRepo(db: UserDb): PrefsRepo {
  const load = async (): Promise<Prefs> => ({
    ...DEFAULT_PREFS,
    ...(await db.prefs.get('prefs'))?.value,
  });
  return {
    load,
    async save(patch) {
      await db.transaction('rw', db.prefs, async () => {
        await db.prefs.put({ key: 'prefs', value: { ...(await load()), ...patch } });
      });
    },
  };
}

function drawingsRepo(db: UserDb): DrawingsRepo {
  return {
    async list(instrument) {
      const [drawings, levels] = await Promise.all([
        db.drawings.where('instrument').equals(instrument).toArray(),
        db.levels.where('instrument').equals(instrument).toArray(),
      ]);
      return { drawings: drawings.sort(byCreated), levels: levels.sort(byCreated) };
    },
    async listAll() {
      const [drawings, levels] = await Promise.all([db.drawings.toArray(), db.levels.toArray()]);
      return { drawings: drawings.sort(byCreated), levels: levels.sort(byCreated) };
    },
    async saveDrawing(d) {
      assertValidDrawing(d);
      await db.drawings.put(d);
    },
    async deleteDrawing(id) {
      await db.transaction('rw', db.drawings, db.levels, async () => {
        await db.levels.where('drawingId').equals(id).delete();
        await db.drawings.delete(id);
      });
    },
    async saveLevel(l) {
      await db.levels.put(l);
    },
    async deleteLevel(id) {
      await db.levels.delete(id);
    },
  };
}

function journalRepo(db: UserDb): JournalRepo {
  return {
    async listTrades(instrument) {
      const all = await db.trades.where('instrument').equals(instrument).toArray();
      return all.sort((a, b) => a.createdAt - b.createdAt);
    },
    async listAllTrades() {
      return (await db.trades.toArray()).sort((a, b) => a.createdAt - b.createdAt);
    },
    async saveTrade(t) {
      await db.trades.put(t);
    },
    async deleteTrade(id) {
      await db.trades.delete(id);
    },
    async listEntries() {
      return (await db.journal.toArray()).sort(newestDecisionFirst);
    },
    async saveEntry(e) {
      await db.journal.put(e);
    },
    async deleteEntry(id) {
      await db.transaction('rw', db.journal, db.screenshots, async () => {
        const e = await db.journal.get(id);
        if (e) await db.screenshots.bulkDelete(e.screenshotIds);
        await db.journal.delete(id);
      });
    },
    async saveScreenshot(s) {
      await db.screenshots.put(s);
    },
    async getScreenshot(id) {
      return db.screenshots.get(id);
    },
  };
}

function sessionsRepo(db: UserDb): SessionsRepo {
  return {
    list: async () => (await db.sessions.toArray()).sort(byCreatedSession),
    save: async (s) => {
      await db.sessions.put(s);
    },
    delete: async (id) => {
      await db.sessions.delete(id);
    },
  };
}

/** User-data domain ("trw-user"): preferences, drawings and levels, replay trades and journal. */
export function createDexieUserRepos(options: { dbName?: string } = {}): {
  prefs: PrefsRepo;
  drawings: DrawingsRepo;
  journal: JournalRepo;
  sessions: SessionsRepo;
} {
  const db = new UserDb(options.dbName ?? 'trw-user');
  return {
    prefs: prefsRepo(db),
    drawings: drawingsRepo(db),
    journal: journalRepo(db),
    sessions: sessionsRepo(db),
  };
}

export function createDexiePrefsRepo(options: { dbName?: string } = {}): PrefsRepo {
  return createDexieUserRepos(options).prefs;
}

export function createMemoryPrefsRepo(): PrefsRepo {
  let prefs = { ...DEFAULT_PREFS };
  return {
    load: async () => ({ ...prefs }),
    save: async (patch) => {
      prefs = { ...prefs, ...patch };
    },
  };
}
