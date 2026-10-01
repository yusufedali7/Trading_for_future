import Dexie, { type Table } from 'dexie';
import type { Drawing, IanaTz, SupportResistanceLevel, Timeframe } from '@trw/engine';
import { assertValidDrawing, byCreated, type DrawingsRepo } from './drawings-repo';

export interface Prefs {
  datasetId: string | null;
  timeframe: Timeframe;
  displayTz: IanaTz;
  /** Ids of sessions drawn on the chart. */
  sessions: string[];
}

export const DEFAULT_PREFS: Prefs = {
  datasetId: null,
  timeframe: '15m',
  displayTz: 'Europe/Istanbul',
  sessions: ['ASIA', 'LONDON', 'NEW_YORK'],
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

  constructor(name: string) {
    super(name);
    this.version(1).stores({ prefs: 'key' });
    // v2 (M2): user drawings and support/resistance levels. v1 data is kept as is.
    this.version(2).stores({
      prefs: 'key',
      drawings: 'id, instrument',
      levels: 'id, instrument, drawingId',
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

/** User-data domain ("trw-user"): preferences, drawings and levels; journal comes in M3. */
export function createDexieUserRepos(options: { dbName?: string } = {}): {
  prefs: PrefsRepo;
  drawings: DrawingsRepo;
} {
  const db = new UserDb(options.dbName ?? 'trw-user');
  return { prefs: prefsRepo(db), drawings: drawingsRepo(db) };
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
