import type { SessionLevels } from '@trw/engine';
import { timeToPosition } from '../coords';

export interface SessionBox {
  sessionId: string;
  date: string;
  x1: number;
  x2: number;
  /** Pixel y of the session high (top edge). */
  yTop: number;
  /** Pixel y of the session low (bottom edge). */
  yBottom: number;
  complete: boolean;
}

/**
 * Pure geometry for session boxes: which sessions are visible and where. Kept separate from the
 * canvas renderer so it can be tested without a browser.
 */
export function layoutSessionBoxes(
  sessions: readonly SessionLevels[],
  times: ArrayLike<number>,
  tfMs: number,
  visible: { from: number; to: number },
  toX: (logical: number) => number | null,
  toY: (price: number) => number | null,
): SessionBox[] {
  const out: SessionBox[] = [];
  for (const s of sessions) {
    if (s.high === null || s.low === null) continue;
    const p1 = timeToPosition(times, tfMs, s.startUtc);
    const p2 = timeToPosition(times, tfMs, s.endUtc);
    if (!(p2 > visible.from && p1 < visible.to)) continue;
    const x1 = toX(p1);
    const x2 = toX(p2);
    const yTop = toY(s.high);
    const yBottom = toY(s.low);
    if (x1 === null || x2 === null || yTop === null || yBottom === null) continue;
    out.push({ sessionId: s.sessionId, date: s.date, x1, x2, yTop, yBottom, complete: s.complete });
  }
  return out;
}
