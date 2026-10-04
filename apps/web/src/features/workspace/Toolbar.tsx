import {
  BUILTIN_SESSIONS,
  TIMEFRAMES,
  compareTimeframes,
  type DataSetMeta,
  type IanaTz,
  type Timeframe,
} from '@trw/engine';
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

      <span className="spacer" />
      <button type="button" className="btn" onClick={p.onImport}>
        {tr.toolbar.importButton}
      </button>
    </div>
  );
}
