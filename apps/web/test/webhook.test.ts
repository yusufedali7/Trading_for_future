import { describe, expect, it, vi } from 'vitest';
import type { SignalDraft } from '@trw/engine';
import {
  DISCLAIMER,
  draftNotice,
  isWebhookUrl,
  notifyNewDrafts,
  postNotices,
  testNotice,
} from '../src/features/live/webhook';
import type { StoredDraft } from '../src/storage/strategy-repo';

const T0 = Date.parse('2026-10-15T09:00:00Z');

/** SYNTHETIC: a stored signal draft as D70 writes it. */
function stored(id: string, o: Partial<SignalDraft> = {}, name = 'Londra süpürme'): StoredDraft {
  const draft: SignalDraft = {
    id,
    strategyId: 's1',
    strategyVersion: 2,
    instrument: 'EURUSD',
    direction: 'LONG',
    setupId: `setup-${id}`,
    conditions: [{ stepId: 'sweep' }, { stepId: 'fvg' }] as unknown as SignalDraft['conditions'],
    order: {
      direction: 'LONG',
      type: 'LIMIT',
      placedAt: T0,
      referencePrice: 1.1,
      price: 1.0995,
      stop: 1.098,
      target: 1.102,
      expiresAt: T0 + 3_600_000,
    },
    lots: 0.33,
    riskAmount: 50,
    createdAt: T0,
    expiresAt: T0 + 3_600_000,
    ...o,
  };
  return { id, strategyName: name, draft, savedAt: T0 };
}

describe('isWebhookUrl', () => {
  it('accepts only http(s) URLs', () => {
    expect(isWebhookUrl('http://localhost:5678/webhook/trw')).toBe(true);
    expect(isWebhookUrl('https://n8n.example.com/webhook/abc')).toBe(true);
    expect(isWebhookUrl('javascript:alert(1)')).toBe(false);
    expect(isWebhookUrl('ftp://x/y')).toBe(false);
    expect(isWebhookUrl('localhost:5678')).toBe(false);
    expect(isWebhookUrl('')).toBe(false);
  });
});

describe('draftNotice', () => {
  it('carries the draft, its conflicts and the fixed disclaimer — never buy/sell wording', () => {
    const n = draftNotice(stored('d1'), ['Asya kırılımı']);
    expect(n).toEqual({
      schema: 'signal-draft-notice/v1',
      kind: 'SIGNAL_DRAFT',
      id: 'd1',
      strategy: { id: 's1', name: 'Londra süpürme', version: 2 },
      instrument: 'EURUSD',
      direction: 'LONG',
      order: { type: 'LIMIT', entry: 1.0995, stop: 1.098, target: 1.102 },
      lots: 0.33,
      riskAmount: 50,
      conditions: ['sweep', 'fvg'],
      createdAt: '2026-10-15T09:00:00.000Z',
      expiresAt: '2026-10-15T10:00:00.000Z',
      conflictsWith: ['Asya kırılımı'],
      disclaimer: DISCLAIMER,
    });
    expect(JSON.stringify(n)).not.toMatch(/\b(AL|SAT|BUY|SELL)\b/);
  });

  it('uses the reference price as the entry of a market draft', () => {
    const m = stored('d2', {
      order: { ...stored('x').draft.order, type: 'MARKET', price: undefined },
    });
    expect(draftNotice(m, []).order.entry).toBe(1.1);
  });
});

describe('testNotice', () => {
  it('is a connection test with no prices in it', () => {
    const n = testNotice(T0);
    expect(n).toMatchObject({ schema: 'signal-draft-notice/v1', kind: 'TEST' });
    expect(n).not.toHaveProperty('order');
  });
});

describe('postNotices', () => {
  it('POSTs one JSON body per notice and counts failures without hiding them', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200 })
      .mockResolvedValueOnce({ ok: false, status: 404 });
    const notices = [draftNotice(stored('a'), []), draftNotice(stored('b'), [])];
    const r = await postNotices('http://localhost:5678/webhook/trw', notices, fetchFn);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe('http://localhost:5678/webhook/trw');
    expect(init).toMatchObject({ method: 'POST', headers: { 'Content-Type': 'application/json' } });
    expect(JSON.parse(init.body)).toEqual(notices[0]);
    expect(r).toEqual({ sent: 1, failed: 1, error: 'HTTP 404' });
  });

  it('reports a network error', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const r = await postNotices('http://x.test/h', [testNotice(T0)], fetchFn);
    expect(r).toEqual({ sent: 0, failed: 1, error: 'Failed to fetch' });
  });
});

describe('notifyNewDrafts', () => {
  it('sends only new drafts that are still valid, with conflicts named', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    const fresh = stored('new');
    const expired = stored('old', { expiresAt: T0 + 60_000 });
    const opposite = stored('short', { direction: 'SHORT' }, 'Asya kırılımı');
    const r = await notifyNewDrafts({
      url: 'http://localhost:5678/webhook/trw',
      fresh: [fresh, expired],
      all: [fresh, expired, opposite],
      now: T0 + 120_000,
      fetchFn,
    });
    expect(r).toEqual({ sent: 1, failed: 0, error: null });
    const body = JSON.parse(fetchFn.mock.calls[0]![1].body);
    expect(body.id).toBe('new');
    expect(body.conflictsWith).toEqual(['Asya kırılımı']);
  });

  it('sends nothing when there is nothing new and valid', async () => {
    const fetchFn = vi.fn();
    const r = await notifyNewDrafts({
      url: 'http://localhost:5678/webhook/trw',
      fresh: [],
      all: [stored('x')],
      now: T0,
      fetchFn,
    });
    expect(fetchFn).not.toHaveBeenCalled();
    expect(r).toEqual({ sent: 0, failed: 0, error: null });
  });
});
