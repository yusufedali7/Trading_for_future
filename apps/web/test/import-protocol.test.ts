import { describe, expect, it } from 'vitest';
import { ImportSession } from '../src/import/session';
import { handleImportRequest } from '../src/import/protocol';

// SYNTHETIC CSV text for protocol tests.
const CSV =
  'Gmt time,Open,High,Low,Close,Volume\n06.01.2026 15:00:00.000,1.085,1.0852,1.0849,1.0851,1\n';

describe('import worker protocol', () => {
  it('answers each request with its id and result', async () => {
    const session = new ImportSession();
    const file = new File([CSV], 'SYNTHETIC_p.csv');
    const res = await handleImportRequest(session, { id: 7, method: 'read', file });
    expect(res.response).toMatchObject({
      id: 7,
      ok: true,
      result: { fileName: 'SYNTHETIC_p.csv', totalRows: 2 },
    });
  });

  it('returns errors as messages instead of throwing', async () => {
    const res = await handleImportRequest(new ImportSession(), {
      id: 1,
      method: 'finish',
      accepted: [],
    });
    expect(res.response).toMatchObject({ id: 1, ok: false });
    expect((res.response as { error: string }).error).toMatch(/analy/i);
  });

  it('transfers the series buffers when finishing', async () => {
    const session = new ImportSession();
    await handleImportRequest(session, {
      id: 1,
      method: 'read',
      file: new File([CSV], 'SYNTHETIC_p.csv'),
    });
    const { response: analyzed } = await handleImportRequest(session, {
      id: 2,
      method: 'analyze',
      mapping: {
        hasHeader: true,
        time: { kind: 'SINGLE', column: 0 },
        dateFormat: 'dd.MM.yyyy HH:mm:ss.SSS',
        open: 1,
        high: 2,
        low: 3,
        close: 4,
        volume: 5,
      },
      sourceTz: 'UTC',
      instrument: 'EURUSD',
    });
    expect(analyzed.ok).toBe(true);
    const done = await handleImportRequest(session, { id: 3, method: 'finish', accepted: [] });
    expect(done.response.ok).toBe(true);
    expect(done.transfer).toHaveLength(6); // t, o, h, l, c, v
  });
});
