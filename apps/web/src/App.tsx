import { useCallback, useEffect, useMemo, useState, type ComponentType } from 'react';
import {
  compareTimeframes,
  getInstrument,
  timeframeMs,
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
import { ReplayBar } from './features/replay/ReplayBar';
import { useReplay } from './features/replay/use-replay';
import { TradePanel } from './features/trade/TradePanel';
import { tradeLinesFor } from './features/trade/trade-lines';
import { useReplayTrade } from './features/trade/use-replay-trade';
import { Toolbar } from './features/workspace/Toolbar';
import { tr } from './i18n/tr';
import type { Importer } from './import/importer';
import type { Prefs, PrefsRepo } from './storage/db-user';
import type { DrawingsRepo } from './storage/drawings-repo';
import type { JournalRepo } from './storage/journal-repo';
import type { MarketRepo } from './storage/market-repo';

export interface AppProps {
  repo: MarketRepo;
  prefs: PrefsRepo;
  drawingsRepo: DrawingsRepo;
  journalRepo: JournalRepo;
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
  journalRepo,
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

  const replay = useReplay(candleSource, active, data, settings?.displayTz ?? 'Europe/Istanbul');
  const inReplay = replay.cursor !== null;
  // In replay the chart only gets data as known at the cursor (rule 3).
  const chartData = inReplay ? replay.view : data;
  // Drawings placed after the cursor would leak hindsight into the replay: hide them.
  const visibleDrawings = inReplay
    ? store.drawings.filter((d) => Math.min(...d.anchors.map((a) => a.t)) < replay.cursor!)
    : store.drawings;

  const trading = useReplayTrade({
    source: candleSource,
    repo: journalRepo,
    active,
    timeframe,
    cursor: replay.cursor,
    now,
    newId,
  });
  // Same lines → same array, so the chart does not redraw them on every replay step.
  const lines = tradeLinesFor(inReplay ? trading.trade : null);
  const linesKey = JSON.stringify(lines);
  const tradeLines = useMemo(() => lines, [linesKey]);

  // A different dataset ends the replay.
  const activeId = active?.id;
  const exitReplay = replay.exit;
  useEffect(() => {
    exitReplay();
    // exitReplay only resets state; run when the dataset changes.
  }, [activeId]);

  // Keyboard: Delete removes the selected drawing, Escape cancels the tool / selection,
  // arrows and space drive the replay.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      if (inReplay && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
        e.preventDefault();
        // An open trade or pending order may not see the cursor go back (it was decided later).
        if (e.key === 'ArrowRight' || !trading.busy) replay.step(e.key === 'ArrowRight' ? 1 : -1);
      } else if (inReplay && e.key === ' ') {
        e.preventDefault();
        replay.togglePlay();
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        void store.deleteDrawing(selectedId);
        setSelectedId(null);
      } else if (e.key === 'Escape') {
        setTool('SELECT');
        setSelectedId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, store, inReplay, replay, trading.busy]);

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

  const lastClose = chartData?.candles[chartData.candles.length - 1]?.c ?? null;

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
            <div className="tool-row">
              <DrawingTools tool={tool} onTool={setTool} />
              <ReplayBar
                cursor={replay.cursor}
                displayTz={settings.displayTz}
                playing={replay.playing}
                speedMs={replay.speedMs}
                atEnd={replay.atEnd}
                busy={trading.busy}
                onStart={replay.start}
                onStep={replay.step}
                onTogglePlay={replay.togglePlay}
                onSpeed={replay.setSpeed}
                onExit={replay.exit}
              />
            </div>
            <div className="workspace">
              {chartData ? (
                <ChartComponent
                  candles={chartData.candles}
                  sessions={chartData.sessions.filter((s) =>
                    settings.sessions.includes(s.sessionId),
                  )}
                  instrument={instrument}
                  timeframe={data.tf}
                  displayTz={settings.displayTz}
                  followLatest={inReplay}
                  tradeLines={tradeLines}
                  drawings={visibleDrawings}
                  levels={store.levels}
                  selectedId={selectedId}
                  tool={tool}
                  onDrawn={onDrawn}
                  onSelect={setSelectedId}
                  onChange={(d) => void store.saveDrawing(d)}
                />
              ) : (
                <p className="muted chart-wrap">{tr.app.loading}</p>
              )}
              <aside className="side">
                <TradePanel
                  instrument={instrument}
                  displayTz={settings.displayTz}
                  cursor={replay.cursor}
                  lastClose={inReplay ? lastClose : null}
                  baseMs={timeframeMs(active.baseTimeframe)}
                  trade={trading.trade}
                  onPlace={trading.place}
                  onClose={trading.close}
                  onDismiss={trading.dismiss}
                />
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
