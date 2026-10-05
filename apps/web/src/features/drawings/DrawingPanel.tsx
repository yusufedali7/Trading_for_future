import { useEffect, useState } from 'react';
import {
  TIMEFRAMES,
  fibLevels,
  roundToTick,
  setLevelStatus,
  type Drawing,
  type IanaTz,
  type Instrument,
  type LevelKind,
  type LevelStatus,
  type SupportResistanceLevel,
  type Timeframe,
} from '@trw/engine';
import { positionLabels, priceRangeLabel } from '../../chart/drawing-labels';
import { DEFAULT_DRAWING_COLOR } from '../../chart/primitives/drawings';
import { formatTime } from '../../format';
import { tr } from '../../i18n/tr';

export const DRAWING_COLORS = {
  gray: DEFAULT_DRAWING_COLOR,
  blue: '#5b9bd5',
  copper: '#d0905e',
  purple: '#9b8bd4',
  amber: '#d4a72c',
} as const;

const LEVEL_KINDS: LevelKind[] = ['SUPPORT', 'RESISTANCE', 'FLIP'];
const LEVEL_STATUSES: LevelStatus[] = ['ACTIVE', 'BROKEN', 'RETESTED', 'INVALIDATED'];

export interface DrawingPanelProps {
  drawing: Drawing;
  level: SupportResistanceLevel | undefined;
  instrument: Instrument;
  timeframe: Timeframe;
  displayTz: IanaTz;
  lastClose: number | null;
  now: () => number;
  newId: () => string;
  onSave: (d: Drawing) => void;
  onDelete: (id: string) => void;
  onSaveLevel: (l: SupportResistanceLevel) => void;
  onDeleteLevel: (id: string) => void;
}

export function DrawingPanel(p: DrawingPanelProps) {
  const d = p.drawing;
  const [note, setNote] = useState(d.note ?? '');
  useEffect(() => setNote(d.note ?? ''), [d.id, d.note]);
  const [text, setText] = useState(d.text ?? '');
  useEffect(() => setText(d.text ?? ''), [d.id, d.text]);
  const isFib = d.kind === 'FIB_RETRACEMENT' || d.kind === 'FIB_EXTENSION';

  const isPosition = d.kind === 'POSITION_LONG' || d.kind === 'POSITION_SHORT';
  const canBeLevel = d.kind === 'HLINE' || d.kind === 'RECT';

  const createLevel = () => {
    // A level below the last close starts as support, above it as resistance; the user can change it.
    const mid = d.kind === 'HLINE' ? d.anchors[0]!.p : (d.anchors[0]!.p + d.anchors[1]!.p) / 2;
    const kind: LevelKind = p.lastClose !== null && mid > p.lastClose ? 'RESISTANCE' : 'SUPPORT';
    const at = p.now();
    p.onSaveLevel({
      id: p.newId(),
      drawingId: d.id,
      instrument: d.instrument,
      kind,
      timeframe: p.timeframe,
      note: '',
      status: 'ACTIVE',
      statusHistory: [{ status: 'ACTIVE', at }],
      createdAt: at,
      updatedAt: at,
    });
  };

  return (
    <section className="panel" aria-labelledby="drawing-panel-title">
      <h3 id="drawing-panel-title">{tr.drawings.selectedTitle}</h3>
      <p className="muted-inline">{tr.drawings.kinds[d.kind]}</p>

      <div className="field-row" role="group" aria-label={tr.drawings.color}>
        {(Object.keys(DRAWING_COLORS) as (keyof typeof DRAWING_COLORS)[]).map((name) => (
          <button
            key={name}
            type="button"
            className="swatch"
            style={{ background: DRAWING_COLORS[name] }}
            aria-label={tr.drawings.colors[name]}
            aria-pressed={(d.style.color ?? DEFAULT_DRAWING_COLOR) === DRAWING_COLORS[name]}
            onClick={() => p.onSave({ ...d, style: { ...d.style, color: DRAWING_COLORS[name] } })}
          />
        ))}
      </div>

      {d.kind === 'PRICE_RANGE' && (
        <p className="mono">{priceRangeLabel(p.instrument, d.anchors[0]!, d.anchors[1]!)}</p>
      )}

      {isPosition && <PositionFields {...p} />}

      {d.kind === 'TEXT' && (
        <label className="stack">
          <span>{tr.drawings.textLabel}</span>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={() => {
              if (text.trim() && text !== d.text) p.onSave({ ...d, text: text.trim() });
              else setText(d.text ?? '');
            }}
          />
        </label>
      )}

      {isFib && (
        <div className="stack">
          <dl className="kv">
            {fibLevels(p.instrument, d.kind as 'FIB_RETRACEMENT' | 'FIB_EXTENSION', d.anchors).map(
              (l) => (
                <div className="kv-row" key={l.level}>
                  <dt>{l.level}</dt>
                  <dd>{l.price.toFixed(p.instrument.pricePrecision)}</dd>
                </div>
              ),
            )}
          </dl>
          <p className="hint">{tr.drawings.fibNote}</p>
        </div>
      )}

      <label className="stack">
        <span>{tr.drawings.note}</span>
        <textarea
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => note !== (d.note ?? '') && p.onSave({ ...d, note })}
        />
      </label>

      {canBeLevel && !p.level && (
        <button type="button" className="btn" onClick={createLevel}>
          {tr.drawings.makeLevel}
        </button>
      )}
      {canBeLevel && p.level && <LevelFields {...p} level={p.level} />}

      <button type="button" className="btn btn-danger" onClick={() => p.onDelete(d.id)}>
        {tr.drawings.delete}
      </button>
    </section>
  );
}

function PositionFields(p: DrawingPanelProps) {
  const d = p.drawing;
  const kind = d.kind as 'POSITION_LONG' | 'POSITION_SHORT';
  const [entry, stop, target] = d.anchors.map((a) => a.p) as [number, number, number];
  const labels = positionLabels(p.instrument, kind, entry, stop, target);
  const setPrice = (index: number, value: string) => {
    const n = Number(value.replace(',', '.'));
    if (!Number.isFinite(n) || n <= 0) return;
    const anchors = d.anchors.map((a, i) =>
      i === index ? { ...a, p: roundToTick(p.instrument, n) } : a,
    );
    p.onSave({ ...d, anchors });
  };
  const field = (label: string, index: number, value: number) => (
    <label className="inline-field">
      <span>{label}</span>
      <input
        type="number"
        step={p.instrument.tickSize}
        defaultValue={value}
        key={`${d.id}-${index}-${value}`}
        onBlur={(e) => setPrice(index, e.target.value)}
      />
    </label>
  );
  return (
    <div className="stack">
      {field(tr.drawings.entry, 0, entry)}
      {field(tr.drawings.stopPrice, 1, stop)}
      {field(tr.drawings.targetPrice, 2, target)}
      <p className="mono">
        {labels.target} · {labels.stop} · {labels.ratio}
      </p>
    </div>
  );
}

function LevelFields(p: DrawingPanelProps & { level: SupportResistanceLevel }) {
  const l = p.level;
  const [statusNote, setStatusNote] = useState('');
  return (
    <div className="stack level-fields">
      <label className="inline-field">
        <span>{tr.levels.kind}</span>
        <select
          value={l.kind}
          onChange={(e) =>
            p.onSaveLevel({ ...l, kind: e.target.value as LevelKind, updatedAt: p.now() })
          }
        >
          {LEVEL_KINDS.map((k) => (
            <option key={k} value={k}>
              {tr.levels.kinds[k]}
            </option>
          ))}
        </select>
      </label>
      <label className="inline-field">
        <span>{tr.levels.timeframe}</span>
        <select
          value={l.timeframe}
          onChange={(e) =>
            p.onSaveLevel({ ...l, timeframe: e.target.value as Timeframe, updatedAt: p.now() })
          }
        >
          {TIMEFRAMES.map((tf) => (
            <option key={tf} value={tf}>
              {tf}
            </option>
          ))}
        </select>
      </label>
      <label className="inline-field">
        <span>{tr.levels.statusNote}</span>
        <input type="text" value={statusNote} onChange={(e) => setStatusNote(e.target.value)} />
      </label>
      <label className="inline-field">
        <span>{tr.levels.status}</span>
        <select
          value={l.status}
          onChange={(e) => {
            const next = setLevelStatus(
              l,
              e.target.value as LevelStatus,
              p.now(),
              statusNote.trim() || undefined,
            );
            setStatusNote('');
            p.onSaveLevel(next);
          }}
        >
          {LEVEL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {tr.levels.statuses[s]}
            </option>
          ))}
        </select>
      </label>
      <details>
        <summary>{tr.levels.history}</summary>
        <ul className="history">
          {l.statusHistory.map((h, i) => (
            <li key={i}>
              {formatTime(h.at, p.displayTz)} · {tr.levels.statuses[h.status]}
              {h.note ? ` · ${h.note}` : ''}
            </li>
          ))}
        </ul>
      </details>
      <button type="button" className="btn" onClick={() => p.onDeleteLevel(l.id)}>
        {tr.levels.remove}
      </button>
    </div>
  );
}
