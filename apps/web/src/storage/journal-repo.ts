import type { JournalEntry, ReplayTrade } from '@trw/engine';

/** A chart screenshot attached to a journal entry; stored as bytes (portable structured clone). */
export interface Screenshot {
  id: string;
  mime: string;
  data: ArrayBuffer;
}

/** Replay trades, journal entries and their screenshots ("trw-user" domain). */
export interface JournalRepo {
  listTrades(instrument: string): Promise<ReplayTrade[]>;
  saveTrade(t: ReplayTrade): Promise<void>;
  deleteTrade(id: string): Promise<void>;
  /** All entries, newest decision first. */
  listEntries(): Promise<JournalEntry[]>;
  saveEntry(e: JournalEntry): Promise<void>;
  /** Deletes the entry and its screenshots. */
  deleteEntry(id: string): Promise<void>;
  saveScreenshot(s: Screenshot): Promise<void>;
  getScreenshot(id: string): Promise<Screenshot | undefined>;
}

export const newestDecisionFirst = (a: JournalEntry, b: JournalEntry) =>
  b.decidedAt - a.decidedAt || b.createdAt - a.createdAt || a.id.localeCompare(b.id);

export function createMemoryJournalRepo(): JournalRepo {
  const trades = new Map<string, ReplayTrade>();
  const entries = new Map<string, JournalEntry>();
  const shots = new Map<string, Screenshot>();
  return {
    listTrades: async (instrument) =>
      [...trades.values()]
        .filter((t) => t.instrument === instrument)
        .sort((a, b) => a.createdAt - b.createdAt),
    saveTrade: async (t) => {
      trades.set(t.id, t);
    },
    deleteTrade: async (id) => {
      trades.delete(id);
    },
    listEntries: async () => [...entries.values()].sort(newestDecisionFirst),
    saveEntry: async (e) => {
      entries.set(e.id, e);
    },
    deleteEntry: async (id) => {
      for (const s of entries.get(id)?.screenshotIds ?? []) shots.delete(s);
      entries.delete(id);
    },
    saveScreenshot: async (s) => {
      shots.set(s.id, s);
    },
    getScreenshot: async (id) => shots.get(id),
  };
}
