import { useCallback, useEffect, useState, type ComponentType } from 'react';
import {
  compareTimeframes,
  getInstrument,
  type CandleSeries,
  type DataSetMeta,
  type ResampledCandle,
} from '@trw/engine';
import { ChartView } from './chart/ChartView';
import type { ChartViewProps } from './chart/types';
import { EmptyState } from './components/EmptyState';
import { candlesFor } from './compute';
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
  ChartComponent?: ComponentType<ChartViewProps>;
}

export function App({ repo, prefs, createImporter, ChartComponent = ChartView }: AppProps) {
  const [datasets, setDatasets] = useState<DataSetMeta[] | null>(null);
  const [settings, setSettings] = useState<Prefs | null>(null);
  const [importing, setImporting] = useState(false);
  const [loaded, setLoaded] = useState<{ id: string; series: CandleSeries } | null>(null);
  const [candles, setCandles] = useState<ResampledCandle[] | null>(null);
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

  const activeId = active?.id;
  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    setError(null);
    repo
      .loadSeries(activeId)
      .then((series) => !cancelled && setLoaded({ id: activeId, series }))
      .catch((e: unknown) => !cancelled && setError(String(e)));
    return () => {
      cancelled = true;
    };
  }, [repo, activeId]);

  useEffect(() => {
    if (!active || !loaded || loaded.id !== active.id) return;
    let cancelled = false;
    setCandles(null);
    void candlesFor(active, loaded.series, timeframe).then((c) => !cancelled && setCandles(c));
    return () => {
      cancelled = true;
    };
  }, [active, loaded, timeframe]);

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
        {active && settings && candles && (
          <ChartComponent
            candles={candles}
            instrument={getInstrument(active.instrument)}
            timeframe={timeframe}
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
