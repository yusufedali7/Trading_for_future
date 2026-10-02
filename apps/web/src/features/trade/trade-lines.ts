import type { ReplayTrade } from '@trw/engine';
import type { TradeLine } from '../../chart/types';

/** Chart lines for a replay trade: the pending order or the fill, plus stop and target. */
export function tradeLinesFor(t: ReplayTrade | null): TradeLine[] {
  if (!t) return [];
  const { status, entryPrice } = t.result;
  if (status !== 'PENDING' && status !== 'OPEN' && status !== 'CLOSED') return [];
  const lines: TradeLine[] = [];
  if (status === 'PENDING' && t.order.price !== undefined)
    lines.push({ kind: 'ORDER', price: t.order.price });
  if (status !== 'PENDING' && entryPrice !== undefined)
    lines.push({ kind: 'ENTRY', price: entryPrice });
  lines.push({ kind: 'STOP', price: t.order.stop }, { kind: 'TARGET', price: t.order.target });
  return lines;
}
