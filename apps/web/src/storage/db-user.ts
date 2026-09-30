import Dexie, { type Table } from 'dexie';
import type { IanaTz, Timeframe } from '@trw/engine';

export interface Prefs {
  datasetId: string | null;
  timeframe: Timeframe;
  displayTz: IanaTz;
}

export const DEFAULT_PREFS: Prefs = {
  datasetId: null,
  timeframe: '15m',
  displayTz: 'Europe/Istanbul',
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

  constructor(name: string) {
    super(name);
    this.version(1).stores({ prefs: 'key' });
  }
}

/** User-data domain ("trw-user"): preferences now; drawings and journal in later milestones. */
export function createDexiePrefsRepo(options: { dbName?: string } = {}): PrefsRepo {
  const db = new UserDb(options.dbName ?? 'trw-user');
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

export function createMemoryPrefsRepo(): PrefsRepo {
  let prefs = { ...DEFAULT_PREFS };
  return {
    load: async () => ({ ...prefs }),
    save: async (patch) => {
      prefs = { ...prefs, ...patch };
    },
  };
}
