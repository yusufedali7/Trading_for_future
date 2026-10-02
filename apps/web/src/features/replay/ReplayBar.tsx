import { useState } from 'react';
import type { IanaTz, UtcMs } from '@trw/engine';
import { formatTime } from '../../format';
import { tr } from '../../i18n/tr';

export const REPLAY_SPEEDS = [1000, 500, 200];

export interface ReplayBarProps {
  cursor: UtcMs | null;
  displayTz: IanaTz;
  playing: boolean;
  speedMs: number;
  atEnd: boolean;
  /** A trade is pending or open: no stepping back, no exit. */
  busy: boolean;
  onStart: (date: string) => void;
  onStep: (dir: 1 | -1) => void;
  onTogglePlay: () => void;
  onSpeed: (ms: number) => void;
  onExit: () => void;
}

export function ReplayBar(p: ReplayBarProps) {
  const [date, setDate] = useState('');

  if (p.cursor === null) {
    return (
      <form
        className="replay-bar"
        onSubmit={(e) => {
          e.preventDefault();
          if (date) p.onStart(date);
        }}
      >
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          aria-label={tr.replay.startDate}
        />
        <button type="submit" className="btn" disabled={!date}>
          {tr.replay.start}
        </button>
      </form>
    );
  }

  return (
    <div className="replay-bar active" role="group" aria-label={tr.replay.badge}>
      <span className="badge">{tr.replay.badge}</span>
      <span className="mono">{tr.replay.cursor(formatTime(p.cursor, p.displayTz))}</span>
      <button type="button" className="btn" onClick={() => p.onStep(-1)} disabled={p.busy}>
        {tr.replay.back}
      </button>
      <button type="button" className="btn" onClick={() => p.onStep(1)} disabled={p.atEnd}>
        {tr.replay.forward}
      </button>
      <button type="button" className="btn" onClick={p.onTogglePlay} disabled={p.atEnd}>
        {p.playing ? tr.replay.pause : tr.replay.play}
      </button>
      <label className="field">
        <span>{tr.replay.speed}</span>
        <select value={p.speedMs} onChange={(e) => p.onSpeed(Number(e.target.value))}>
          {REPLAY_SPEEDS.map((ms) => (
            <option key={ms} value={ms}>
              {tr.replay.speeds[ms]}
            </option>
          ))}
        </select>
      </label>
      <button type="button" className="btn" onClick={p.onExit} disabled={p.busy}>
        {tr.replay.exit}
      </button>
      <span className="hint">
        {p.busy ? tr.replay.busy : p.atEnd ? tr.replay.end : tr.replay.hint}
      </span>
    </div>
  );
}
