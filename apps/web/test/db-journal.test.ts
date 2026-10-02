import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';
import type { JournalEntry, ReplayTrade } from '@trw/engine';
import { createDexieUserRepos, DEFAULT_PREFS } from '../src/storage/db-user';
import { createMemoryJournalRepo } from '../src/storage/journal-repo';

// SYNTHETIC records for storage tests.
const trade = (id: string, instrument = 'EURUSD'): ReplayTrade => ({
  id,
  instrument,
  datasetId: 'ds',
  timeframe: '15m',
  order: {
    direction: 'LONG',
    type: 'MARKET',
    placedAt: 1,
    referencePrice: 1.1,
    stop: 1.099,
    target: 1.102,
    expiresAt: null,
  },
  costs: { spread: 0, slippage: 0 },
  ambiguity: 'STOP_FIRST',
  closeAt: null,
  result: { status: 'OPEN', r: 0.5, maeR: 0, mfeR: 0.5, barsHeld: 3, ambiguous: false },
  journalId: null,
  createdAt: 1,
  updatedAt: 1,
});

const entry = (id: string, screenshotIds: string[] = []): JournalEntry => ({
  id,
  instrument: 'EURUSD',
  decision: 'LONG',
  decidedAt: 1,
  timeframe: '15m',
  sessions: ['LONDON'],
  tradeId: 't1',
  result: null,
  strategy: '',
  reason: 'Asya low süpürüldü',
  emotion: 'CALM',
  emotionIntensity: 2,
  lesson: '',
  tags: [],
  screenshotIds,
  createdAt: 1,
  updatedAt: 1,
});

let n = 0;
const dexieRepo = () => createDexieUserRepos({ dbName: `trw-user-journal-${n++}` }).journal;

describe.each([
  ['dexie', dexieRepo],
  ['memory', createMemoryJournalRepo],
])('%s journal repo', (_name, make) => {
  it('stores replay trades per instrument and updates them in place', async () => {
    const repo = make();
    await repo.saveTrade(trade('t1'));
    await repo.saveTrade(trade('t2', 'XAUUSD'));
    await repo.saveTrade({ ...trade('t1'), closeAt: 5 });
    expect(await repo.listTrades('EURUSD')).toEqual([{ ...trade('t1'), closeAt: 5 }]);
  });

  it('stores journal entries and lists them newest decision first', async () => {
    const repo = make();
    await repo.saveEntry({ ...entry('a'), decidedAt: 1 });
    await repo.saveEntry({ ...entry('b'), decidedAt: 2 });
    expect((await repo.listEntries()).map((e) => e.id)).toEqual(['b', 'a']);
  });

  it('keeps screenshots as bytes and deletes them with their entry', async () => {
    const repo = make();
    const bytes = new Uint8Array([137, 80, 78, 71]).buffer;
    await repo.saveScreenshot({ id: 's1', mime: 'image/png', data: bytes });
    await repo.saveEntry(entry('a', ['s1']));
    const shot = await repo.getScreenshot('s1');
    expect(shot?.mime).toBe('image/png');
    expect(Array.from(new Uint8Array(shot!.data))).toEqual([137, 80, 78, 71]);
    await repo.deleteEntry('a');
    expect(await repo.listEntries()).toEqual([]);
    expect(await repo.getScreenshot('s1')).toBeUndefined();
  });
});

describe('user database upgrade to v3', () => {
  it('keeps preferences and drawings written by version 2', async () => {
    const name = `trw-user-v3-${n++}`;
    const v2 = new Dexie(name);
    v2.version(1).stores({ prefs: 'key' });
    v2.version(2).stores({
      prefs: 'key',
      drawings: 'id, instrument',
      levels: 'id, instrument, drawingId',
    });
    await v2.table('prefs').put({ key: 'prefs', value: { ...DEFAULT_PREFS, timeframe: '1h' } });
    v2.close();

    const repos = createDexieUserRepos({ dbName: name });
    expect((await repos.prefs.load()).timeframe).toBe('1h');
    await repos.journal.saveEntry(entry('a'));
    expect(await repos.journal.listEntries()).toHaveLength(1);
  });
});
