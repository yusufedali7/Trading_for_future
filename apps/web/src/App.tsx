import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import {
  allSessionDefs,
  compareTimeframes,
  getInstrument,
  timeframeMs,
  type Anchor,
  type DataSetMeta,
  type DrawingKind,
  type Setup,
  type Strategy,
  type StrategyVersion,
  type Timeframe,
} from '@trw/engine';
import { ChartView } from './chart/ChartView';
import type { ChartScreenshot, ChartViewProps } from './chart/types';
import type { Tool } from './chart/use-drawing-layer';
import { EmptyState } from './components/EmptyState';
import type { CandleSource, ChartData } from './compute/candle-source';
import { DrawingPanel } from './features/drawings/DrawingPanel';
import { DrawingTools } from './features/drawings/DrawingTools';
import { LevelsPanel } from './features/drawings/LevelsPanel';
import { useDrawings } from './features/drawings/use-drawings';
import { ImportWizard } from './features/import/ImportWizard';
import { JournalForm } from './features/journal/JournalForm';
import { JournalPage } from './features/journal/JournalPage';
import { draftFromTrade, noTradeDraft, useJournalForm } from './features/journal/use-journal-form';
import { ReplayBar } from './features/replay/ReplayBar';
import { useReplay } from './features/replay/use-replay';
import { TradePanel } from './features/trade/TradePanel';
import { tradeLinesFor } from './features/trade/trade-lines';
import { isFinal, useReplayTrade } from './features/trade/use-replay-trade';
import { Toolbar } from './features/workspace/Toolbar';
import { tr } from './i18n/tr';
import type { Importer } from './import/importer';
import type { Prefs, PrefsRepo } from './storage/db-user';
import type { DrawingsRepo } from './storage/drawings-repo';
import type { JournalRepo } from './storage/journal-repo';
import type { MarketRepo } from './storage/market-repo';
import {
  createMemoryResearchRepo,
  createMemoryStrategyRepo,
  type ResearchRepo,
  type StrategyRepo,
} from './storage/strategy-repo';
import { StrategyPage } from './features/strategy/StrategyPage';
import { ResearchPage } from './features/research/ResearchPage';
import { SessionManager } from './features/sessions/SessionManager';
import {
  createMemorySessionsRepo,
  toDefinition,
  type SessionsRepo,
  type UserSession,
} from './storage/sessions-repo';

export interface AppProps {
  repo: MarketRepo;
  prefs: PrefsRepo;
  drawingsRepo: DrawingsRepo;
  journalRepo: JournalRepo;
  createImporter: () => Importer;
  candleSource: CandleSource;
  /** Strategy and research stores (M5); in-memory when not given (tests). */
  strategyRepo?: StrategyRepo;
  researchRepo?: ResearchRepo;
  /** The user's own sessions (M6.1); in-memory when not given (tests). */
  sessionsRepo?: SessionsRepo;
  ChartComponent?: ComponentType<ChartViewProps>;
  /** App clock and id source; injectable for tests (the engine itself never reads the clock). */
  now?: () => number;
  newId?: () => string;
}

type View = 'CHART' | 'JOURNAL' | 'STRATEGY' | 'RESEARCH';
const VIEWS: readonly View[] = ['CHART', 'JOURNAL', 'STRATEGY', 'RESEARCH'];

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);

export function App({
  repo,
  prefs,
  drawingsRepo,
  journalRepo,
  createImporter,
  candleSource,
  strategyRepo: givenStrategies,
  researchRepo: givenResearch,
  sessionsRepo: givenSessions,
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
  const [view, setView] = useState<View>('CHART');
  const [strategyRepo] = useState(() => givenStrategies ?? createMemoryStrategyRepo());
  const [researchRepo] = useState(() => givenResearch ?? createMemoryResearchRepo());
  const [sessionsRepo] = useState(() => givenSessions ?? createMemorySessionsRepo());
  const [userSessions, setUserSessions] = useState<UserSession[]>([]);
  const [managingSessions, setManagingSessions] = useState(false);
  useEffect(() => {
    void sessionsRepo.list().then(setUserSessions);
  }, [sessionsRepo]);
  // Definitions only, stable while the sessions do not change (they key worker caches).
  const sessionDefsKey = JSON.stringify(userSessions.map(toDefinition));
  const sessionDefs = useMemo(() => userSessions.map(toDefinition), [sessionDefsKey]);
  const allDefs = useMemo(() => allSessionDefs(sessionDefs), [sessionDefs]);
  const sessionNames = useMemo(
    () => Object.fromEntries(userSessions.map((s) => [s.id, s.name])),
    [userSessions],
  );
  const sessionStyles = useMemo(
    () => Object.fromEntries(userSessions.map((s) => [s.id, { name: s.name, color: s.color }])),
    [userSessions],
  );
  // Setups of a strategy version shown on the chart (M5).
  const [chartStrategy, setChartStrategy] = useState<{
    name: string;
    version: number;
    instrument: string;
    long: boolean;
    setups: Setup[];
  } | null>(null);

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
      .load(active, timeframe, sessionDefs)
      .then((d) => !cancelled && setData({ ...d, tf: timeframe }))
      .catch((e: unknown) => !cancelled && setError(String(e)));
    return () => {
      cancelled = true;
    };
    // The dataset is identified by id + content hash; the object itself is re-created on refresh.
  }, [candleSource, active?.id, active?.contentHash, timeframe, sessionDefs]);

  const replay = useReplay(
    candleSource,
    active,
    data,
    settings?.displayTz ?? 'Europe/Istanbul',
    sessionDefs,
  );
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

  // Strategy setups on the chart; in replay only those known at the cursor.
  const cursor = replay.cursor;
  const shownStrategy =
    chartStrategy && chartStrategy.instrument === active?.instrument ? chartStrategy : null;
  const setupMarks = useMemo(() => {
    if (!shownStrategy) return null;
    const known = shownStrategy.setups.filter((s) => cursor === null || s.signalAt <= cursor);
    return {
      signalBarsAt: known.map((s) => s.signalBarAt),
      long: shownStrategy.long,
      label: tr.strategyChart.mark,
    };
  }, [shownStrategy, cursor]);

  // Journal: the form opens (and autoplay pauses) once when a trade settles.
  const screenshotRef = useRef<ChartScreenshot | null>(null);
  const journal = useJournalForm(journalRepo, screenshotRef, now, newId);
  const baseMs = active ? timeframeMs(active.baseTimeframe) : 0;
  const promptedRef = useRef(new Set<string>());
  const settled = trading.trade && isFinal(trading.trade.result.status) ? trading.trade : null;
  const pauseReplay = replay.pause;
  const openJournal = journal.open;
  useEffect(() => {
    if (!settled || !instrument || settled.journalId || promptedRef.current.has(settled.id)) return;
    promptedRef.current.add(settled.id);
    pauseReplay();
    openJournal(draftFromTrade(settled, instrument, baseMs, allDefs));
    // Runs once per settled trade.
  }, [settled?.id]);

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
      if (isTyping(e.target) || journal.draft || view !== 'CHART') return;
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
  }, [selectedId, store, inReplay, replay, trading.busy, journal.draft, view]);

  const update = (patch: Partial<Prefs>) => {
    setSettings((s) => (s ? { ...s, ...patch } : s));
    void prefs.save(patch);
  };

  const onSaved = async (meta: DataSetMeta) => {
    setImporting(false);
    await prefs.save({ datasetId: meta.id });
    await refresh();
  };

  const showOnChart = async (s: Strategy, v: StrategyVersion) => {
    const meta =
      active?.instrument === v.spec.instrument
        ? active
        : datasets?.find((d) => d.instrument === v.spec.instrument);
    if (!meta) {
      setError(tr.strategyChart.noData);
      return;
    }
    if (meta.id !== active?.id) update({ datasetId: meta.id, timeframe: v.spec.timeframe });
    else update({ timeframe: v.spec.timeframe });
    const setups = await candleSource.setups(meta, v.spec);
    setChartStrategy({
      name: s.name,
      version: v.version,
      instrument: v.spec.instrument,
      long: v.spec.direction === 'LONG',
      setups,
    });
    setView('CHART');
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
        {datasets && datasets.length > 0 && (
          <div className="segmented" role="group" aria-label={tr.journalPage.navLabel}>
            {VIEWS.map((v) => (
              <button
                key={v}
                type="button"
                className="seg"
                aria-pressed={view === v}
                onClick={() => {
                  replay.pause();
                  setView(v);
                }}
              >
                {tr.journalPage.nav[v]}
              </button>
            ))}
          </div>
        )}
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
            userSessions={userSessions}
            onManageSessions={() => setManagingSessions(true)}
            visibleSessions={settings.sessions}
            onToggleSession={(id) =>
              update({
                sessions: settings.sessions.includes(id)
                  ? settings.sessions.filter((s) => s !== id)
                  : [...settings.sessions, id],
              })
            }
            visibleFeatures={settings.features}
            onToggleFeature={(layer) =>
              update({
                features: settings.features.includes(layer)
                  ? settings.features.filter((l) => l !== layer)
                  : [...settings.features, layer],
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
        {view === 'JOURNAL' && settings && (
          <JournalPage
            repo={journalRepo}
            displayTz={settings.displayTz}
            sessionNames={sessionNames}
          />
        )}
        {view === 'RESEARCH' && settings && datasets && (
          <ResearchPage
            research={researchRepo}
            strategies={strategyRepo}
            source={candleSource}
            datasets={datasets}
            displayTz={settings.displayTz}
            now={now}
            newId={newId}
          />
        )}
        {view === 'STRATEGY' && settings && datasets && (
          <StrategyPage
            strategies={strategyRepo}
            research={researchRepo}
            source={candleSource}
            datasets={datasets}
            defaultInstrument={active?.instrument ?? 'EURUSD'}
            displayTz={settings.displayTz}
            now={now}
            newId={newId}
            onShowOnChart={(s, v) => void showOnChart(s, v)}
            userSessions={userSessions}
          />
        )}
        {view === 'CHART' && active && settings && data && instrument && (
          <>
            <div className="tool-row">
              <DrawingTools tool={tool} onTool={setTool} />
              {shownStrategy && (
                <div className="strategy-badge" role="status">
                  <span>
                    {tr.strategyChart.badge(
                      shownStrategy.name,
                      shownStrategy.version,
                      setupMarks?.signalBarsAt.length ?? 0,
                    )}
                  </span>
                  <button type="button" className="btn" onClick={() => setChartStrategy(null)}>
                    {tr.strategyChart.hide}
                  </button>
                </div>
              )}
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
                  sessionStyles={sessionStyles}
                  candles={chartData.candles}
                  sessions={chartData.sessions.filter((s) =>
                    settings.sessions.includes(s.sessionId),
                  )}
                  instrument={instrument}
                  timeframe={data.tf}
                  baseTimeframe={active.baseTimeframe}
                  displayTz={settings.displayTz}
                  followLatest={inReplay}
                  features={chartData.features}
                  featureLayers={settings.features}
                  setups={setupMarks}
                  tradeLines={tradeLines}
                  screenshotRef={screenshotRef}
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
                  onNoTrade={() => {
                    if (replay.cursor === null) return;
                    replay.pause();
                    journal.open(noTradeDraft(instrument, replay.cursor, timeframe, allDefs));
                  }}
                  onWriteJournal={() =>
                    settled && journal.open(draftFromTrade(settled, instrument, baseMs, allDefs))
                  }
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

      {journal.draft && settings && (
        <div className="overlay">
          <JournalForm
            key={`${journal.draft.tradeId ?? 'none'}-${journal.draft.decidedAt}`}
            draft={journal.draft}
            displayTz={settings.displayTz}
            sessionNames={sessionNames}
            onSave={async (fields) => {
              const d = journal.draft!;
              const id = await journal.save(d, fields);
              if (d.tradeId && d.tradeId === trading.trade?.id) await trading.attachJournal(id);
            }}
            onSkip={journal.close}
          />
        </div>
      )}

      {managingSessions && (
        <div className="overlay">
          <SessionManager
            sessions={userSessions}
            now={now}
            onSave={(s, isNew) =>
              void sessionsRepo.save(s).then(async () => {
                setUserSessions(await sessionsRepo.list());
                if (isNew && settings && !settings.sessions.includes(s.id))
                  update({ sessions: [...settings.sessions, s.id] });
              })
            }
            onDelete={(id) =>
              void sessionsRepo.delete(id).then(async () => {
                setUserSessions(await sessionsRepo.list());
                if (settings) update({ sessions: settings.sessions.filter((x) => x !== id) });
              })
            }
            onClose={() => setManagingSessions(false)}
          />
        </div>
      )}

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
