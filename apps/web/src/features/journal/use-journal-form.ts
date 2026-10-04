import { useState, type MutableRefObject } from 'react';
import {
  BUILTIN_SESSIONS,
  activeSessions,
  journalResultOf,
  type Instrument,
  type JournalEntry,
  type ReplayTrade,
  type SessionDefinition,
  type Timeframe,
  type UtcMs,
} from '@trw/engine';
import type { ChartScreenshot } from '../../chart/types';
import type { JournalRepo } from '../../storage/journal-repo';
import type { JournalDraft, JournalFields } from './JournalForm';

export function draftFromTrade(
  t: ReplayTrade,
  inst: Instrument,
  baseMs: number,
  defs: readonly SessionDefinition[] = BUILTIN_SESSIONS,
): JournalDraft {
  return {
    instrument: t.instrument,
    decision: t.order.direction,
    decidedAt: t.order.placedAt,
    timeframe: t.timeframe,
    sessions: activeSessions(defs, inst, t.order.placedAt),
    tradeId: t.id,
    status: t.result.status,
    result: journalResultOf(t.result, baseMs),
  };
}

export function noTradeDraft(
  inst: Instrument,
  at: UtcMs,
  timeframe: Timeframe,
  defs: readonly SessionDefinition[] = BUILTIN_SESSIONS,
): JournalDraft {
  return {
    instrument: inst.symbol,
    decision: 'NO_TRADE',
    decidedAt: at,
    timeframe,
    sessions: activeSessions(defs, inst, at),
    tradeId: null,
    status: null,
    result: null,
  };
}

/** The open journal form and how its entry (plus an optional chart screenshot) is stored. */
export function useJournalForm(
  repo: JournalRepo,
  screenshotRef: MutableRefObject<ChartScreenshot | null>,
  now: () => number,
  newId: () => string,
) {
  const [draft, setDraft] = useState<JournalDraft | null>(null);

  /** Stores the entry and returns its id. */
  const save = async (d: JournalDraft, f: JournalFields): Promise<string> => {
    const screenshotIds: string[] = [];
    if (f.withScreenshot) {
      const shot = await screenshotRef.current?.().catch(() => null);
      if (shot) {
        const id = newId();
        await repo.saveScreenshot({ id, ...shot });
        screenshotIds.push(id);
      }
    }
    const at = now();
    const entry: JournalEntry = {
      id: newId(),
      instrument: d.instrument,
      decision: d.decision,
      decidedAt: d.decidedAt,
      timeframe: d.timeframe,
      sessions: d.sessions,
      tradeId: d.tradeId,
      result: d.result,
      strategy: f.strategy,
      reason: f.reason,
      emotion: f.emotion,
      emotionIntensity: f.emotionIntensity,
      lesson: f.lesson,
      tags: f.tags,
      screenshotIds,
      createdAt: at,
      updatedAt: at,
    };
    await repo.saveEntry(entry);
    setDraft(null);
    return entry.id;
  };

  return { draft, open: setDraft, close: () => setDraft(null), save };
}
