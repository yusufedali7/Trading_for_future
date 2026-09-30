import {
  TIMEFRAMES,
  compareTimeframes,
  type DataSetMeta,
  type IanaTz,
  type Timeframe,
} from '@trw/engine';
import { formatTime } from '../../format';
import { tr } from '../../i18n/tr';

export interface ToolbarProps {
  datasets: readonly DataSetMeta[];
  active: DataSetMeta;
  timeframe: Timeframe;
  displayTz: IanaTz;
  onDataset: (id: string) => void;
  onTimeframe: (tf: Timeframe) => void;
  onDisplayTz: (tz: IanaTz) => void;
  onImport: () => void;
}

export function Toolbar(p: ToolbarProps) {
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

      <span className="spacer" />
      <button type="button" className="btn" onClick={p.onImport}>
        {tr.toolbar.importButton}
      </button>
    </div>
  );
}
