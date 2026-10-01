import { useCallback, useEffect, useMemo, useState, type ComponentType } from 'react';
import {
  compareTimeframes,
  getInstrument,
  type Anchor,
  type DataSetMeta,
  type DrawingKind,
  type Timeframe,
} from '@trw/engine';
import { ChartView } from './chart/ChartView';
import type { ChartViewProps } from './chart/types';
import type { Tool } from './chart/use-drawing-layer';
import { EmptyState } from './components/EmptyState';
import type { CandleSource, ChartData } from './compute/candle-source';
import { DrawingPanel } from './features/drawings/DrawingPanel';
import { DrawingTools } from './features/drawings/DrawingTools';
import { LevelsPanel } from './features/drawings/LevelsPanel';
import { useDrawings } from './features/drawings/use-drawings';
import { ImportWizard } from './features/import/ImportWizard';
import { Toolbar } from './features/workspace/Toolbar';
import { tr } from './i18n/tr';
import type { Importer } from './import/importer';
import type { Prefs, PrefsRepo } from './storage/db-user';
import type { DrawingsRepo } from './storage/drawings-repo';
import type { MarketRepo } from './storage/market-repo';

export interface AppProps {
  repo: MarketRepo;
  prefs: PrefsRepo;
  drawingsRepo: DrawingsRepo;
  createImporter: () => Importer;
  candleSource: CandleSource;
  ChartComponent?: ComponentType<ChartViewProps>;
  /** App clock and id source; injectable for tests (the engine itself never reads the clock). */
  now?: () => number;
  newId?: () => string;
}

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);

export function App({
  repo,
  prefs,
  drawingsRepo,
  createImporter,
  candleSource,
  ChartComponent = ChartView,
  now = Date.now,
  newId = () => crypto.randomUUID(),
}: AppProps) {
  const [datasets, setDatasets] = useState<DataSetMeta[] | null>(null);
  const [settings, setSettings] = useState<Prefs | null>(null);
  const [importing, setImporting] = useState(false);
  // Kept while the next timeframe loads so the chart (and its visible range) is not remounted.
  const [data, setData] = useState<(ChartData & { tf: Timeframe }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>('SELECT');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [list, p] = await Promise.all([repo.listDatasets(), prefs.load()]);
    setDatasets(list);
    setSettings(p);
  }, [repo, prefs]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const active = datasets?.find((d) => d.id === settings?.datasetId) ?? datasets?.[0] ?? null;
  const instrument = useMemo(() => (active ? getInstrument(active.instrument) : null), [active]);
  // Never show a timeframe finer than the stored base data.
  const timeframe =
    active && settings && compareTimeframes(settings.timeframe, active.baseTimeframe) >= 0
      ? settings.timeframe
      : (active?.baseTimeframe ?? settings?.timeframe ?? '15m');

  const store = useDrawings(drawingsRepo, active?.instrument ?? null, now);
  const selected = store.drawings.find((d) => d.id === selectedId) ?? null;

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    setError(null);
    candleSource
      .load(active, timeframe)
      .then((d) => !cancelled && setData({ ...d, tf: timeframe }))
      .catch((e: unknown) => !cancelled && setError(String(e)));
    return () => {
      cancelled = true;
    };
    // The dataset is identified by id + content hash; the object itself is re-created on refresh.
  }, [candleSource, active?.id, active?.contentHash, timeframe]);

  // Keyboard: Delete removes the selected drawing, Escape cancels the tool / selection.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        void store.deleteDrawing(selectedId);
        setSelectedId(null);
      } else if (e.key === 'Escape') {
        setTool('SELECT');
        setSelectedId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, store]);

  const update = (patch: Partial<Prefs>) => {
    setSettings((s) => (s ? { ...s, ...patch } : s));
    void prefs.save(patch);
  };

  const onSaved = async (meta: DataSetMeta) => {
    setImporting(false);
    await prefs.save({ datasetId: meta.id });
    await refresh();
  };

  const onDrawn = (kind: DrawingKind, anchors: Anchor[]) => {
    if (!active) return;
    const at = now();
    const id = newId();
    void store.saveDrawing(
      {
        id,
        source: 'USER',
        kind,
        instrument: active.instrument,
        createdOnTimeframe: timeframe,
        anchors,
        style: {},
        locked: false,
        hidden: false,
        createdAt: at,
        updatedAt: at,
      },
      true,
    );
    setSelectedId(id);
    setTool('SELECT');
  };

  const lastClose = data?.candles[data.candles.length - 1]?.c ?? null;

  return (
    <div className="app">
      <header className="app-header">
        <h1>{tr.app.title}</h1>
        {active && settings && datasets && (
          <Toolbar
            datasets={datasets}
            active={active}
            timeframe={timeframe}
            displayTz={settings.displayTz}
            onDataset={(id) => {
              setSelectedId(null);
              update({ datasetId: id });
            }}
            onTimeframe={(tf) => update({ timeframe: tf })}
            onDisplayTz={(tz) => update({ displayTz: tz })}
            visibleSessions={settings.sessions}
            onToggleSession={(id) =>
              update({
                sessions: settings.sessions.includes(id)
                  ? settings.sessions.filter((s) => s !== id)
                  : [...settings.sessions, id],
              })
            }
            onImport={() => setImporting(true)}
          />
        )}
      </header>

      <main className="app-main">
        {datasets === null && <p className="muted">{tr.app.loading}</p>}
        {datasets?.length === 0 && <EmptyState onImport={() => setImporting(true)} />}
        {error && (
          <p className="blocker" role="alert">
            {tr.app.loadError}: {error}
          </p>
        )}
        {active && settings && data && instrument && (
          <>
            <DrawingTools tool={tool} onTool={setTool} />
            <div className="workspace">
              <ChartComponent
                candles={data.candles}
                sessions={data.sessions.filter((s) => settings.sessions.includes(s.sessionId))}
                instrument={instrument}
                timeframe={data.tf}
                displayTz={settings.displayTz}
                drawings={store.drawings}
                levels={store.levels}
                selectedId={selectedId}
                tool={tool}
                onDrawn={onDrawn}
                onSelect={setSelectedId}
                onChange={(d) => void store.saveDrawing(d)}
              />
              <aside className="side">
                {selected ? (
                  <DrawingPanel
                    drawing={selected}
                    level={store.levels.find((l) => l.drawingId === selected.id)}
                    instrument={instrument}
                    timeframe={timeframe}
                    displayTz={settings.displayTz}
                    lastClose={lastClose}
                    now={now}
                    newId={newId}
                    onSave={(d) => void store.saveDrawing(d)}
                    onDelete={(id) => {
                      void store.deleteDrawing(id);
                      setSelectedId(null);
                    }}
                    onSaveLevel={(l) => void store.saveLevel(l)}
                    onDeleteLevel={(id) => void store.deleteLevel(id)}
                  />
                ) : (
                  <p className="hint panel">{tr.drawings.noSelection}</p>
                )}
                <LevelsPanel
                  levels={store.levels}
                  drawings={store.drawings}
                  instrument={instrument}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                />
              </aside>
            </div>
          </>
        )}
      </main>

      {importing && (
        <div className="overlay">
          <ImportWizard
            createImporter={createImporter}
            save={(meta, series) => repo.saveDataset(meta, series)}
            onSaved={(meta) => void onSaved(meta)}
            onClose={() => setImporting(false)}
          />
        </div>
      )}
    </div>
  );
}
