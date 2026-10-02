import type { EventStep, StrategySpec } from '@trw/engine';
import { tr } from '../../i18n/tr';

const b = tr.strategy.builder;
const s = tr.strategy.summary;

function stepLine(st: EventStep, i: number): string {
  const parts: string[] = [b.stepTypes[st.type]];
  if (st.type === 'LIQUIDITY_SWEEP' || st.type === 'STRUCTURE_BREAK' || st.type === 'FVG')
    if (st.direction) parts.push(b.direction3[st.direction].toLowerCase());
  if (st.type === 'STRUCTURE_BREAK' && st.kind) parts.push(st.kind === 'BOS' ? 'BOS' : 'CHoCH');
  if (st.type === 'SWING' && st.kind) parts.push(b.swingKind[st.kind].toLowerCase());
  if (st.type === 'LIQUIDITY_SWEEP' && st.levels?.length)
    parts.push(s.levels(st.levels.map((l) => tr.strategy.levelNames[l] ?? l).join(', ')));
  if (i > 0 && st.maxBars) parts.push(s.within(st.maxBars));
  return `${i + 1}. ${st.id}: ${parts.join(', ')}`;
}

/** Human-readable rules of a spec (Turkish), one line per element. */
export function specSummary(spec: StrategySpec): string[] {
  const w = spec.window;
  const head = [
    spec.instrument,
    spec.timeframe,
    b.directions[spec.direction],
    w ? `${w.start}–${w.end} (${w.tz})` : s.anyTime,
  ].join(' · ');
  const e = spec.entry;
  const entry =
    e.type === 'MARKET'
      ? s.entryMarket
      : s.entryAt(e.type === 'LIMIT_AT' ? 'limit' : 'stop', e.ref, e.expireBars);
  const st = spec.stop;
  const stop = st.type === 'BEYOND_REF' ? s.stopBeyond(st.ref, st.bufferPips) : s.stopPips(st.pips);
  const t = spec.target;
  const target =
    t.type === 'R_MULTIPLE'
      ? s.targetR(t.r)
      : t.type === 'FIXED_PIPS'
        ? s.targetPips(t.pips)
        : s.targetRef(t.ref, t.bufferPips);
  const tail = [entry, stop, target, s.risk(spec.risk.percentPerTrade)];
  if (spec.maxTradesPerDay !== null) tail.push(s.perDay(spec.maxTradesPerDay));
  return [head, ...spec.steps.map(stepLine), tail.join(' · ')];
}
