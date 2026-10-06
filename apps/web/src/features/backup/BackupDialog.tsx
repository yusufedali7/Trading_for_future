import { useEffect, useState } from 'react';
import type { IanaTz } from '@trw/engine';
import {
  BACKUP_KINDS,
  BackupError,
  createBackup,
  parseBackup,
  planRestore,
  type BackupRepos,
  type RestorePlan,
} from '../../backup/backup';
import { journalCsv } from '../../backup/csv';
import { saveFile } from '../../backup/download';
import { formatTime } from '../../format';
import { tr } from '../../i18n/tr';

const t = tr.backup;

export interface BackupDialogProps {
  repos: BackupRepos;
  now: () => number;
  displayTz: IanaTz;
  lastBackupAt: number | null;
  onBackedUp: (at: number) => void;
  onClose: () => void;
}

type Persist = 'on' | 'off' | 'denied' | 'unknown';

/** The browser's StorageManager, when this context offers it (MDN: secure contexts only). */
const storage = (): StorageManager | null =>
  window.isSecureContext && typeof navigator.storage?.persisted === 'function'
    ? navigator.storage
    : null;

export function BackupDialog(p: BackupDialogProps) {
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<RestorePlan | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [applied, setApplied] = useState<number | null>(null);
  const [persist, setPersist] = useState<Persist>('unknown');

  useEffect(() => {
    void storage()
      ?.persisted()
      .then((on) => setPersist(on ? 'on' : 'off'));
  }, []);

  const download = async () => {
    setBusy(true);
    try {
      const at = p.now();
      const file = await createBackup(p.repos, at);
      const day = formatTime(at, p.displayTz).slice(0, 10);
      saveFile(`trw-yedek-${day}.json`, JSON.stringify(file), 'application/json');
      p.onBackedUp(at);
    } finally {
      setBusy(false);
    }
  };

  const choose = async (f: File | undefined) => {
    setPlan(null);
    setProblem(null);
    setApplied(null);
    if (!f) return;
    try {
      setPlan(await planRestore(p.repos, parseBackup(await f.text())));
    } catch (e) {
      setProblem(e instanceof BackupError ? t.problems[e.problem]! : String(e));
    }
  };

  const added = plan ? BACKUP_KINDS.reduce((n, k) => n + plan.counts[k].add, 0) : 0;

  return (
    <div className="overlay">
      <div className="wizard" role="dialog" aria-label={t.title}>
        <div className="wizard-header">
          <h2>{t.title}</h2>
        </div>
        <div className="wizard-body">
          <p>{t.intro}</p>
          <p className="warn-text">{t.ownBrowser}</p>

          <section className="stack">
            <button type="button" className="btn btn-primary" disabled={busy} onClick={download}>
              {t.download}
            </button>
            <p className="hint">
              {p.lastBackupAt === null
                ? t.never
                : t.downloaded(formatTime(p.lastBackupAt, p.displayTz))}{' '}
              {t.notIncluded}
            </p>
          </section>

          <section className="stack" aria-label={t.restoreTitle}>
            <h3>{t.restoreTitle}</h3>
            <p className="hint">{t.restoreNote}</p>
            <label className="inline-field">
              <span>{t.chooseFile}</span>
              <input
                type="file"
                accept="application/json,.json"
                onChange={(e) => void choose(e.target.files?.[0])}
              />
            </label>
            {problem && (
              <p className="blocker" role="alert">
                {problem}
              </p>
            )}
            {plan && (
              <>
                <div className="table-scroll">
                  <table className="data-table">
                    <caption>{t.previewTitle}</caption>
                    <thead>
                      <tr>
                        <th>{t.colKind}</th>
                        <th>{t.colAdd}</th>
                        <th>{t.colSame}</th>
                        <th>{t.colConflict}</th>
                        <th>{t.colInvalid}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {BACKUP_KINDS.map((k) => {
                        const c = plan.counts[k];
                        return (
                          <tr key={k}>
                            <td>{t.kinds[k]}</td>
                            <td>{c.add}</td>
                            <td>{c.same}</td>
                            <td className={c.conflict > 0 ? 'warn-text' : ''}>{c.conflict}</td>
                            <td className={c.invalid > 0 ? 'warn-text' : ''}>{c.invalid}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {applied === null ? (
                  added > 0 ? (
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          await plan.apply();
                          setApplied(added);
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      {t.apply}
                    </button>
                  ) : (
                    <p className="hint">{t.nothingToAdd}</p>
                  )
                ) : (
                  <div className="field-row wrap" role="status">
                    <span>{t.applied(applied)}</span>
                    <button type="button" className="btn" onClick={() => window.location.reload()}>
                      {t.reload}
                    </button>
                  </div>
                )}
              </>
            )}
          </section>

          <section className="stack">
            <h3>{t.csvTitle}</h3>
            <button
              type="button"
              className="btn"
              onClick={async () => {
                const csv = journalCsv(await p.repos.journal.listEntries(), p.displayTz);
                saveFile('trw-gunluk.csv', csv, 'text/csv;charset=utf-8');
              }}
            >
              {t.journalCsv}
            </button>
            <p className="hint">{t.csvNote}</p>
          </section>

          <section className="stack">
            <h3>{t.persistTitle}</h3>
            <p className={persist === 'on' ? 'hint' : 'warn-text'}>
              {persist === 'on'
                ? t.persistOn
                : persist === 'off'
                  ? t.persistOff
                  : persist === 'denied'
                    ? t.persistDenied
                    : t.persistUnknown}
            </p>
            {persist === 'off' && (
              <button
                type="button"
                className="btn"
                onClick={async () => {
                  const ok = await storage()?.persist();
                  setPersist(ok ? 'on' : 'denied');
                }}
              >
                {t.persistAsk}
              </button>
            )}
          </section>
        </div>
        <div className="wizard-footer">
          <button type="button" className="btn" onClick={p.onClose}>
            {t.close}
          </button>
        </div>
      </div>
    </div>
  );
}
