import {
  BUILTIN_SESSIONS,
  TIMEFRAMES,
  compareTimeframes,
  type DataSetMeta,
  type IanaTz,
  type Timeframe,
} from '@trw/engine';
import {
  activeIndicatorCount,
  type IndicatorSettings,
  type Oscillator,
} from '../../chart/indicator-settings';
import { FEATURE_LAYERS, type FeatureLayer } from '../../chart/primitives/feature-layout';
import { SESSION_COLORS } from '../../chart/theme';
import { formatTime } from '../../format';
import { tr } from '../../i18n/tr';
import type { UserSession } from '../../storage/sessions-repo';

export interface ToolbarProps {
  datasets: readonly DataSetMeta[];
  active: DataSetMeta;
  timeframe: Timeframe;
  displayTz: IanaTz;
  onDataset: (id: string) => void;
  onTimeframe: (tf: Timeframe) => void;
  onDisplayTz: (tz: IanaTz) => void;
  userSessions: readonly UserSession[];
  onManageSessions: () => void;
  visibleSessions: readonly string[];
  onToggleSession: (id: string) => void;
  visibleFeatures: readonly FeatureLayer[];
  onToggleFeature: (layer: FeatureLayer) => void;
  indicators: IndicatorSettings;
  onIndicators: (next: IndicatorSettings) => void;
  onImport: () => void;
}

export function Toolbar(p: ToolbarProps) {
  const colors: Record<string, string | undefined> = {
    ...SESSION_COLORS,
    ...Object.fromEntries(p.userSessions.map((s) => [s.id, s.color])),
  };
  const available = TIMEFRAMES.filter((tf) => compareTimeframes(tf, p.active.baseTimeframe) >= 0);
  return (
    <div className="toolbar" role="toolbar" aria-label="Grafik araçları">
      <label className="field">
        <span>{tr.toolbar.dataset}</span>
        <select value={p.active.id} onChange={(e) => p.onDataset(e.target.value)}>
          {p.datasets.map((d) => (
            <option key={d.id} value={d.id}>
              {tr.toolbar.datasetOption(
                d.instrument,
                d.source.name,
                formatTime(d.range.from).slice(0, 10),
                formatTime(d.range.to).slice(0, 10),
              )}
            </option>
          ))}
        </select>
      </label>

      <div className="segmented" role="group" aria-label={tr.toolbar.timeframe}>
        {available.map((tf) => (
          <button
            key={tf}
            type="button"
            className="seg"
            aria-pressed={tf === p.timeframe}
            onClick={() => p.onTimeframe(tf)}
          >
            {tf}
          </button>
        ))}
      </div>

      <label className="field">
        <span>{tr.toolbar.displayTz}</span>
        <select value={p.displayTz} onChange={(e) => p.onDisplayTz(e.target.value)}>
          {tr.displayTimezones.map((z) => (
            <option key={z.value} value={z.value}>
              {z.label}
            </option>
          ))}
        </select>
      </label>

      <details className="toolbar-group">
        <summary className="btn" role="button">
          {tr.toolbar.sessionsGroup(p.visibleSessions.length)}
        </summary>
        <div className="toolbar-group-panel">
          <div className="segmented" role="group" aria-label={tr.toolbar.sessions}>
            {[...BUILTIN_SESSIONS, ...p.userSessions].map((s) => (
              <button
                key={s.id}
                type="button"
                className="seg seg-session"
                aria-pressed={p.visibleSessions.includes(s.id)}
                onClick={() => p.onToggleSession(s.id)}
              >
                <span className="dot" style={{ background: colors[s.id] }} aria-hidden="true" />
                {s.name}
              </button>
            ))}
          </div>
          <button type="button" className="btn" onClick={p.onManageSessions}>
            {tr.sessions.manage}
          </button>
        </div>
      </details>

      <details className="toolbar-group">
        <summary className="btn" role="button">
          {tr.features.toggleGroup(p.visibleFeatures.length)}
        </summary>
        <div className="toolbar-group-panel">
          <div
            className="segmented"
            role="group"
            aria-label={tr.features.toggle}
            title={tr.features.candidateNote}
          >
            {FEATURE_LAYERS.map((layer) => (
              <button
                key={layer}
                type="button"
                className="seg"
                aria-pressed={p.visibleFeatures.includes(layer)}
                title={tr.features.layerHints[layer]}
                onClick={() => p.onToggleFeature(layer)}
              >
                {tr.features.layers[layer]}
              </button>
            ))}
          </div>
        </div>
      </details>

      <details className="toolbar-group">
        <summary className="btn" role="button">
          {tr.indicators.groupLabel(activeIndicatorCount(p.indicators))}
        </summary>
        <div className="toolbar-group-panel indicator-panel">
          <IndicatorPanel indicators={p.indicators} onChange={p.onIndicators} />
        </div>
      </details>

      <span className="spacer" />
      <button type="button" className="btn" onClick={p.onImport}>
        {tr.toolbar.importButton}
      </button>
    </div>
  );
}

const num = (v: string, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

function IndicatorPanel({
  indicators: i,
  onChange,
}: {
  indicators: IndicatorSettings;
  onChange: (next: IndicatorSettings) => void;
}) {
  const periodField = (value: number, set: (period: number) => void) => (
    <label className="inline-field">
      <span>{tr.indicators.period}</span>
      <input
        type="number"
        min={1}
        value={value}
        onChange={(e) => set(num(e.target.value, value))}
      />
    </label>
  );
  const oscillators: Oscillator[] = ['NONE', 'RSI', 'MACD'];
  const oscillatorLabel: Record<Oscillator, string> = {
    NONE: tr.indicators.oscillatorNone,
    RSI: tr.indicators.rsi,
    MACD: tr.indicators.macd,
  };
  return (
    <>
      <label className="check">
        <input
          type="checkbox"
          checked={i.sma.on}
          onChange={(e) => onChange({ ...i, sma: { ...i.sma, on: e.target.checked } })}
        />
        <span>{tr.indicators.sma}</span>
      </label>
      {i.sma.on &&
        periodField(i.sma.period, (period) => onChange({ ...i, sma: { ...i.sma, period } }))}

      <label className="check">
        <input
          type="checkbox"
          checked={i.ema.on}
          onChange={(e) => onChange({ ...i, ema: { ...i.ema, on: e.target.checked } })}
        />
        <span>{tr.indicators.ema}</span>
      </label>
      {i.ema.on &&
        periodField(i.ema.period, (period) => onChange({ ...i, ema: { ...i.ema, period } }))}

      <label className="check">
        <input
          type="checkbox"
          checked={i.bollinger.on}
          onChange={(e) => onChange({ ...i, bollinger: { ...i.bollinger, on: e.target.checked } })}
        />
        <span>{tr.indicators.bollinger}</span>
      </label>
      {i.bollinger.on && (
        <div className="field-row">
          {periodField(i.bollinger.period, (period) =>
            onChange({ ...i, bollinger: { ...i.bollinger, period } }),
          )}
          <label className="inline-field">
            <span>{tr.indicators.k}</span>
            <input
              type="number"
              min={0.1}
              step={0.1}
              value={i.bollinger.k}
              onChange={(e) =>
                onChange({
                  ...i,
                  bollinger: { ...i.bollinger, k: num(e.target.value, i.bollinger.k) },
                })
              }
            />
          </label>
        </div>
      )}

      <label className="check">
        <input
          type="checkbox"
          checked={i.vwap.on}
          onChange={(e) => onChange({ ...i, vwap: { on: e.target.checked } })}
        />
        <span>{tr.indicators.vwap}</span>
      </label>
      {i.vwap.on && <p className="hint">{tr.indicators.vwapNote}</p>}

      <div className="field-row wrap" role="radiogroup" aria-label={tr.indicators.oscillator}>
        <span>{tr.indicators.oscillator}</span>
        {oscillators.map((o) => (
          <label key={o} className="inline-field">
            <input
              type="radio"
              name="oscillator"
              checked={i.oscillator === o}
              onChange={() => onChange({ ...i, oscillator: o })}
            />
            <span>{oscillatorLabel[o]}</span>
          </label>
        ))}
      </div>
      {i.oscillator === 'RSI' &&
        periodField(i.rsi.period, (period) => onChange({ ...i, rsi: { period } }))}
      {i.oscillator === 'MACD' && (
        <div className="field-row">
          <label className="inline-field">
            <span>{tr.indicators.fast}</span>
            <input
              type="number"
              min={1}
              value={i.macd.fast}
              onChange={(e) =>
                onChange({ ...i, macd: { ...i.macd, fast: num(e.target.value, i.macd.fast) } })
              }
            />
          </label>
          <label className="inline-field">
            <span>{tr.indicators.slow}</span>
            <input
              type="number"
              min={1}
              value={i.macd.slow}
              onChange={(e) =>
                onChange({ ...i, macd: { ...i.macd, slow: num(e.target.value, i.macd.slow) } })
              }
            />
          </label>
          <label className="inline-field">
            <span>{tr.indicators.signal}</span>
            <input
              type="number"
              min={1}
              value={i.macd.signal}
              onChange={(e) =>
                onChange({ ...i, macd: { ...i.macd, signal: num(e.target.value, i.macd.signal) } })
              }
            />
          </label>
        </div>
      )}
    </>
  );
}
