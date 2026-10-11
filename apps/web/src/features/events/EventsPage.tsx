import { useEffect, useMemo, useState } from 'react';
import {
  batchExcursions,
  collectDetections,
  ENGINE_VERSION,
  mulberry32,
  summarizeExcursions,
  toBars,
  type DataSetMeta,
  type FeatureSet,
  type IanaTz,
  type Instrument,
  type OutcomeConcept,
  type ResampledCandle,
  type SmcSet,
  type Timeframe,
} from '@trw/engine';
import { formatTime } from '../../format';
import { tr } from '../../i18n/tr';
import type { EventRecord, ResearchRepo } from '../../storage/strategy-repo';
import { CONCEPTS } from '../../content/concepts';

const t = tr.events;
/** Fixed per the project's determinism rule (rule 5) - every scan of the same data reproduces. */
const SCAN_SEED = 1;
const HORIZONS = [5, 10, 20, 50];

const conceptName = (c: OutcomeConcept) => CONCEPTS.find((x) => x.id === c)?.name ?? c;

export interface EventsPageProps {
  research: ResearchRepo;
  /** The chart's current data (not the replay view) - scans only ever use real, loaded data. */
  data: { candles: ResampledCandle[]; features: FeatureSet; smc: SmcSet } | null;
  meta: DataSetMeta | null;
  instrument: Instrument | null;
  timeframe: Timeframe;
  displayTz: IanaTz;
  now: () => number;
}

export function EventsPage({
  research,
  data,
  meta,
  instrument,
  timeframe,
  displayTz,
  now,
}: EventsPageProps) {
  const [events, setEvents] = useState<EventRecord[] | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scannedNote, setScannedNote] = useState<string | null>(null);
  const [filter, setFilter] = useState<OutcomeConcept | 'ALL'>('ALL');
  const datasetId = meta?.id ?? null;

  useEffect(() => {
    setEvents(null);
    setScannedNote(null);
    if (!datasetId) return;
    void research.listEvents(datasetId).then(setEvents);
  }, [research, datasetId]);

  const refs = useMemo(() => (data ? collectDetections(data.features, data.smc) : []), [data]);

  const scan = async () => {
    if (!data || !meta || !instrument || refs.length === 0) return;
    setScanning(true);
    try {
      const b = toBars(data.candles, instrument, timeframe);
      const reports = batchExcursions(b, refs, HORIZONS, mulberry32(SCAN_SEED));
      const byId = new Map(refs.map((r) => [r.id, r]));
      const scannedAt = now();
      const records: EventRecord[] = reports.map((r) => {
        const d = byId.get(r.id)!;
        return {
          id: `${meta.id}:${timeframe}:${r.id}`,
          datasetId: meta.id,
          instrument: meta.instrument,
          timeframe,
          concept: r.concept,
          direction: d.direction,
          formedAt: d.formedAt,
          confirmedAt: d.confirmedAt,
          horizons: HORIZONS,
          excursions: r.excursions,
          control: r.control,
          controlSeed: SCAN_SEED,
          engineVersion: ENGINE_VERSION,
          scannedAt,
        };
      });
      await research.saveEvents(records);
      setEvents(await research.listEvents(meta.id));
      setScannedNote(t.scanned(records.length));
    } finally {
      setScanning(false);
    }
  };

  const shown = (events ?? []).filter((e) => filter === 'ALL' || e.concept === filter);
  const concepts = useMemo(
    () => [...new Set((events ?? []).map((e) => e.concept))].sort(),
    [events],
  );
  const lastHorizonIdx = HORIZONS.length - 1;

  return (
    <div className="events-page stack">
      <h2>{t.title}</h2>
      <p className="hint">{t.intro}</p>

      {!data && <p className="muted">{t.noData}</p>}
      {data && (
        <div className="field-row">
          <button
            type="button"
            className="btn btn-primary"
            disabled={scanning}
            onClick={() => void scan()}
          >
            {scanning ? t.scanning : t.scan(refs.length)}
          </button>
          {scannedNote && <span className="hint">{scannedNote}</span>}
        </div>
      )}

      {events && events.length === 0 && <p className="muted">{t.empty}</p>}

      {events && events.length > 0 && (
        <>
          <label className="inline-field">
            <span>{t.filterConcept}</span>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as OutcomeConcept | 'ALL')}
            >
              <option value="ALL">{t.allConcepts}</option>
              {concepts.map((c) => (
                <option key={c} value={c}>
                  {conceptName(c)}
                </option>
              ))}
            </select>
          </label>

          <div className="stack">
            {concepts
              .filter((c) => filter === 'ALL' || c === filter)
              .map((c) => {
                const sum = summarizeExcursions(
                  events.filter((e) => e.concept === c),
                  HORIZONS,
                )[lastHorizonIdx]!;
                return (
                  <p key={c} className="hint">
                    <strong>{t.summaryTitle(conceptName(c))}:</strong>{' '}
                    {t.summaryRow(
                      sum.n,
                      sum.avgMfe.toFixed(5),
                      sum.avgMae.toFixed(5),
                      sum.controlAvgMfe.toFixed(5),
                    )}
                    {sum.n < 30 && <> · {t.lowSample}</>}
                  </p>
                );
              })}
          </div>

          <table className="events-table">
            <thead>
              <tr>
                <th>{t.table.concept}</th>
                <th>{t.table.direction}</th>
                <th>{t.table.confirmedAt}</th>
                <th>{t.table.horizon(HORIZONS[lastHorizonIdx]!)}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((e) => {
                const exc = e.excursions[lastHorizonIdx] ?? null;
                const ctrl = e.control[lastHorizonIdx] ?? null;
                return (
                  <tr key={e.id}>
                    <td>{conceptName(e.concept)}</td>
                    <td>
                      {e.direction === 'BULLISH'
                        ? tr.concepts.kinds.BULLISH
                        : tr.concepts.kinds.BEARISH}
                    </td>
                    <td>{formatTime(e.confirmedAt, displayTz)}</td>
                    <td>
                      {exc
                        ? `${t.table.mfe} ${exc.mfe.toFixed(5)} / ${t.table.mae} ${exc.mae.toFixed(5)}` +
                          (ctrl
                            ? ` (${t.table.control}: ${ctrl.mfe.toFixed(5)} / ${ctrl.mae.toFixed(5)})`
                            : '')
                        : t.table.pending}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
