import { useEffect, useState } from 'react';
import type { DataSetMeta } from '@trw/engine';
import { EmptyState } from './components/EmptyState';
import { tr } from './i18n/tr';
import type { MarketRepo } from './storage/market-repo';

export function App({ repo }: { repo: MarketRepo }) {
  const [datasets, setDatasets] = useState<DataSetMeta[] | null>(null);
  const [, setImporting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void repo.listDatasets().then((list) => {
      if (!cancelled) setDatasets(list);
    });
    return () => {
      cancelled = true;
    };
  }, [repo]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>{tr.app.title}</h1>
      </header>
      <main className="app-main">
        {datasets === null && <p className="muted">{tr.app.loading}</p>}
        {datasets?.length === 0 && <EmptyState onImport={() => setImporting(true)} />}
      </main>
    </div>
  );
}
