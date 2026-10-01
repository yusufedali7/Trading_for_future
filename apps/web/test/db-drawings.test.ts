import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';
import type { Drawing, SupportResistanceLevel } from '@trw/engine';
import { createDexiePrefsRepo, createDexieUserRepos, DEFAULT_PREFS } from '../src/storage/db-user';
import { createMemoryDrawingsRepo } from '../src/storage/drawings-repo';

// SYNTHETIC drawings for storage tests.
const line = (id: string, instrument = 'EURUSD'): Drawing => ({
  id,
  source: 'USER',
  kind: 'HLINE',
  instrument,
  createdOnTimeframe: '15m',
  anchors: [{ t: 1, p: 1.085 }],
  style: {},
  locked: false,
  hidden: false,
  createdAt: 1,
  updatedAt: 1,
});
const level = (id: string, drawingId: string): SupportResistanceLevel => ({
  id,
  drawingId,
  instrument: 'EURUSD',
  kind: 'SUPPORT',
  timeframe: '4h',
  note: '',
  status: 'ACTIVE',
  statusHistory: [{ status: 'ACTIVE', at: 1 }],
  createdAt: 1,
  updatedAt: 1,
});

let n = 0;
const dexieRepo = () => createDexieUserRepos({ dbName: `trw-user-drawings-${n++}` }).drawings;

describe.each([
  ['dexie', dexieRepo],
  ['memory', createMemoryDrawingsRepo],
])('%s drawings repo', (_name, make) => {
  it('stores drawings and levels per instrument', async () => {
    const repo = make();
    await repo.saveDrawing(line('a'));
    await repo.saveDrawing(line('b', 'XAUUSD'));
    await repo.saveLevel(level('l1', 'a'));
    expect(await repo.list('EURUSD')).toEqual({
      drawings: [line('a')],
      levels: [level('l1', 'a')],
    });
    expect((await repo.list('XAUUSD')).drawings.map((d) => d.id)).toEqual(['b']);
  });

  it('updates in place by id', async () => {
    const repo = make();
    await repo.saveDrawing(line('a'));
    await repo.saveDrawing({ ...line('a'), note: 'Londra açılışı' });
    expect((await repo.list('EURUSD')).drawings).toEqual([
      { ...line('a'), note: 'Londra açılışı' },
    ]);
  });

  it('deletes a drawing together with its levels', async () => {
    const repo = make();
    await repo.saveDrawing(line('a'));
    await repo.saveLevel(level('l1', 'a'));
    await repo.deleteDrawing('a');
    expect(await repo.list('EURUSD')).toEqual({ drawings: [], levels: [] });
  });

  it('refuses to store an invalid drawing', async () => {
    const repo = make();
    await expect(repo.saveDrawing({ ...line('a'), anchors: [] })).rejects.toThrow(/ANCHOR_COUNT/);
  });
});

describe('user database upgrade', () => {
  it('keeps version-1 preferences when the drawings tables are added', async () => {
    const name = `trw-user-upgrade-${n++}`;
    const v1 = new Dexie(name);
    v1.version(1).stores({ prefs: 'key' });
    await v1.table('prefs').put({ key: 'prefs', value: { ...DEFAULT_PREFS, timeframe: '4h' } });
    v1.close();

    expect((await createDexiePrefsRepo({ dbName: name }).load()).timeframe).toBe('4h');
    const repos = createDexieUserRepos({ dbName: name });
    await repos.drawings.saveDrawing(line('a'));
    expect((await repos.drawings.list('EURUSD')).drawings).toHaveLength(1);
  });
});
