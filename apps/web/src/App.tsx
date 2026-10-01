import { useCallback, useEffect, useState, type ComponentType } from 'react';
import { compareTimeframes, getInstrument, type DataSetMeta, type Timeframe } from '@trw/engine';
import { ChartView } from './chart/ChartView';
import type { ChartViewProps } from './chart/types';
import { EmptyState } from './components/EmptyState';
import type { CandleSource, ChartData } from './compute/candle-source';
import { ImportWizard } from './features/import/ImportWizard';
import { Toolbar } from './features/workspace/Toolbar';
import { tr } from './i18n/tr';
import type { Importer } from './import/importer';
import type { Prefs, PrefsRepo } from './storage/db-user';
import type { MarketRepo } from './storage/market-repo';

export interface AppProps {
  repo: MarketRepo;
  prefs: PrefsRepo;
  createImporter: () => Importer;
  candleSource: CandleSource;
  ChartComponent?: ComponentType<ChartViewProps>;
}

export function App({
  repo,
  prefs,
  createImporter,
  candleSource,
  ChartComponent = ChartView,
}: AppProps) {
  const [datasets, setDatasets] = useState<DataSetMeta[] | null>(null);
  const [settings, setSettings] = useState<Prefs | null>(null);
  const [importing, setImporting] = useState(false);
  // Kept while the next timeframe loads so the chart (and its visible range) is not remounted.
  const [data, setData] = useState<(ChartData & { tf: Timeframe }) | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [list, p] = await Promise.all([repo.listDatasets(), prefs.load()]);
    setDatasets(list);
    setSettings(p);
  }, [repo, prefs]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const active = datasets?.find((d) => d.id === settings?.datasetId) ?? datasets?.[0] ?? null;
  // Never show a timeframe finer than the stored base data.
  const timeframe =
    active && settings && compareTimeframes(settings.timeframe, active.baseTimeframe) >= 0
      ? settings.timeframe
      : (active?.baseTimeframe ?? settings?.timeframe ?? '15m');

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

  const update = (patch: Partial<Prefs>) => {
    setSettings((s) => (s ? { ...s, ...patch } : s));
    void prefs.save(patch);
  };

  const onSaved = async (meta: DataSetMeta) => {
    setImporting(false);
    await prefs.save({ datasetId: meta.id });
    await refresh();
  };

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
            onDataset={(id) => update({ datasetId: id })}
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
        {active && settings && data && (
          <ChartComponent
            candles={data.candles}
            sessions={data.sessions.filter((s) => settings.sessions.includes(s.sessionId))}
            instrument={getInstrument(active.instrument)}
            timeframe={data.tf}
            displayTz={settings.displayTz}
          />
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
