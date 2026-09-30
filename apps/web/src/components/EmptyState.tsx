import { tr } from '../i18n/tr';

export function EmptyState({ onImport }: { onImport: () => void }) {
  return (
    <section className="empty-state" aria-labelledby="empty-title">
      <h2 id="empty-title">{tr.empty.title}</h2>
      <p>{tr.empty.body}</p>
      <button type="button" className="btn btn-primary" onClick={onImport}>
        {tr.empty.importButton}
      </button>
    </section>
  );
}
