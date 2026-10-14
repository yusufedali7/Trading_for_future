import { useState } from 'react';
import {
  availableRefs,
  CANDLE_PATTERN_IDS,
  CHART_PATTERN_IDS,
  listInstruments,
  specWarnings,
  validateSpec,
  type EventStep,
  referencedSessionIds,
  type LiquidityKind,
  type SessionDefinition,
  type StepType,
  type StrategySpec,
  type Timeframe,
} from '@trw/engine';
import { Term } from '../../components/Term';
import { TERMS } from '../../content/terms';
import { tr } from '../../i18n/tr';
import { toDefinition, type UserSession } from '../../storage/sessions-repo';

const b = tr.strategy.builder;
const TIMEFRAMES: Timeframe[] = ['1m', '5m', '15m', '30m', '1h', '4h', '1D'];
const STEP_TYPES: StepType[] = [
  'LIQUIDITY_SWEEP',
  'STRUCTURE_BREAK',
  'FVG',
  'SWING',
  'ORDER_BLOCK',
  'IFVG',
  'BREAKER',
  'OTE',
  'PATTERN_EVENT',
  'EMA_PULLBACK',
  'DONCHIAN_BREAK',
  'CANDLE_PATTERN_EVENT',
];
const STEP_BASE: Record<StepType, string> = {
  LIQUIDITY_SWEEP: 'sweep',
  STRUCTURE_BREAK: 'mss',
  FVG: 'fvg',
  SWING: 'swing',
  ORDER_BLOCK: 'ob',
  IFVG: 'ifvg',
  BREAKER: 'breaker',
  OTE: 'ote',
  PATTERN_EVENT: 'pattern',
  EMA_PULLBACK: 'pullback',
  DONCHIAN_BREAK: 'breakout',
  CANDLE_PATTERN_EVENT: 'candle',
};
const FIXED_LEVELS: LiquidityKind[] = [
  'SWING_HIGH',
  'SWING_LOW',
  'PDH',
  'PDL',
  'PWH',
  'PWL',
  'ASIA_HIGH',
  'ASIA_LOW',
  'LONDON_HIGH',
  'LONDON_LOW',
  'NEW_YORK_HIGH',
  'NEW_YORK_LOW',
];

/** Empty input → NaN, so validation reports it instead of silently using 0. */
const num = (v: string) => (v.trim() === '' ? NaN : Number(v.replace(',', '.')));
const show = (n: number) => (Number.isFinite(n) ? String(n) : '');

function uniqueId(steps: readonly EventStep[], type: StepType): string {
  const base = STEP_BASE[type];
  if (!steps.some((s) => s.id === base)) return base;
  let i = 2;
  while (steps.some((s) => s.id === `${base}${i}`)) i++;
  return `${base}${i}`;
}

function blankStep(type: StepType, id: string, first: boolean): EventStep {
  const maxBars = first ? undefined : 12;
  const extra =
    type === 'PATTERN_EVENT'
      ? { patternId: CHART_PATTERN_IDS[0]! }
      : type === 'CANDLE_PATTERN_EVENT'
        ? { patternId: CANDLE_PATTERN_IDS[0]! }
        : type === 'EMA_PULLBACK'
          ? { period: 50 }
          : type === 'DONCHIAN_BREAK'
            ? { period: 20 }
            : {};
  return { id, type, ...extra, ...(maxBars ? { maxBars } : {}) } as EventStep;
}

export interface StrategyBuilderProps {
  initial: StrategySpec;
  /** Asked only when creating a strategy. */
  askName: boolean;
  onSave: (spec: StrategySpec, meta: { name: string; description: string; note: string }) => void;
  /** The user's sessions: their highs/lows can be swept levels (D35). */
  userSessions?: readonly UserSession[];
  onCancel: () => void;
}

export function StrategyBuilder({
  initial,
  askName,
  onSave,
  onCancel,
  userSessions = [],
}: StrategyBuilderProps) {
  const [draft, setSpec] = useState<StrategySpec>(initial);
  // Session definitions a level may refer to: the user's current ones, then copies in the version.
  const pool = new Map<string, SessionDefinition>();
  for (const d of initial.sessions ?? []) pool.set(d.id, d);
  for (const u of userSessions) pool.set(u.id, toDefinition(u));
  const copies = referencedSessionIds(draft.steps).flatMap((id) =>
    pool.has(id) ? [pool.get(id)!] : [],
  );
  // What gets validated and saved: the draft plus copies of the user sessions it uses.
  const { sessions: _old, ...rest } = draft;
  const spec: StrategySpec = copies.length > 0 ? { ...rest, sessions: copies } : rest;
  const LEVELS: LiquidityKind[] = [
    ...FIXED_LEVELS,
    ...[...pool.values()].flatMap((d) => [
      `${d.id}_HIGH` as LiquidityKind,
      `${d.id}_LOW` as LiquidityKind,
    ]),
  ];
  const levelName = (l: string) => {
    const fixed = tr.strategy.levelNames[l];
    if (fixed) return fixed;
    const id = l.replace(/_(HIGH|LOW)$/, '');
    return `${pool.get(id)?.name ?? id} ${l.endsWith('_HIGH') ? 'Y' : 'D'}`;
  };
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [note, setNote] = useState('');
  const problems = validateSpec(spec);
  const warnings = specWarnings(spec);
  const refs = availableRefs(spec.steps);
  const patch = (p: Partial<StrategySpec>) => setSpec((s) => ({ ...s, ...p }));
  const setStep = (i: number, st: EventStep) =>
    patch({ steps: spec.steps.map((x, k) => (k === i ? st : x)) });

  const refSelect = (label: string, value: string, onChange: (v: string) => void) => (
    <label className="inline-field">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {!refs.includes(value) && <option value={value}>{value || '—'}</option>}
        {refs.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
    </label>
  );
  const numField = (label: string, value: number, onChange: (n: number) => void, step = 1) => (
    <label className="inline-field">
      <span>{label}</span>
      <input
        type="number"
        step={step}
        value={show(value)}
        onChange={(e) => onChange(num(e.target.value))}
      />
    </label>
  );

  const canSave = problems.length === 0 && (!askName || name.trim() !== '');

  return (
    <form
      className="strategy-builder stack"
      aria-label={b.title}
      onSubmit={(e) => {
        e.preventDefault();
        if (canSave)
          onSave(spec, { name: name.trim(), description: description.trim(), note: note.trim() });
      }}
    >
      {askName && (
        <>
          <label className="stack">
            <span>{tr.strategy.name}</span>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="stack">
            <span>{tr.strategy.description}</span>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
        </>
      )}

      <fieldset>
        <legend>{b.title}</legend>
        <div className="builder-grid">
          <label className="inline-field">
            <span>{b.instrument}</span>
            <select value={spec.instrument} onChange={(e) => patch({ instrument: e.target.value })}>
              {listInstruments().map((i) => (
                <option key={i.symbol} value={i.symbol}>
                  {i.symbol}
                </option>
              ))}
            </select>
          </label>
          <label className="inline-field">
            <span>{b.timeframe}</span>
            <select
              value={spec.timeframe}
              onChange={(e) => patch({ timeframe: e.target.value as Timeframe })}
            >
              {TIMEFRAMES.map((tf) => (
                <option key={tf} value={tf}>
                  {tf}
                </option>
              ))}
            </select>
          </label>
          <label className="inline-field">
            <span>{b.direction}</span>
            <select
              value={spec.direction}
              onChange={(e) => patch({ direction: e.target.value as StrategySpec['direction'] })}
            >
              <option value="LONG">{b.directions.LONG}</option>
              <option value="SHORT">{b.directions.SHORT}</option>
            </select>
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend>{b.window}</legend>
        <label className="check">
          <input
            type="checkbox"
            checked={spec.window !== null}
            onChange={(e) =>
              patch({
                window: e.target.checked
                  ? { start: '08:00', end: '11:00', tz: 'Europe/London' }
                  : null,
              })
            }
          />
          <span>{b.windowOn}</span>
        </label>
        {spec.window && (
          <div className="builder-grid">
            <label className="inline-field">
              <span>{b.windowStart}</span>
              <input
                type="time"
                value={spec.window.start}
                onChange={(e) =>
                  patch({
                    window: { ...spec.window!, start: e.target.value as `${number}:${number}` },
                  })
                }
              />
            </label>
            <label className="inline-field">
              <span>{b.windowEnd}</span>
              <input
                type="time"
                value={spec.window.end}
                onChange={(e) =>
                  patch({
                    window: { ...spec.window!, end: e.target.value as `${number}:${number}` },
                  })
                }
              />
            </label>
            <label className="inline-field">
              <span>{b.windowTz}</span>
              <select
                value={spec.window.tz}
                onChange={(e) => patch({ window: { ...spec.window!, tz: e.target.value } })}
              >
                {tr.displayTimezones.map((z) => (
                  <option key={z.value} value={z.value}>
                    {z.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
      </fieldset>

      <fieldset>
        <legend>{b.steps}</legend>
        <ol className="builder-steps">
          {spec.steps.map((st, i) => (
            <li key={i} className="stack">
              <div className="builder-grid">
                <label className="inline-field">
                  <span>{b.stepId}</span>
                  <input
                    type="text"
                    value={st.id}
                    onChange={(e) => setStep(i, { ...st, id: e.target.value })}
                  />
                </label>
                <label className="inline-field">
                  <span>{b.stepType}</span>
                  <select
                    value={st.type}
                    onChange={(e) => {
                      const type = e.target.value as StepType;
                      // An automatic name follows the type; a name the user typed is kept.
                      const auto = new RegExp(`^${STEP_BASE[st.type]}\\d*$`).test(st.id);
                      const others = spec.steps.filter((_, k) => k !== i);
                      const id = auto ? uniqueId(others, type) : st.id;
                      setStep(i, {
                        ...blankStep(type, id, i === 0),
                        ...(st.maxBars ? { maxBars: st.maxBars } : {}),
                      });
                    }}
                  >
                    {STEP_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {b.stepTypes[t]}
                      </option>
                    ))}
                  </select>
                </label>
                {st.type !== 'SWING' && (
                  <label className="inline-field">
                    <span>{b.direction}</span>
                    <select
                      value={st.direction ?? ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        const { direction: _d, ...rest } = st;
                        setStep(i, (v ? { ...rest, direction: v } : rest) as EventStep);
                      }}
                    >
                      {(['', 'BULLISH', 'BEARISH'] as const).map((d) => (
                        <option key={d} value={d}>
                          {b.direction3[d]}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {st.type === 'STRUCTURE_BREAK' && (
                  <label className="inline-field">
                    <span>BOS / CHoCH</span>
                    <select
                      value={st.kind ?? ''}
                      onChange={(e) => {
                        const { kind: _k, ...rest } = st;
                        const v = e.target.value as '' | 'BOS' | 'CHOCH';
                        setStep(i, v ? { ...rest, kind: v } : rest);
                      }}
                    >
                      {(['', 'BOS', 'CHOCH'] as const).map((k) => (
                        <option key={k} value={k}>
                          {b.breakKind[k]}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {st.type === 'SWING' && (
                  <label className="inline-field">
                    <span>{b.stepTypes.SWING}</span>
                    <select
                      value={st.kind ?? ''}
                      onChange={(e) => {
                        const { kind: _k, ...rest } = st;
                        const v = e.target.value as '' | 'HIGH' | 'LOW';
                        setStep(i, v ? { ...rest, kind: v } : rest);
                      }}
                    >
                      {(['', 'HIGH', 'LOW'] as const).map((k) => (
                        <option key={k} value={k}>
                          {b.swingKind[k]}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {st.type === 'PATTERN_EVENT' && (
                  <label className="inline-field">
                    <span>{b.patternId}</span>
                    <select
                      value={st.patternId}
                      onChange={(e) => setStep(i, { ...st, patternId: e.target.value })}
                    >
                      {CHART_PATTERN_IDS.map((p) => (
                        <option key={p} value={p}>
                          {b.patternNames[p] ?? p}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {st.type === 'CANDLE_PATTERN_EVENT' && (
                  <label className="inline-field">
                    <span>{b.candlePatternId}</span>
                    <select
                      value={st.patternId}
                      onChange={(e) => setStep(i, { ...st, patternId: e.target.value })}
                    >
                      {CANDLE_PATTERN_IDS.map((p) => (
                        <option key={p} value={p}>
                          {b.candlePatternNames[p] ?? p}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {(st.type === 'EMA_PULLBACK' || st.type === 'DONCHIAN_BREAK') &&
                  numField(b.period, st.period, (period) => setStep(i, { ...st, period }))}
                {i > 0 &&
                  numField(b.maxBars, st.maxBars ?? NaN, (n) => setStep(i, { ...st, maxBars: n }))}
              </div>
              {st.type === 'LIQUIDITY_SWEEP' && (
                <div className="level-checks" role="group" aria-label={b.levels}>
                  <span className="hint">{b.levels}</span>
                  {LEVELS.map((l) => (
                    <label key={l} className="check">
                      <input
                        type="checkbox"
                        checked={st.levels?.includes(l) ?? false}
                        onChange={(e) => {
                          const cur = st.levels ?? [];
                          const levels = e.target.checked
                            ? LEVELS.filter((x) => x === l || cur.includes(x))
                            : cur.filter((x) => x !== l);
                          setStep(i, { ...st, levels });
                        }}
                      />
                      <span>{levelName(l)}</span>
                    </label>
                  ))}
                </div>
              )}
              {spec.steps.length > 1 && (
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    const steps = spec.steps.filter((_, k) => k !== i);
                    if (steps[0]?.maxBars !== undefined) {
                      const { maxBars: _m, ...first } = steps[0];
                      steps[0] = first as EventStep;
                    }
                    patch({ steps });
                  }}
                >
                  {b.removeStep}
                </button>
              )}
            </li>
          ))}
        </ol>
        <button
          type="button"
          className="btn"
          onClick={() =>
            patch({
              steps: [
                ...spec.steps,
                blankStep('FVG', uniqueId(spec.steps, 'FVG'), spec.steps.length === 0),
              ],
            })
          }
        >
          {b.addStep}
        </button>
      </fieldset>

      <fieldset>
        <legend>{b.entry}</legend>
        <label className="inline-field">
          <span>{b.entry}</span>
          <select
            value={spec.entry.type}
            onChange={(e) => {
              const type = e.target.value as StrategySpec['entry']['type'];
              patch({
                entry:
                  type === 'MARKET'
                    ? { type }
                    : { type, ref: refs[refs.length - 1] ?? '', expireBars: 8 },
              });
            }}
          >
            {(['MARKET', 'LIMIT_AT', 'STOP_AT'] as const).map((t) => (
              <option key={t} value={t}>
                {b.entryTypes[t]}
              </option>
            ))}
          </select>
        </label>
        {spec.entry.type !== 'MARKET' && (
          <>
            {refSelect(b.ref, spec.entry.ref, (ref) =>
              patch({ entry: { ...spec.entry, ref } as StrategySpec['entry'] }),
            )}
            {numField(b.expireBars, spec.entry.expireBars, (n) =>
              patch({ entry: { ...spec.entry, expireBars: n } as StrategySpec['entry'] }),
            )}
          </>
        )}
      </fieldset>

      <fieldset>
        <legend>
          <Term id={TERMS.slTp}>{b.stop}</Term>
        </legend>
        <label className="inline-field">
          <span>{b.stop}</span>
          <select
            value={spec.stop.type}
            onChange={(e) => {
              const t = e.target.value;
              patch({
                stop:
                  t === 'FIXED_PIPS'
                    ? { type: 'FIXED_PIPS', pips: 10 }
                    : t === 'ATR_MULTIPLE'
                      ? { type: 'ATR_MULTIPLE', period: 14, mult: 1.5 }
                      : { type: 'BEYOND_REF', ref: refs[0] ?? '', bufferPips: 1 },
              });
            }}
          >
            {(['BEYOND_REF', 'FIXED_PIPS', 'ATR_MULTIPLE'] as const).map((t) => (
              <option key={t} value={t}>
                {b.stopTypes[t]}
              </option>
            ))}
          </select>
        </label>
        {spec.stop.type === 'BEYOND_REF' && (
          <>
            {refSelect(b.ref, spec.stop.ref, (ref) =>
              patch({ stop: { ...spec.stop, ref } as StrategySpec['stop'] }),
            )}
            {numField(
              b.buffer,
              spec.stop.bufferPips,
              (n) => patch({ stop: { ...spec.stop, bufferPips: n } as StrategySpec['stop'] }),
              0.1,
            )}
          </>
        )}
        {spec.stop.type === 'FIXED_PIPS' &&
          numField(
            b.pips,
            spec.stop.pips,
            (n) => patch({ stop: { type: 'FIXED_PIPS', pips: n } }),
            0.1,
          )}
        {spec.stop.type === 'ATR_MULTIPLE' && (
          <>
            {numField(b.atrPeriod, spec.stop.period, (period) =>
              patch({ stop: { ...spec.stop, period } as StrategySpec['stop'] }),
            )}
            {numField(
              b.atrMult,
              spec.stop.mult,
              (mult) => patch({ stop: { ...spec.stop, mult } as StrategySpec['stop'] }),
              0.1,
            )}
          </>
        )}
      </fieldset>

      <fieldset>
        <legend>
          <Term id={TERMS.r}>{b.target}</Term>
        </legend>
        <label className="inline-field">
          <span>{b.target}</span>
          <select
            value={spec.target.type}
            onChange={(e) => {
              const t = e.target.value;
              patch({
                target:
                  t === 'R_MULTIPLE'
                    ? { type: 'R_MULTIPLE', r: 2 }
                    : t === 'FIXED_PIPS'
                      ? { type: 'FIXED_PIPS', pips: 20 }
                      : { type: 'AT_REF', ref: refs[0] ?? '', bufferPips: 0 },
              });
            }}
          >
            {(['R_MULTIPLE', 'FIXED_PIPS', 'AT_REF'] as const).map((t) => (
              <option key={t} value={t}>
                {b.targetTypes[t]}
              </option>
            ))}
          </select>
        </label>
        {spec.target.type === 'R_MULTIPLE' &&
          numField(b.r, spec.target.r, (r) => patch({ target: { type: 'R_MULTIPLE', r } }), 0.1)}
        {spec.target.type === 'FIXED_PIPS' &&
          numField(
            b.pips,
            spec.target.pips,
            (pips) => patch({ target: { type: 'FIXED_PIPS', pips } }),
            0.1,
          )}
        {spec.target.type === 'AT_REF' && (
          <>
            {refSelect(b.ref, spec.target.ref, (ref) =>
              patch({ target: { ...spec.target, ref } as StrategySpec['target'] }),
            )}
            {numField(
              b.buffer,
              spec.target.bufferPips,
              (n) => patch({ target: { ...spec.target, bufferPips: n } as StrategySpec['target'] }),
              0.1,
            )}
          </>
        )}
      </fieldset>

      <fieldset>
        <legend>{b.trendFilter}</legend>
        <label className="check">
          <input
            type="checkbox"
            checked={spec.trendFilter !== undefined}
            onChange={(e) =>
              patch({ trendFilter: e.target.checked ? { fast: 50, slow: 200 } : undefined })
            }
          />
          <span>{b.trendFilterOn}</span>
        </label>
        {spec.trendFilter && (
          <div className="builder-grid">
            {numField(b.trendFilterFast, spec.trendFilter.fast, (fast) =>
              patch({ trendFilter: { ...spec.trendFilter!, fast } }),
            )}
            {numField(b.trendFilterSlow, spec.trendFilter.slow, (slow) =>
              patch({ trendFilter: { ...spec.trendFilter!, slow } }),
            )}
          </div>
        )}
      </fieldset>

      <fieldset>
        <legend>
          <Term id={TERMS.lotRisk}>{b.risk}</Term>
        </legend>
        {numField(
          b.risk,
          spec.risk.percentPerTrade,
          (n) => patch({ risk: { percentPerTrade: n } }),
          0.1,
        )}
        <label className="inline-field">
          <span>{b.maxPerDay}</span>
          <input
            type="number"
            min={1}
            value={spec.maxTradesPerDay ?? ''}
            onChange={(e) =>
              patch({ maxTradesPerDay: e.target.value.trim() === '' ? null : num(e.target.value) })
            }
          />
        </label>
      </fieldset>

      <details>
        <summary>{b.params}</summary>
        <div className="stack">
          {numField(b.swingLeft, spec.features.swing.left, (left) =>
            patch({ features: { ...spec.features, swing: { ...spec.features.swing, left } } }),
          )}
          {numField(b.swingRight, spec.features.swing.right, (right) =>
            patch({ features: { ...spec.features, swing: { ...spec.features.swing, right } } }),
          )}
          {numField(
            b.fvgMin,
            spec.features.fvg.minSizePips,
            (minSizePips) => patch({ features: { ...spec.features, fvg: { minSizePips } } }),
            0.1,
          )}
          <label className="inline-field">
            <span>{b.breakBy}</span>
            <select
              value={spec.features.structure.breakBy}
              onChange={(e) =>
                patch({
                  features: {
                    ...spec.features,
                    structure: { breakBy: e.target.value as 'CLOSE' | 'WICK' },
                  },
                })
              }
            >
              <option value="CLOSE">{b.breakByOptions.CLOSE}</option>
              <option value="WICK">{b.breakByOptions.WICK}</option>
            </select>
          </label>
          {numField(b.sweepAge, spec.features.sweep.swingMaxAgeBars, (swingMaxAgeBars) =>
            patch({ features: { ...spec.features, sweep: { swingMaxAgeBars } } }),
          )}
        </div>
      </details>

      {problems.length > 0 && (
        <div className="warn-box" role="alert">
          <strong>{b.problems}</strong>
          <ul>
            {problems.map((p) => (
              <li key={`${p.code}@${p.path}`}>
                {tr.strategy.problems[p.code]} <span className="mono">({p.path})</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {warnings.length > 0 && (
        <div className="warn-box">
          <strong>{b.warnings}</strong>
          <ul>
            {warnings.map((w) => (
              <li key={w.path}>
                {tr.strategy.warnings[w.code]} <span className="mono">({w.path})</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <label className="stack">
        <span>{tr.strategy.changeNote}</span>
        <input type="text" value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <p className="hint">{tr.strategy.immutable}</p>
      <div className="field-row">
        <button type="submit" className="btn btn-primary" disabled={!canSave}>
          {tr.strategy.save}
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          {tr.strategy.cancel}
        </button>
      </div>
    </form>
  );
}
