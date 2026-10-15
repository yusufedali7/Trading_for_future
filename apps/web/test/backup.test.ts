import { describe, expect, it } from 'vitest';
import {
  defaultSpec,
  newVersion,
  type Drawing,
  type Hypothesis,
  type JournalEntry,
  type ReplayTrade,
  type StoredBacktest,
  type Strategy,
} from '@trw/engine';
import {
  BackupError,
  createBackup,
  parseBackup,
  planRestore,
  type BackupRepos,
} from '../src/backup/backup';
import { createMemoryPrefsRepo } from '../src/storage/db-user';
import { createMemoryDrawingsRepo } from '../src/storage/drawings-repo';
import { createMemoryJournalRepo } from '../src/storage/journal-repo';
import { createMemorySessionsRepo } from '../src/storage/sessions-repo';
import { NOTE_DISCLAIMER } from '../src/features/research-notes/parse';
import {
  createMemoryResearchRepo,
  createMemoryStrategyRepo,
  type PaperSession,
} from '../src/storage/strategy-repo';

const repos = (): BackupRepos => ({
  prefs: createMemoryPrefsRepo(),
  drawings: createMemoryDrawingsRepo(),
  journal: createMemoryJournalRepo(),
  sessions: createMemorySessionsRepo(),
  strategies: createMemoryStrategyRepo(),
  research: createMemoryResearchRepo(),
});

// SYNTHETIC records: shapes only, no market meaning.
const drawing: Drawing = {
  id: 'd1',
  source: 'USER',
  kind: 'HLINE',
  instrument: 'EURUSD',
  createdOnTimeframe: '15m',
  anchors: [{ t: 1_000, p: 1.1 }],
  style: {},
  locked: false,
  hidden: false,
  createdAt: 1,
  updatedAt: 1,
};
const strategy: Strategy = {
  id: 's1',
  name: 'Deneme',
  description: '',
  latestVersion: 0,
  createdAt: 1,
  updatedAt: 1,
};
const entry = {
  id: 'j1',
  instrument: 'EURUSD',
  decision: 'NO_TRADE',
  decidedAt: 5,
  timeframe: '15m',
  sessions: [],
  tradeId: null,
  result: null,
  strategy: '',
  reason: 'Neden; "tırnak"',
  emotion: 'CALM',
  emotionIntensity: 3,
  lesson: '',
  tags: [],
  screenshotIds: ['sh1'],
  createdAt: 5,
  updatedAt: 5,
} as JournalEntry;

async function filled(): Promise<BackupRepos> {
  const r = repos();
  await r.prefs.save({ timeframe: '1h' });
  await r.drawings.saveDrawing(drawing);
  await r.drawings.saveLevel({
    id: 'l1',
    drawingId: 'd1',
    instrument: 'EURUSD',
    kind: 'SUPPORT',
    timeframe: '15m',
    note: '',
    status: 'ACTIVE',
    statusHistory: [{ status: 'ACTIVE', at: 1 }],
    createdAt: 1,
    updatedAt: 1,
  });
  await r.journal.saveTrade({ id: 't1', instrument: 'GBPUSD', createdAt: 2 } as ReplayTrade);
  await r.journal.saveEntry(entry);
  await r.journal.saveScreenshot({
    id: 'sh1',
    mime: 'image/png',
    data: new Uint8Array([0, 1, 254, 255]).buffer,
  });
  await r.sessions.save({
    id: 'ICT_ASIA',
    name: 'ICT Asya aralığı',
    tz: 'America/New_York',
    start: '20:00',
    end: '00:00',
    days: [7, 1, 2, 3, 4],
    version: 1,
    color: '#c9a227',
    createdAt: 1,
    updatedAt: 1,
  });
  await r.strategies.createStrategy(strategy, newVersion(strategy, defaultSpec(), 'v1', 2));
  await r.strategies.setStatus('s1', 1, 'RESEARCH', 3, 'not');
  await r.research.saveRun({
    run: { id: 'run1', strategy: { id: 's1' }, runAt: 4, split: { role: 'FULL' } },
  } as unknown as StoredBacktest);
  await r.research.saveHypothesis({ id: 'h1', createdAt: 1 } as Hypothesis);
  await r.research.savePaperSession({ id: 'p1', createdAt: 1 } as PaperSession);
  await r.research.saveResearchNote({
    id: 'EURUSD:2026-10-14',
    note: {
      schema: 'research-note/v1',
      instrument: 'EURUSD',
      asOf: '2026-10-14',
      generatedAt: '2026-10-14T09:12:00Z',
      reports: { technical: 'teknik rapor' },
      debate: { rounds: [] },
      modelInfo: { llmProvider: 'anthropic', quickModel: 'claude-haiku-4-5' },
      disclaimer: NOTE_DISCLAIMER,
    },
    importedAt: 1,
  });
  return r;
}

const roundTrip = async (r: BackupRepos) =>
  parseBackup(JSON.stringify(await createBackup(r, 9_000)));

describe('backup and restore', () => {
  it('restores everything into an empty app, screenshots byte for byte', async () => {
    const file = await roundTrip(await filled());
    expect(file).toMatchObject({ format: 'trw-backup', formatVersion: 1, createdAt: 9_000 });

    const empty = repos();
    const plan = await planRestore(empty, file);
    for (const kind of Object.keys(plan.counts) as (keyof typeof plan.counts)[]) {
      expect(plan.counts[kind], kind).toMatchObject({ add: 1, conflict: 0, invalid: 0 });
    }
    expect(await empty.drawings.listAll()).toEqual({ drawings: [], levels: [] }); // plan only
    await plan.apply();

    const again = await createBackup(empty, 9_000);
    expect(again).toEqual(file);
    const shot = await empty.journal.getScreenshot('sh1');
    expect([...new Uint8Array(shot!.data)]).toEqual([0, 1, 254, 255]);
    expect((await empty.strategies.listVersions('s1'))[0]!.statusHistory.at(-1)).toMatchObject({
      status: 'RESEARCH',
      note: 'not',
    });
  });

  it('a second restore adds nothing; a changed record is a conflict and is kept as it is', async () => {
    const r = await filled();
    const file = await roundTrip(r);
    const noop = await planRestore(r, file);
    expect(Object.values(noop.counts).every((c) => c.add === 0 && c.conflict === 0)).toBe(true);

    await r.strategies.setStatus('s1', 1, 'TESTING', 10);
    await r.drawings.saveDrawing({ ...drawing, note: 'değişti' });
    const plan = await planRestore(r, file);
    expect(plan.counts.versions).toMatchObject({ add: 0, conflict: 1 });
    expect(plan.counts.drawings).toMatchObject({ add: 0, conflict: 1 });
    expect(plan.counts.prefs).toMatchObject({ same: 1 });
    await plan.apply();
    expect((await r.strategies.listVersions('s1'))[0]!.status).toBe('TESTING');
    expect((await r.drawings.listAll()).drawings[0]!.note).toBe('değişti');
  });

  it('keeps the strategy version sequence when versions are added to an existing strategy', async () => {
    const source = await filled();
    const s = (await source.strategies.listStrategies())[0]!;
    await source.strategies.addVersion(newVersion(s, defaultSpec(), 'v2', 5), 5);
    const file = await roundTrip(source);
    const target = repos();
    await target.strategies.createStrategy(strategy, newVersion(strategy, defaultSpec(), 'v1', 2));
    await (await planRestore(target, file)).apply();
    expect((await target.strategies.listVersions('s1')).map((v) => v.version)).toEqual([1, 2]);
    expect((await target.strategies.listStrategies())[0]!.latestVersion).toBe(2);
  });

  it('counts broken records as invalid and does not write them', async () => {
    const file = await roundTrip(await filled());
    file.user.drawings.push({ ...drawing, id: 'bad', anchors: [] });
    file.user.drawings.push({ id: 'bad2' } as Drawing);
    file.user.levels.push({ ...file.user.levels[0]!, id: 'orphan', drawingId: 'nope' });
    const target = repos();
    const plan = await planRestore(target, file);
    expect(plan.counts.drawings).toMatchObject({ add: 1, invalid: 2 });
    expect(plan.counts.levels).toMatchObject({ add: 1, invalid: 1 });
    await plan.apply();
    expect((await target.drawings.listAll()).drawings.map((d) => d.id)).toEqual(['d1']);
  });

  it('still opens a backup made before research notes existed (D80)', async () => {
    const file = await roundTrip(await filled());
    expect(file.research.researchNotes).toHaveLength(1); // the fixture this session's own format has
    const legacy = JSON.parse(JSON.stringify(file));
    delete legacy.research.researchNotes;

    const parsed = parseBackup(JSON.stringify(legacy));
    expect(parsed.research.researchNotes).toEqual([]);

    const target = repos();
    const plan = await planRestore(target, parsed);
    expect(plan.counts.researchNotes).toMatchObject({ add: 0 });
    await plan.apply();
    expect(await target.research.listResearchNotes()).toEqual([]);
  });

  it('refuses files that are not our backups', () => {
    const problem = (text: string) => {
      try {
        parseBackup(text);
        return null;
      } catch (e) {
        return e instanceof BackupError ? e.problem : 'OTHER';
      }
    };
    expect(problem('{nope')).toBe('NOT_JSON');
    expect(problem('{"format":"other"}')).toBe('NOT_BACKUP');
    expect(problem('{"format":"trw-backup","formatVersion":2}')).toBe('NEWER_FORMAT');
    expect(problem('{"format":"trw-backup","formatVersion":1,"user":{}}')).toBe('MALFORMED');
  });
});
