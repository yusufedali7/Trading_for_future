import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFS, createDexiePrefsRepo } from '../src/storage/db-user';

let n = 0;
const fresh = () => createDexiePrefsRepo({ dbName: `trw-user-test-${n++}` });

describe('user preferences repo', () => {
  it('returns defaults before anything is saved', async () => {
    expect(await fresh().load()).toEqual(DEFAULT_PREFS);
  });

  it('defaults to 15m and Europe/Istanbul display time', () => {
    expect(DEFAULT_PREFS).toEqual({
      datasetId: null,
      timeframe: '15m',
      displayTz: 'Europe/Istanbul',
    });
  });

  it('persists and merges partial updates', async () => {
    const repo = fresh();
    await repo.save({ timeframe: '4h' });
    await repo.save({ displayTz: 'America/New_York' });
    expect(await repo.load()).toEqual({
      datasetId: null,
      timeframe: '4h',
      displayTz: 'America/New_York',
    });
  });
});
