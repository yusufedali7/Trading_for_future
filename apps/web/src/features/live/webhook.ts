import { findConflicts, type UtcMs } from '@trw/engine';
import type { StoredDraft } from '../../storage/strategy-repo';

/**
 * Signal-draft notifications to a user-provided URL (M11 open item, D76) - typically the user's
 * own n8n "Webhook" node that forwards to their Telegram. The app only POSTs; it never places an
 * order (rule 7), and the payload never says buy/sell (rule 9). Format documented in
 * docs/AI-BOT-TASLAK.md.
 */

export const NOTICE_SCHEMA = 'signal-draft-notice/v1';
export const DISCLAIMER =
  'Araştırma taslağı: bir strateji kuralının eşleştiğini gösterir; al/sat tavsiyesi değildir. Emri yalnızca sen verirsin.';

export function isWebhookUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export interface DraftNotice {
  schema: typeof NOTICE_SCHEMA;
  kind: 'SIGNAL_DRAFT';
  id: string;
  strategy: { id: string; name: string; version: number };
  instrument: string;
  direction: 'LONG' | 'SHORT';
  order: { type: string; entry: number; stop: number; target: number };
  lots: number;
  riskAmount: number;
  conditions: string[];
  createdAt: string;
  expiresAt: string;
  conflictsWith: string[];
  disclaimer: string;
}

export interface TestNotice {
  schema: typeof NOTICE_SCHEMA;
  kind: 'TEST';
  message: string;
  sentAt: string;
}

const iso = (ms: UtcMs) => new Date(ms).toISOString();

export function draftNotice(sd: StoredDraft, conflictsWith: string[]): DraftNotice {
  const d = sd.draft;
  return {
    schema: NOTICE_SCHEMA,
    kind: 'SIGNAL_DRAFT',
    id: d.id,
    strategy: { id: d.strategyId, name: sd.strategyName, version: d.strategyVersion },
    instrument: d.instrument,
    direction: d.direction,
    order: {
      type: d.order.type,
      entry: d.order.price ?? d.order.referencePrice,
      stop: d.order.stop,
      target: d.order.target,
    },
    lots: d.lots,
    riskAmount: d.riskAmount,
    conditions: d.conditions.map((c) => c.stepId),
    createdAt: iso(d.createdAt),
    expiresAt: iso(d.expiresAt),
    conflictsWith,
    disclaimer: DISCLAIMER,
  };
}

/** A connection check for setting up the receiving side; carries no prices or draft data. */
export function testNotice(at: UtcMs): TestNotice {
  return {
    schema: NOTICE_SCHEMA,
    kind: 'TEST',
    message: 'Bağlantı testi — Trading Research Workstation. Bu gerçek bir taslak değildir.',
    sentAt: iso(at),
  };
}

export interface NotifyResult {
  sent: number;
  failed: number;
  /** The last failure's reason, shown to the user (failures are never silent). */
  error: string | null;
}

type FetchFn = (url: string, init: RequestInit) => Promise<{ ok: boolean; status: number }>;

export async function postNotices(
  url: string,
  notices: readonly (DraftNotice | TestNotice)[],
  fetchFn: FetchFn = fetch,
): Promise<NotifyResult> {
  const r: NotifyResult = { sent: 0, failed: 0, error: null };
  for (const n of notices) {
    try {
      const res = await fetchFn(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(n),
      });
      if (res.ok) r.sent++;
      else {
        r.failed++;
        r.error = `HTTP ${res.status}`;
      }
    } catch (e) {
      r.failed++;
      r.error = e instanceof Error ? e.message : String(e);
    }
  }
  return r;
}

/** Notifies drafts that are new since the last sync and still valid at `now`, naming conflicts. */
export async function notifyNewDrafts(p: {
  url: string;
  fresh: readonly StoredDraft[];
  all: readonly StoredDraft[];
  now: UtcMs;
  fetchFn?: FetchFn;
}): Promise<NotifyResult> {
  const send = p.fresh.filter((d) => d.draft.expiresAt > p.now);
  if (send.length === 0) return { sent: 0, failed: 0, error: null };
  const nameOf = new Map(p.all.map((d) => [d.id, d.strategyName]));
  const partners = new Map<string, string[]>();
  for (const c of findConflicts(
    p.all.map((d) => d.draft),
    p.now,
  )) {
    partners.set(c.a, [...(partners.get(c.a) ?? []), nameOf.get(c.b) ?? c.b]);
    partners.set(c.b, [...(partners.get(c.b) ?? []), nameOf.get(c.a) ?? c.a]);
  }
  return postNotices(
    p.url,
    send.map((d) => draftNotice(d, partners.get(d.id) ?? [])),
    p.fetchFn,
  );
}
