import { useState, type FormEvent } from 'react';
import {
  buildOrder,
  defaultDraft,
  pipsToPrice,
  priceToPips,
  type CostModel,
  type DraftProblem,
  type IanaTz,
  type Instrument,
  type OrderDraft,
  type OrderType,
  type PriceUnit,
  type ReplayTrade,
  type UtcMs,
} from '@trw/engine';
import { formatDuration } from '../../chart/drawing-labels';
import { formatTime } from '../../format';
import { tr } from '../../i18n/tr';
import { isFinal } from './use-replay-trade';

const ORDER_TYPES: OrderType[] = ['MARKET', 'LIMIT', 'STOP'];
const MINUS = '−';

/** "+1,25R" / "−1,00R" */
export function formatR(r: number): string {
  const abs = Math.abs(r).toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${r < 0 ? MINUS : r > 0 ? '+' : ''}${abs}R`;
}

/** Empty or unparsable → NaN; accepts a decimal comma. */
const parse = (s: string) => (s.trim() === '' ? NaN : Number(s.replace(',', '.')));

export interface TradePanelProps {
  instrument: Instrument;
  displayTz: IanaTz;
  cursor: UtcMs | null;
  lastClose: number | null;
  baseMs: number;
  trade: ReplayTrade | null;
  onPlace: (draft: OrderDraft, costs: CostModel, lastClose: number) => Promise<DraftProblem | null>;
  onClose: () => void;
  onDismiss: () => void;
}

export function TradePanel(p: TradePanelProps) {
  return (
    <section className="panel" aria-labelledby="trade-panel-title">
      <h3 id="trade-panel-title">{tr.trade.title}</h3>
      {p.cursor === null || p.lastClose === null ? (
        <p className="hint">{tr.trade.outsideReplay}</p>
      ) : p.trade ? (
        <TradeStatusView {...p} trade={p.trade} cursor={p.cursor} />
      ) : (
        <OrderForm {...p} lastClose={p.lastClose} />
      )}
    </section>
  );
}

interface FormState {
  direction: OrderDraft['direction'];
  type: OrderType;
  price: string;
  unit: PriceUnit;
  stop: string;
  target: string;
  expireBars: string;
  spread: string;
  slippage: string;
}

function OrderForm(p: TradePanelProps & { lastClose: number }) {
  const inst = p.instrument;
  const d0 = defaultDraft('LONG');
  const [f, setF] = useState<FormState>({
    direction: 'LONG',
    type: 'MARKET',
    price: '',
    unit: 'PIPS',
    stop: String(d0.stop),
    target: String(d0.target),
    expireBars: String(d0.expireBars),
    spread: '0',
    slippage: '0',
  });
  const [submitted, setSubmitted] = useState<DraftProblem | null>(null);
  const set = (patch: Partial<FormState>) => {
    setF((s) => ({ ...s, ...patch }));
    setSubmitted(null);
  };

  const draft: OrderDraft = {
    direction: f.direction,
    type: f.type,
    price: f.type === 'MARKET' ? null : parse(f.price),
    unit: f.unit,
    stop: parse(f.stop),
    target: parse(f.target),
    expireBars: f.expireBars.trim() === '' ? null : parse(f.expireBars),
  };
  const built = buildOrder(inst, draft, { placedAt: 0, lastClose: p.lastClose, barMs: 1 });
  const spreadPips = parse(f.spread);
  const slippagePips = parse(f.slippage);
  const costsValid = spreadPips >= 0 && slippagePips >= 0;
  const costs: CostModel = {
    spread: pipsToPrice(inst, costsValid ? spreadPips : 0),
    slippage: pipsToPrice(inst, costsValid ? slippagePips : 0),
  };

  const fmt = (x: number) => x.toFixed(inst.pricePrecision);
  const ref = f.type === 'MARKET' ? p.lastClose : parse(f.price);

  const switchUnit = (unit: PriceUnit) => {
    if (unit === f.unit) return;
    if (unit === 'PRICE' && 'order' in built) {
      set({ unit, stop: fmt(built.order.stop), target: fmt(built.order.target) });
    } else if (unit === 'PIPS' && Number.isFinite(ref)) {
      const pips = (x: number) => String(Math.abs(priceToPips(inst, ref - x)));
      set({
        unit,
        stop: Number.isFinite(draft.stop) ? pips(draft.stop) : f.stop,
        target: Number.isFinite(draft.target) ? pips(draft.target) : f.target,
      });
    } else set({ unit });
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!costsValid) return;
    setSubmitted(await p.onPlace(draft, costs, p.lastClose));
  };

  const problem = 'problem' in built ? built.problem : null;
  const preview =
    'order' in built
      ? tr.trade.preview(
          fmt(built.order.stop),
          fmt(built.order.target),
          (Math.abs(built.order.target - ref) / Math.abs(ref - built.order.stop)).toLocaleString(
            'tr-TR',
            { maximumFractionDigits: 2 },
          ),
        )
      : null;

  const field = (label: string, key: keyof FormState, step: number | string, min?: number) => (
    <label className="inline-field">
      <span>{label}</span>
      <input
        type="number"
        step={step}
        min={min}
        value={f[key]}
        onChange={(e) => set({ [key]: e.target.value })}
      />
    </label>
  );

  return (
    <form className="stack trade-form" onSubmit={(e) => void onSubmit(e)}>
      <div className="segmented" role="group" aria-label={tr.trade.direction}>
        {(['LONG', 'SHORT'] as const).map((dir) => (
          <button
            key={dir}
            type="button"
            className={`seg seg-${dir.toLowerCase()}`}
            aria-pressed={f.direction === dir}
            onClick={() => set({ direction: dir })}
          >
            {tr.trade.directions[dir]}
          </button>
        ))}
      </div>
      <label className="inline-field">
        <span>{tr.trade.orderType}</span>
        <select
          value={f.type}
          onChange={(e) => {
            const type = e.target.value as OrderType;
            set({ type, price: f.price || fmt(p.lastClose) });
          }}
        >
          {ORDER_TYPES.map((t) => (
            <option key={t} value={t}>
              {tr.trade.orderTypes[t]}
            </option>
          ))}
        </select>
      </label>
      {f.type !== 'MARKET' && field(tr.trade.triggerPrice, 'price', inst.tickSize)}
      <div className="segmented" role="group" aria-label={tr.trade.unit}>
        {(['PIPS', 'PRICE'] as const).map((u) => (
          <button
            key={u}
            type="button"
            className="seg"
            aria-pressed={f.unit === u}
            onClick={() => switchUnit(u)}
          >
            {tr.trade.units[u]}
          </button>
        ))}
      </div>
      {field(tr.trade.stop, 'stop', f.unit === 'PIPS' ? 0.1 : inst.tickSize, 0)}
      {field(tr.trade.target, 'target', f.unit === 'PIPS' ? 0.1 : inst.tickSize, 0)}
      {f.type !== 'MARKET' && (
        <>
          {field(tr.trade.expireBars, 'expireBars', 1, 1)}
          <p className="hint">{tr.trade.expireHint}</p>
        </>
      )}
      {field(tr.trade.spread, 'spread', 0.1, 0)}
      {field(tr.trade.slippage, 'slippage', 0.1, 0)}
      {costsValid && spreadPips === 0 && slippagePips === 0 && (
        <p className="warn-text">{tr.trade.costFree}</p>
      )}
      {preview && <p className="mono">{preview}</p>}
      {(problem ?? submitted) && (
        <p className="warn-text" role="alert">
          {tr.trade.problems[(problem ?? submitted)!]}
        </p>
      )}
      <button type="submit" className="btn btn-primary" disabled={problem !== null || !costsValid}>
        {tr.trade.submit(tr.trade.directions[f.direction])}
      </button>
    </form>
  );
}

function TradeStatusView(p: TradePanelProps & { trade: ReplayTrade; cursor: UtcMs }) {
  const { trade: t, instrument: inst } = p;
  const r = t.result;
  const fmt = (x: number) => x.toFixed(inst.pricePrecision);
  const final = isFinal(r.status);
  const entered = r.entryAt !== undefined && r.entryPrice !== undefined && r.status !== 'EXPIRED';
  const duration = !entered
    ? null
    : r.status === 'OPEN'
      ? p.cursor - r.entryAt!
      : r.exitAt !== undefined
        ? r.exitAt + p.baseMs - r.entryAt!
        : null;
  const pips = (x: number) =>
    priceToPips(inst, x).toLocaleString('tr-TR', { maximumFractionDigits: 1 });

  return (
    <div className="stack trade-status">
      <p className="mono">
        <span className={t.order.direction === 'LONG' ? 'up' : 'down'}>
          {tr.trade.directions[t.order.direction]} {t.order.direction === 'LONG' ? '▲' : '▼'}
        </span>{' '}
        · {tr.trade.orderTypes[t.order.type]}
      </p>
      <p className="trade-state" aria-live="polite">
        {tr.trade.statuses[r.status]}
        {r.exitReason ? ` · ${tr.trade.exitReasons[r.exitReason]}` : ''}
      </p>
      {r.status === 'PENDING' && t.order.type === 'MARKET' && (
        <p className="hint">{tr.trade.pendingMarket}</p>
      )}
      <dl className="kv trade-kv">
        {t.order.price !== undefined && (
          <div className="kv-row">
            <dt>{tr.trade.triggerPrice}</dt>
            <dd className="mono">{fmt(t.order.price)}</dd>
          </div>
        )}
        {entered && (
          <div className="kv-row">
            <dt>{tr.trade.entry}</dt>
            <dd className="mono">
              {fmt(r.entryPrice!)} · {formatTime(r.entryAt!, p.displayTz)}
            </dd>
          </div>
        )}
        <div className="kv-row">
          <dt>{tr.trade.stop}</dt>
          <dd className="mono">{fmt(t.order.stop)}</dd>
        </div>
        <div className="kv-row">
          <dt>{tr.trade.target}</dt>
          <dd className="mono">{fmt(t.order.target)}</dd>
        </div>
        {r.status === 'CLOSED' && r.exitPrice !== undefined && (
          <div className="kv-row">
            <dt>{tr.trade.exit}</dt>
            <dd className="mono">{fmt(r.exitPrice)}</dd>
          </div>
        )}
        {r.r !== null && (
          <div className="kv-row">
            <dt>{r.status === 'OPEN' ? tr.trade.liveR : tr.trade.result}</dt>
            <dd className={`mono ${r.r > 0 ? 'up' : r.r < 0 ? 'down' : ''}`} data-testid="trade-r">
              {formatR(r.r)}
            </dd>
          </div>
        )}
        {entered && (
          <div className="kv-row">
            <dt>MAE / MFE</dt>
            <dd className="mono">{tr.trade.excursions(formatR(-r.maeR), formatR(r.mfeR))}</dd>
          </div>
        )}
        {duration !== null && (
          <div className="kv-row">
            <dt>{tr.trade.duration}</dt>
            <dd className="mono">{formatDuration(duration)}</dd>
          </div>
        )}
      </dl>
      {r.ambiguous && <p className="warn-text">{tr.trade.ambiguous}</p>}
      <p className="hint">{tr.trade.costs(pips(t.costs.spread), pips(t.costs.slippage))}</p>
      {!final && (
        <button type="button" className="btn" onClick={p.onClose}>
          {r.status === 'OPEN' ? tr.trade.close : tr.trade.cancel}
        </button>
      )}
      {final && (
        <button type="button" className="btn" onClick={p.onDismiss}>
          {tr.trade.newTrade}
        </button>
      )}
    </div>
  );
}
