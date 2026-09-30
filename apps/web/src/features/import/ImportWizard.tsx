import { useEffect, useRef, useState } from 'react';
import {
  ENGINE_VERSION,
  KNOWN_DATE_FORMATS,
  listInstruments,
  type CandleSeries,
  type CsvMapping,
  type DataSetMeta,
  type Fix,
  type PriceType,
} from '@trw/engine';
import { tr } from '../../i18n/tr';
import type { Importer } from '../../import/importer';
import type { AnalysisSummary, ReadResult } from '../../import/session';
import { ValidationReportView } from './ValidationReportView';

type Phase = 'form' | 'reading' | 'mapped' | 'analyzing' | 'report' | 'saving';

const FIX_COUNT: Record<Fix, keyof AnalysisSummary['counts']> = {
  SKIP_UNPARSEABLE_ROWS: 'parseErrors',
  SKIP_DST_ROWS: 'dstIssues',
  SORT_BY_TIME: 'outOfOrder',
  DROP_IDENTICAL_DUPLICATES: 'identicalDuplicates',
  DROP_CLOSED_MARKET_CANDLES: 'closedMarketCandles',
  DROP_INVALID_PRICES: 'invalidPriceRows',
  ROUND_TO_TICK: 'precisionOverflow',
};

const PRICE_TYPES: PriceType[] = ['BID', 'ASK', 'MID', 'UNKNOWN'];

/** Starting point when the layout could not be guessed; the user edits it. */
const FALLBACK_MAPPING: CsvMapping = {
  hasHeader: true,
  time: { kind: 'SINGLE', column: 0 },
  dateFormat: KNOWN_DATE_FORMATS[0]!,
  open: 1,
  high: 2,
  low: 3,
  close: 4,
};

export interface ImportWizardProps {
  createImporter: () => Importer;
  save: (meta: DataSetMeta, series: CandleSeries) => Promise<void>;
  onSaved: (meta: DataSetMeta) => void;
  onClose: () => void;
  now?: () => number;
  newId?: () => string;
}

export function ImportWizard({
  createImporter,
  save,
  onSaved,
  onClose,
  now = Date.now,
  newId = () => crypto.randomUUID(),
}: ImportWizardProps) {
  const importerRef = useRef<Importer | null>(null);
  const importer = () => (importerRef.current ??= createImporter());
  useEffect(() => () => importerRef.current?.dispose(), []);

  const [phase, setPhase] = useState<Phase>('form');
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [instrument, setInstrument] = useState('EURUSD');
  const [sourceName, setSourceName] = useState('Dukascopy');
  const [sourceTz, setSourceTz] = useState('UTC');
  const [priceType, setPriceType] = useState<PriceType>('BID');
  const [readResult, setReadResult] = useState<ReadResult | null>(null);
  const [mapping, setMapping] = useState<CsvMapping | null>(null);
  const [summary, setSummary] = useState<AnalysisSummary | null>(null);
  const [accepted, setAccepted] = useState<Set<Fix>>(new Set());

  const busy = phase === 'reading' || phase === 'analyzing' || phase === 'saving';

  const invalidateAnalysis = () => {
    setSummary(null);
    setAccepted(new Set());
    if (phase === 'report') setPhase('mapped');
  };

  const fail = (err: unknown) => {
    setError(tr.import.failed(err instanceof Error ? err.message : String(err)));
  };

  async function onRead() {
    if (!file) return;
    setError(null);
    setPhase('reading');
    try {
      const res = await importer().read(file);
      setReadResult(res);
      setMapping(res.guess ?? FALLBACK_MAPPING);
      setSummary(null);
      setPhase('mapped');
    } catch (err) {
      fail(err);
      setPhase('form');
    }
  }

  async function onAnalyze() {
    if (!mapping) return;
    setError(null);
    setPhase('analyzing');
    try {
      setSummary(await importer().analyze(mapping, sourceTz, instrument));
      setAccepted(new Set());
      setPhase('report');
    } catch (err) {
      fail(err);
      setPhase('mapped');
    }
  }

  async function onSave() {
    if (!summary || !file || !mapping || !summary.inferredTimeframe) return;
    setError(null);
    setPhase('saving');
    try {
      const done = await importer().finish([...accepted]);
      const s = done.series;
      const meta: DataSetMeta = {
        id: newId(),
        instrument,
        baseTimeframe: summary.inferredTimeframe,
        priceType,
        source: {
          name: sourceName.trim(),
          fileName: file.name,
          sourceTimezone: sourceTz,
          mapping,
          importedAt: now(),
        },
        range: { from: s.t[0]!, to: s.t[s.length - 1]! },
        candleCount: s.length,
        contentHash: s.contentHash,
        engineVersion: ENGINE_VERSION,
        validation: done.validation,
        parseErrors: done.parseErrors,
        dstIssues: done.dstIssues,
        acceptedIssues: done.applied,
        demo: false,
      };
      await save(meta, s);
      onSaved(meta);
    } catch (err) {
      fail(err);
      setPhase('report');
    }
  }

  const cancel = () => {
    importerRef.current?.dispose();
    importerRef.current = null;
    onClose();
  };

  const allFixesAccepted = summary?.required.every((f) => accepted.has(f)) ?? false;
  const canSave =
    phase === 'report' &&
    !!summary &&
    summary.blockers.length === 0 &&
    !!summary.inferredTimeframe &&
    allFixesAccepted &&
    sourceName.trim() !== '';

  return (
    <section className="wizard" role="dialog" aria-labelledby="wizard-title">
      <header className="wizard-header">
        <h2 id="wizard-title">{tr.import.title}</h2>
      </header>

      <div className="wizard-body">
        <div className="form-grid">
          <label htmlFor="imp-file">{tr.import.file}</label>
          <input
            id="imp-file"
            type="file"
            accept=".csv,text/csv,text/plain"
            disabled={busy}
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setReadResult(null);
              setMapping(null);
              setSummary(null);
              setPhase('form');
            }}
          />

          <label htmlFor="imp-inst">{tr.import.instrument}</label>
          <select
            id="imp-inst"
            value={instrument}
            disabled={busy}
            onChange={(e) => {
              setInstrument(e.target.value);
              invalidateAnalysis();
            }}
          >
            {listInstruments().map((i) => (
              <option key={i.symbol} value={i.symbol}>
                {i.symbol}
              </option>
            ))}
          </select>

          <label htmlFor="imp-src">{tr.import.sourceName}</label>
          <div>
            <input
              id="imp-src"
              type="text"
              value={sourceName}
              disabled={busy}
              onChange={(e) => setSourceName(e.target.value)}
            />
            <p className="hint">{tr.import.sourceNameHint}</p>
          </div>

          <label htmlFor="imp-tz">{tr.import.sourceTz}</label>
          <div>
            <select
              id="imp-tz"
              value={sourceTz}
              disabled={busy}
              onChange={(e) => {
                setSourceTz(e.target.value);
                invalidateAnalysis();
              }}
            >
              {tr.sourceTimezones.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <p className="hint">{tr.import.sourceTzHint}</p>
          </div>

          <label htmlFor="imp-price">{tr.import.priceType}</label>
          <select
            id="imp-price"
            value={priceType}
            disabled={busy}
            onChange={(e) => setPriceType(e.target.value as PriceType)}
          >
            {PRICE_TYPES.map((p) => (
              <option key={p} value={p}>
                {tr.priceTypes[p]}
              </option>
            ))}
          </select>
        </div>

        {phase === 'form' || phase === 'reading' ? (
          <button type="button" className="btn" disabled={!file || busy} onClick={onRead}>
            {phase === 'reading' ? tr.import.reading : tr.import.read}
          </button>
        ) : null}

        {readResult && mapping && (
          <MappingEditor
            readResult={readResult}
            mapping={mapping}
            disabled={busy}
            onChange={(m) => {
              setMapping(m);
              invalidateAnalysis();
            }}
          />
        )}

        {readResult && (phase === 'mapped' || phase === 'analyzing') && (
          <button type="button" className="btn" disabled={!mapping || busy} onClick={onAnalyze}>
            {phase === 'analyzing' ? tr.import.analyzing : tr.import.analyze}
          </button>
        )}

        {summary && (
          <>
            <ValidationReportView summary={summary} />
            {summary.blockers.map((b) => (
              <p key={b.kind} className="blocker" role="alert">
                {tr.blockers[b.kind](b.kind === 'CONFLICTING_DUPLICATES' ? b.count : 0)}
              </p>
            ))}
            {!summary.inferredTimeframe && summary.recordCount > 0 && (
              <p className="blocker" role="alert">
                {tr.import.unknownTimeframe}
              </p>
            )}
            {summary.required.length === 0 ? (
              <p>{tr.import.noFixes}</p>
            ) : (
              <fieldset className="fixes">
                <legend>{tr.import.fixesTitle}</legend>
                <p className="hint">{tr.import.fixesHint}</p>
                {summary.required.map((f) => (
                  <label key={f} className="check">
                    <input
                      type="checkbox"
                      checked={accepted.has(f)}
                      disabled={busy}
                      onChange={(e) => {
                        const next = new Set(accepted);
                        if (e.target.checked) next.add(f);
                        else next.delete(f);
                        setAccepted(next);
                      }}
                    />
                    {tr.fixes[f](summary.counts[FIX_COUNT[f]])}
                  </label>
                ))}
              </fieldset>
            )}
          </>
        )}

        {error && (
          <p className="blocker" role="alert">
            {error}
          </p>
        )}
      </div>

      <footer className="wizard-footer">
        <button type="button" className="btn" onClick={cancel}>
          {tr.import.cancel}
        </button>
        <button type="button" className="btn btn-primary" disabled={!canSave} onClick={onSave}>
          {phase === 'saving' ? tr.import.saving : tr.import.save}
        </button>
      </footer>
    </section>
  );
}

function MappingEditor({
  readResult,
  mapping,
  disabled,
  onChange,
}: {
  readResult: ReadResult;
  mapping: CsvMapping;
  disabled: boolean;
  onChange: (m: CsvMapping) => void;
}) {
  const width = Math.max(...readResult.preview.map((r) => r.length));
  const first = readResult.preview[0] ?? [];
  const labels = Array.from({ length: width }, (_, i) => tr.import.column(i, first[i] ?? ''));
  const m = mapping;
  const dateColumn = m.time.kind === 'SINGLE' ? m.time.column : m.time.dateColumn;
  const timeColumn = m.time.kind === 'DATE_AND_TIME' ? m.time.timeColumn : -1;

  const colSelect = (
    id: string,
    label: string,
    value: number,
    set: (v: number) => void,
    optional = false,
  ) => (
    <>
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(e) => set(Number(e.target.value))}
      >
        {optional && <option value={-1}>{tr.import.none}</option>}
        {labels.map((l, i) => (
          <option key={i} value={i}>
            {l}
          </option>
        ))}
      </select>
    </>
  );

  return (
    <section aria-labelledby="preview-title" className="mapping">
      <h3 id="preview-title">{tr.import.preview}</h3>
      <p className="hint">{tr.import.rowsInFile(readResult.totalRows)}</p>
      <div className="table-scroll">
        <table className="preview">
          <tbody>
            {readResult.preview.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3>{tr.import.mappingTitle}</h3>
      {!readResult.guess && <p className="blocker">{tr.import.noGuess}</p>}
      <div className="form-grid">
        <label htmlFor="map-header">{tr.import.hasHeader}</label>
        <input
          id="map-header"
          type="checkbox"
          checked={m.hasHeader}
          disabled={disabled}
          onChange={(e) => onChange({ ...m, hasHeader: e.target.checked })}
        />
        <label htmlFor="map-format">{tr.import.dateFormat}</label>
        <select
          id="map-format"
          value={m.dateFormat}
          disabled={disabled}
          onChange={(e) => onChange({ ...m, dateFormat: e.target.value })}
        >
          {KNOWN_DATE_FORMATS.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
        {colSelect('map-date', tr.import.dateColumn, dateColumn, (v) =>
          onChange({
            ...m,
            time:
              m.time.kind === 'SINGLE'
                ? { kind: 'SINGLE', column: v }
                : { ...m.time, dateColumn: v },
          }),
        )}
        {colSelect(
          'map-time',
          tr.import.timeColumn,
          timeColumn,
          (v) =>
            onChange({
              ...m,
              time:
                v < 0
                  ? { kind: 'SINGLE', column: dateColumn }
                  : { kind: 'DATE_AND_TIME', dateColumn, timeColumn: v },
            }),
          true,
        )}
        {colSelect('map-open', tr.import.open, m.open, (v) => onChange({ ...m, open: v }))}
        {colSelect('map-high', tr.import.high, m.high, (v) => onChange({ ...m, high: v }))}
        {colSelect('map-low', tr.import.low, m.low, (v) => onChange({ ...m, low: v }))}
        {colSelect('map-close', tr.import.close, m.close, (v) => onChange({ ...m, close: v }))}
        {colSelect(
          'map-volume',
          tr.import.volume,
          m.volume ?? -1,
          (v) => {
            const { volume: _drop, ...rest } = m;
            onChange(v < 0 ? rest : { ...rest, volume: v });
          },
          true,
        )}
      </div>
    </section>
  );
}
