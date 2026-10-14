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
import { MAX_EXERCISE_ROUNDS, type Prefs, type PrefsRepo } from './storage/db-user';
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
import { BackupDialog } from './features/backup/BackupDialog';
import type { ShowTarget } from './features/concepts/ConceptsPage';
import { LearnPage, type LearnTab } from './features/learn/LearnPage';
import { LESSONS, nextLesson, type LessonAction } from './content/lessons';
import type { ConceptId } from './content/concepts';
import { GlossaryNav } from './components/Term';
import { EventsPage } from './features/events/EventsPage';
import { SignalsPage } from './features/live/SignalsPage';
import { PaperPage } from './features/paper/PaperPage';
import { createMt5Client, type Mt5Client } from './features/paper/mt5-feed';
import { useMt5Feed } from './features/paper/use-mt5-feed';
import { refreshDrafts } from './features/live/refresh-drafts';
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
  /** Local MT5 bridge client (M6.3); the real bridge when not given. */
  mt5Client?: Mt5Client;
  ChartComponent?: ComponentType<ChartViewProps>;
  /** App clock and id source; injectable for tests (the engine itself never reads the clock). */
  now?: () => number;
  newId?: () => string;
}

type View =
  'CHART' | 'LEARN' | 'JOURNAL' | 'STRATEGY' | 'RESEARCH' | 'PAPER' | 'EVENTS' | 'SIGNALS';
const VIEWS: readonly View[] = [
  'CHART',
  'LEARN',
  'JOURNAL',
  'STRATEGY',
  'RESEARCH',
  'PAPER',
  'EVENTS',
  'SIGNALS',
];

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
  mt5Client: givenMt5,
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
  // Drawing toolbar switches (this session only).
  const [magnet, setMagnet] = useState(false);
  const [keepDrawing, setKeepDrawing] = useState(false);
  const [lockAll, setLockAll] = useState(false);
  const [hideAll, setHideAll] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<View>('CHART');
  const [learnTab, setLearnTab] = useState<LearnTab>('PATH');
  const [glossaryFocus, setGlossaryFocus] = useState<string | null>(null);
  const [lessonId, setLessonId] = useState<string | null>(null);
  const [conceptFocus, setConceptFocus] = useState<ConceptId | null>(null);
  // Concept library: a moment to bring into view on the chart.
  const [focus, setFocus] = useState<{ at: number; seq: number } | null>(null);
  const [strategyRepo] = useState(() => givenStrategies ?? createMemoryStrategyRepo());
  const [researchRepo] = useState(() => givenResearch ?? createMemoryResearchRepo());
  const [sessionsRepo] = useState(() => givenSessions ?? createMemorySessionsRepo());
  const backupRepos = useMemo(
    () => ({
      prefs,
      drawings: drawingsRepo,
      journal: journalRepo,
      sessions: sessionsRepo,
      strategies: strategyRepo,
      research: researchRepo,
    }),
    [prefs, drawingsRepo, journalRepo, sessionsRepo, strategyRepo, researchRepo],
  );
  const [backupOpen, setBackupOpen] = useState(false);
  // Whether anything worth backing up exists (drives the reminder, rule 10).
  const [hasWork, setHasWork] = useState(false);
  useEffect(() => {
    void Promise.all([
      strategyRepo.listStrategies(),
      journalRepo.listEntries(),
      drawingsRepo.listAll(),
      researchRepo.listPaperSessions(),
    ]).then(([s, j, d, ps]) => setHasWork(s.length + j.length + d.drawings.length + ps.length > 0));
  }, [strategyRepo, journalRepo, drawingsRepo, researchRepo, backupOpen, view]);
  const [mt5Client] = useState(() => givenMt5 ?? createMt5Client());
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

  // A background feed sync must not reload (and overwrite) preferences - only the dataset list,
  // plus (M11, D70) any signal drafts due for the instrument that just synced.
  const paperFeedInstrument = settings?.paperFeed?.instrument;
  const onMt5Synced = useCallback(async () => {
    const list = await repo.listDatasets();
    setDatasets(list);
    if (!paperFeedInstrument) return;
    const meta = list.find((d) => d.instrument === paperFeedInstrument);
    if (!meta) return;
    await refreshDrafts({
      meta,
      strategies: strategyRepo,
      research: researchRepo,
      source: candleSource,
      now,
    });
  }, [repo, paperFeedInstrument, strategyRepo, researchRepo, candleSource, now]);
  const feed = useMt5Feed({
    client: mt5Client,
    repo,
    now,
    config: settings?.paperFeed ?? null,
    onConfig: (paperFeed) => update({ paperFeed }),
    onSynced: onMt5Synced,
  });

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
  const shownDrawings = hideAll
    ? []
    : inReplay
      ? store.drawings.filter((d) => Math.min(...d.anchors.map((a) => a.t)) < replay.cursor!)
      : store.drawings;
  const visibleDrawings = lockAll
    ? shownDrawings.map((d) => ({ ...d, locked: true }))
    : shownDrawings;

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
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z' || e.key === 'y')) {
        e.preventDefault();
        if (e.key === 'y' || e.shiftKey) void store.redo();
        else void store.undo();
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

  const openGlossary = useCallback((id: string) => {
    setGlossaryFocus(id);
    setLearnTab('GLOSSARY');
    setView('LEARN');
  }, []);

  const completedLessons = settings?.learning.completed ?? [];
  const upcoming = nextLesson(completedLessons);

  const openLesson = (id: string | null) => {
    setLessonId(id);
    setLearnTab('PATH');
    setView('LEARN');
  };

  const toggleLesson = (id: string) => {
    if (!settings) return;
    const wasDone = completedLessons.includes(id);
    const completed = wasDone
      ? completedLessons.filter((x) => x !== id)
      : [...completedLessons, id];
    update({ learning: { ...settings.learning, completed } });
    if (!wasDone) setLessonId(nextLesson(completed)?.id ?? id);
  };

  const onLessonAction = (a: LessonAction) => {
    if (!settings) return;
    switch (a.kind) {
      case 'OPEN_GLOSSARY':
        openGlossary(a.term);
        return;
      case 'OPEN_CONCEPT':
        setConceptFocus(a.concept);
        setLearnTab('CONCEPTS');
        return;
      case 'OPEN_CHART_LAYER':
        if (!settings.features.includes(a.layer))
          update({ features: [...settings.features, a.layer] });
        setView('CHART');
        return;
      case 'OPEN_VIEW':
        setView(a.view);
        return;
      case 'OPEN_EXERCISE':
        setLearnTab('EXERCISE');
        return;
    }
  };

  const showConcept = (target: ShowTarget) => {
    if (!settings || trading.busy) return;
    if (inReplay) replay.exit();
    const patch: Partial<Prefs> = {};
    if (target.layer && !settings.features.includes(target.layer))
      patch.features = [...settings.features, target.layer];
    if (target.sessionId && !settings.sessions.includes(target.sessionId))
      patch.sessions = [...settings.sessions, target.sessionId];
    if (Object.keys(patch).length > 0) update(patch);
    setView('CHART');
    setFocus((f) => ({ at: target.at, seq: (f?.seq ?? 0) + 1 }));
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
        ...(kind === 'TEXT' ? { text: tr.drawings.defaultText } : {}),
        locked: false,
        hidden: false,
        createdAt: at,
        updatedAt: at,
      },
      true,
    );
    setSelectedId(id);
    if (!keepDrawing) setTool('SELECT');
  };

  const eraseDrawing = (id: string) => {
    void store.deleteDrawing(id);
    if (selectedId === id) setSelectedId(null);
  };

  const lastClose = chartData?.candles[chartData.candles.length - 1]?.c ?? null;

  return (
    <GlossaryNav.Provider value={openGlossary}>
      <div className="app">
        <header className="app-header">
          <h1>{tr.app.title}</h1>
          {datasets && (
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
          {settings && (
            <BackupButton
              lastBackupAt={settings.lastBackupAt}
              hasWork={hasWork}
              now={now()}
              onOpen={() => setBackupOpen(true)}
            />
          )}
          {feed?.config.auto && (
            <span
              className={`feed-indicator ${feed.problem ? 'warn-text' : ''}`}
              title={feed.problem ? tr.paper.problems[feed.problem] : tr.paper.liveTitle}
            >
              {feed.problem ? tr.paper.liveProblem : tr.paper.live}
            </span>
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
              indicators={settings.indicators}
              onIndicators={(indicators) => update({ indicators })}
              onImport={() => setImporting(true)}
            />
          )}
        </header>

        <main className="app-main">
          {datasets === null && <p className="muted">{tr.app.loading}</p>}
          {view === 'CHART' && datasets?.length === 0 && (
            <EmptyState onImport={() => setImporting(true)} onLearn={() => openLesson(null)} />
          )}
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
          {view === 'LEARN' && settings && (
            <LearnPage
              tab={learnTab}
              onTab={setLearnTab}
              glossaryFocus={glossaryFocus}
              exercise={{
                data: active && instrument ? data : null,
                meta: active,
                instrument,
                timeframe: data?.tf ?? timeframe,
                displayTz: settings.displayTz,
                history: settings.learning.exercises,
                now,
                onFinish: (round) =>
                  update({
                    learning: {
                      ...settings.learning,
                      exercises: [round, ...settings.learning.exercises].slice(
                        0,
                        MAX_EXERCISE_ROUNDS,
                      ),
                    },
                  }),
              }}
              path={{
                completed: completedLessons,
                selectedId: lessonId ?? upcoming?.id ?? LESSONS[0]!.id,
                onSelect: setLessonId,
                onToggleComplete: toggleLesson,
                onAction: onLessonAction,
              }}
              concepts={{
                focus: conceptFocus,
                data: active && instrument ? data : null,
                meta: active,
                instrument,
                timeframe: data?.tf ?? timeframe,
                displayTz: settings.displayTz,
                sessionNames,
                canShow: !trading.busy,
                onShow: showConcept,
              }}
            />
          )}
          {view === 'EVENTS' && settings && (
            <EventsPage
              research={researchRepo}
              data={active && instrument ? data : null}
              meta={active}
              instrument={instrument}
              timeframe={data?.tf ?? timeframe}
              displayTz={settings.displayTz}
              now={now}
            />
          )}
          {view === 'SIGNALS' && settings && (
            <SignalsPage research={researchRepo} displayTz={settings.displayTz} now={now} />
          )}
          {view === 'PAPER' && settings && (
            <PaperPage
              research={researchRepo}
              strategies={strategyRepo}
              source={candleSource}
              market={repo}
              feed={feed!}
              displayTz={settings.displayTz}
              now={now}
              newId={newId}
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
              {upcoming && !settings.learning.hideHint && (
                <div className="learn-hint">
                  <button type="button" className="link" onClick={() => openLesson(upcoming.id)}>
                    {tr.learn.hint.next(upcoming.title)}
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => update({ learning: { ...settings.learning, hideHint: true } })}
                  >
                    {tr.learn.hint.hide}
                  </button>
                </div>
              )}
              <div className="tool-row">
                <span className="hint tool-hint">{tr.drawings.hints[tool]}</span>
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
                <DrawingTools
                  tool={tool}
                  onTool={(t) => {
                    setTool(t);
                    if (t !== 'SELECT') setSelectedId(null);
                  }}
                  magnet={magnet}
                  onMagnet={() => setMagnet((x) => !x)}
                  keep={keepDrawing}
                  onKeep={() => setKeepDrawing((x) => !x)}
                  lockAll={lockAll}
                  onLockAll={() => setLockAll((x) => !x)}
                  hideAll={hideAll}
                  onHideAll={() => {
                    setHideAll((x) => !x);
                    setSelectedId(null);
                  }}
                  count={store.drawings.length}
                  onRemoveAll={() => {
                    setSelectedId(null);
                    void store.deleteDrawings(store.drawings.map((d) => d.id));
                  }}
                  canUndo={store.canUndo}
                  onUndo={() => void store.undo()}
                  canRedo={store.canRedo}
                  onRedo={() => void store.redo()}
                />
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
                    smc={chartData.smc}
                    featureLayers={settings.features}
                    indicators={settings.indicators}
                    setups={setupMarks}
                    tradeLines={tradeLines}
                    screenshotRef={screenshotRef}
                    focus={focus}
                    drawings={visibleDrawings}
                    levels={store.levels}
                    selectedId={selectedId}
                    tool={tool}
                    onDrawn={onDrawn}
                    onSelect={setSelectedId}
                    magnet={magnet}
                    onErase={eraseDrawing}
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

        {backupOpen && settings && (
          <BackupDialog
            repos={backupRepos}
            now={now}
            displayTz={settings.displayTz}
            lastBackupAt={settings.lastBackupAt}
            onBackedUp={(at) => update({ lastBackupAt: at })}
            onClose={() => setBackupOpen(false)}
          />
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
    </GlossaryNav.Provider>
  );
}

const DAY = 86_400_000;
const REMIND_AFTER_DAYS = 7;

/** Header entry to the backup dialog; also the reminder when work exists and no recent backup. */
function BackupButton(p: {
  lastBackupAt: number | null;
  hasWork: boolean;
  now: number;
  onOpen: () => void;
}) {
  const days = p.lastBackupAt === null ? null : Math.floor((p.now - p.lastBackupAt) / DAY);
  const remind = p.hasWork && (days === null || days >= REMIND_AFTER_DAYS);
  const label = !remind
    ? tr.backup.button
    : `${tr.backup.button} · ${days === null ? tr.backup.reminder : tr.backup.reminderOld(days)}`;
  return (
    <button type="button" className={`btn ${remind ? 'btn-warn' : ''}`} onClick={p.onOpen}>
      {label}
    </button>
  );
}
