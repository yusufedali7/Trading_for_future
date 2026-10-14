import { tr } from '../i18n/tr';

export function EmptyState({ onImport, onLearn }: { onImport: () => void; onLearn: () => void }) {
  return (
    <section className="empty-state" aria-labelledby="empty-title">
      <h2 id="empty-title">{tr.empty.title}</h2>
      <p>{tr.empty.body}</p>
      <button type="button" className="btn btn-primary" onClick={onImport}>
        {tr.empty.importButton}
      </button>
      <p className="hint">{tr.empty.learnFirst}</p>
      <button type="button" className="btn" onClick={onLearn}>
        {tr.empty.learnButton}
      </button>
    </section>
  );
}
