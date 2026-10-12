import { useCallback, useEffect, useState } from 'react';
import {
  CATALOG_STRATEGIES,
  isWatchable,
  STRATEGY_STATUSES,
  defaultSpec,
  newVersion,
  type DataSetMeta,
  type IanaTz,
  type Strategy,
  type StrategySpec,
  type StrategyStatus,
  type StrategyVersion,
} from '@trw/engine';
import type { CandleSource } from '../../compute/candle-source';
import { formatTime } from '../../format';
import { tr } from '../../i18n/tr';
import type { UserSession } from '../../storage/sessions-repo';
import type { ResearchRepo, StrategyRepo, WatchedStrategy } from '../../storage/strategy-repo';
import { BacktestPanel } from '../backtest/BacktestPanel';
import { StrategyBuilder } from './StrategyBuilder';
import { specSummary } from './spec-summary';

const t = tr.strategy;
/** Empty input → NaN, so a blank/garbled equity is rejected instead of silently treated as 0. */
const num = (v: string) => (v.trim() === '' ? NaN : Number(v.replace(',', '.')));

export interface StrategyPageProps {
  strategies: StrategyRepo;
  research: ResearchRepo;
  source: CandleSource;
  datasets: readonly DataSetMeta[];
  /** Instrument of the chart, used as the default for a new strategy. */
  defaultInstrument: string;
  displayTz: IanaTz;
  now: () => number;
  newId: () => string;
  /** The user's sessions, offered as sweep levels in the builder. */
  userSessions: readonly UserSession[];
  /** Show the setups of this version on the chart. */
  onShowOnChart: (strategy: Strategy, version: StrategyVersion) => void;
}

type Mode =
  | { kind: 'VIEW' }
  | { kind: 'NEW_STRATEGY' }
  | { kind: 'NEW_VERSION'; from: StrategySpec }
  | { kind: 'CATALOG' };

export function StrategyPage(p: StrategyPageProps) {
  const [list, setList] = useState<Strategy[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [versions, setVersions] = useState<StrategyVersion[]>([]);
  const [versionNo, setVersionNo] = useState<number | null>(null);
  const [mode, setMode] = useState<Mode>({ kind: 'VIEW' });
  const [statusNote, setStatusNote] = useState('');
  const [watched, setWatched] = useState<WatchedStrategy[]>([]);

  const reload = useCallback(
    async () => setList(await p.strategies.listStrategies()),
    [p.strategies],
  );
  const reloadWatched = useCallback(
    async () => setWatched(await p.research.listWatched()),
    [p.research],
  );
  useEffect(() => {
    void reload();
    void reloadWatched();
  }, [reload, reloadWatched]);
  useEffect(() => {
    if (!selectedId) return;
    void p.strategies.listVersions(selectedId).then((vs) => {
      setVersions(vs);
      setVersionNo((cur) =>
        cur !== null && vs.some((v) => v.version === cur) ? cur : (vs.at(-1)?.version ?? null),
      );
    });
  }, [p.strategies, selectedId]);

  const strategy = list?.find((s) => s.id === selectedId) ?? null;
  const version = versions.find((v) => v.version === versionNo) ?? null;

  const saveNew = async (
    spec: StrategySpec,
    meta: { name: string; description: string; note: string },
  ) => {
    const at = p.now();
    const s: Strategy = {
      id: p.newId(),
      name: meta.name,
      description: meta.description,
      latestVersion: 0,
      createdAt: at,
      updatedAt: at,
    };
    await p.strategies.createStrategy(s, newVersion(s, spec, meta.note, at));
    await reload();
    setSelectedId(s.id);
    setVersionNo(1);
    setMode({ kind: 'VIEW' });
  };

  const importCatalog = async (c: (typeof CATALOG_STRATEGIES)[number]) => {
    await saveNew(c.spec, { name: c.name, description: c.description, note: t.importCatalogNote });
  };

  const saveVersion = async (spec: StrategySpec, meta: { note: string }) => {
    if (!strategy) return;
    const at = p.now();
    const v = newVersion(strategy, spec, meta.note, at);
    await p.strategies.addVersion(v, at);
    await reload();
    setVersions(await p.strategies.listVersions(strategy.id));
    setVersionNo(v.version);
    setMode({ kind: 'VIEW' });
  };

  const changeStatus = async (status: StrategyStatus) => {
    if (!version) return;
    const next = await p.strategies.setStatus(
      version.strategyId,
      version.version,
      status,
      p.now(),
      statusNote.trim() || undefined,
    );
    setStatusNote('');
    setVersions((vs) => vs.map((v) => (v.version === next.version ? next : v)));
  };

  const [watchEquity, setWatchEquity] = useState('10000');
  const watchId = (strategyId: string, v: number) => `${strategyId}:${v}`;
  const activeWatch = (strategyId: string, v: number) =>
    watched.find((w) => w.id === watchId(strategyId, v) && w.stoppedAt === null) ?? null;

  const toggleWatch = async () => {
    if (!strategy || !version) return;
    const id = watchId(strategy.id, version.version);
    const current = activeWatch(strategy.id, version.version);
    if (current) {
      await p.research.unwatch(id, p.now());
    } else {
      const startEquity = num(watchEquity);
      if (!(startEquity > 0)) return;
      await p.research.watch({
        id,
        strategyId: strategy.id,
        strategyVersion: version.version,
        instrument: version.spec.instrument,
        watchedSince: p.now(),
        stoppedAt: null,
        startEquity,
        createdAt: p.now(),
      });
    }
    await reloadWatched();
  };

  if (list === null) return <p className="muted">{tr.app.loading}</p>;

  return (
    <div className="strategy-page">
      <aside className="strategy-list" aria-label={t.title}>
        <h2>{t.title}</h2>
        <div className="field-row">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setMode({ kind: 'NEW_STRATEGY' })}
          >
            {t.newStrategy}
          </button>
          <button type="button" className="btn" onClick={() => setMode({ kind: 'CATALOG' })}>
            {t.importCatalog}
          </button>
        </div>
        {list.length === 0 && <p className="hint">{t.empty}</p>}
        <ul className="levels">
          {list.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className="level-row"
                aria-pressed={s.id === selectedId}
                onClick={() => {
                  setSelectedId(s.id);
                  setVersionNo(null);
                  setMode({ kind: 'VIEW' });
                }}
              >
                <span>{s.name}</span>
                <span className="muted-inline">{t.version(s.latestVersion)}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section className="strategy-detail">
        {mode.kind === 'NEW_STRATEGY' && (
          <StrategyBuilder
            initial={defaultSpec(p.defaultInstrument)}
            askName
            userSessions={p.userSessions}
            onSave={(spec, meta) => void saveNew(spec, meta)}
            onCancel={() => setMode({ kind: 'VIEW' })}
          />
        )}

        {mode.kind === 'CATALOG' && (
          <section className="panel stack" aria-label={t.importCatalog}>
            <h3>{t.importCatalog}</h3>
            <p className="hint">{t.importCatalogHint}</p>
            <ul className="levels">
              {CATALOG_STRATEGIES.map((c) => (
                <li key={`${c.catalogId}:${c.versionLabel}`}>
                  <div className="level-row">
                    <span>
                      <strong>{c.name}</strong>
                      <br />
                      <span className="hint">{c.description}</span>
                    </span>
                    <button type="button" className="btn" onClick={() => void importCatalog(c)}>
                      {t.newStrategy}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <button type="button" className="btn" onClick={() => setMode({ kind: 'VIEW' })}>
              {t.cancel}
            </button>
          </section>
        )}

        {mode.kind !== 'NEW_STRATEGY' && mode.kind !== 'CATALOG' && strategy && (
          <>
            <h2>{strategy.name}</h2>
            {strategy.description && <p className="muted-inline">{strategy.description}</p>}
            <div className="segmented" role="group" aria-label={t.versions}>
              {versions.map((v) => (
                <button
                  key={v.version}
                  type="button"
                  className="seg"
                  aria-pressed={v.version === versionNo}
                  onClick={() => {
                    setVersionNo(v.version);
                    setMode({ kind: 'VIEW' });
                  }}
                >
                  {t.version(v.version)}
                </button>
              ))}
            </div>

            {mode.kind === 'NEW_VERSION' && (
              <StrategyBuilder
                key={`v-${versionNo}`}
                initial={mode.from}
                askName={false}
                userSessions={p.userSessions}
                onSave={(spec, meta) => void saveVersion(spec, meta)}
                onCancel={() => setMode({ kind: 'VIEW' })}
              />
            )}

            {mode.kind === 'VIEW' && version && (
              <>
                <section className="panel version-panel" aria-label={t.version(version.version)}>
                  <ul className="spec-summary">
                    {specSummary(version.spec).map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                  <p className="hint">
                    {formatTime(version.createdAt, p.displayTz)} ·{' '}
                    {tr.strategy.hash(version.specHash)}
                    {version.changeNote ? ` · ${version.changeNote}` : ''}
                  </p>
                  <div className="builder-grid">
                    <label className="inline-field">
                      <span>{t.status}</span>
                      <select
                        value={version.status}
                        onChange={(e) => void changeStatus(e.target.value as StrategyStatus)}
                      >
                        {STRATEGY_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {t.statuses[s]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="inline-field">
                      <span>{t.statusNote}</span>
                      <input
                        type="text"
                        value={statusNote}
                        onChange={(e) => setStatusNote(e.target.value)}
                      />
                    </label>
                  </div>
                  <p className="hint">{t.validatedNote}</p>
                  <div className="field-row">
                    {isWatchable(version.status) && !activeWatch(strategy.id, version.version) && (
                      <label className="inline-field">
                        <span>{t.watchEquity}</span>
                        <input
                          type="number"
                          min={0}
                          step="any"
                          value={watchEquity}
                          onChange={(e) => setWatchEquity(e.target.value)}
                        />
                      </label>
                    )}
                    <button
                      type="button"
                      className="btn"
                      disabled={
                        !isWatchable(version.status) ||
                        (!activeWatch(strategy.id, version.version) && !(num(watchEquity) > 0))
                      }
                      onClick={() => void toggleWatch()}
                    >
                      {activeWatch(strategy.id, version.version) ? t.unwatch : t.watch}
                    </button>
                    {!isWatchable(version.status) && (
                      <span className="hint">{t.watchNeedsStatus}</span>
                    )}
                    {activeWatch(strategy.id, version.version) && (
                      <span className="hint">
                        {t.watchedSince(
                          formatTime(
                            activeWatch(strategy.id, version.version)!.watchedSince,
                            p.displayTz,
                          ),
                        )}
                      </span>
                    )}
                  </div>
                  <details>
                    <summary>{tr.levels.history}</summary>
                    <ul className="history">
                      {version.statusHistory.map((h, i) => (
                        <li key={i}>
                          {formatTime(h.at, p.displayTz)} · {t.statuses[h.status]}
                          {h.note ? ` · ${h.note}` : ''}
                        </li>
                      ))}
                    </ul>
                  </details>
                  <div className="field-row">
                    <button
                      type="button"
                      className="btn"
                      onClick={() => setMode({ kind: 'NEW_VERSION', from: version.spec })}
                    >
                      {t.newVersion}
                    </button>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => p.onShowOnChart(strategy, version)}
                    >
                      {tr.strategyChart.show}
                    </button>
                  </div>
                </section>
                <BacktestPanel
                  key={`${strategy.id}-${version.version}`}
                  strategy={strategy}
                  version={version}
                  datasets={p.datasets}
                  source={p.source}
                  repo={p.research}
                  displayTz={p.displayTz}
                  now={p.now}
                  newId={p.newId}
                />
              </>
            )}
          </>
        )}
      </section>
    </div>
  );
}
