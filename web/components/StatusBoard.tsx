'use client';

import type { RunPhase, RunStatus } from '../lib/timeline';

const PHASE_COPY: Record<RunPhase, { label: string }> = {
  idle: { label: 'Idle' },
  doing: { label: 'Doing' },
  waiting: { label: 'Waiting' },
  done: { label: 'Done' },
  error: { label: 'Error' },
};

export function StatusBoard({ status, didCount }: { status: RunStatus; didCount: number }) {
  const meta = PHASE_COPY[status.phase];

  return (
    <section className={`status-board phase-${status.phase}`} aria-live="polite">
      <div className="status-board-rail">
        <span className="status-pulse" aria-hidden />
        <div>
          <div className="status-kicker">{meta.label}</div>
          <h1 className="status-headline">{status.headline}</h1>
          <p className="status-detail">{status.detail}</p>
        </div>
      </div>
      <ol className="status-triad" aria-label="What the agent is doing, waiting on, and did">
        <li className={status.phase === 'doing' ? 'on' : ''}>
          <span className="triad-label">Doing</span>
          <span className="triad-value">
            {status.phase === 'doing' ? status.headline : status.phase === 'waiting' ? 'Paused' : '—'}
          </span>
        </li>
        <li className={status.phase === 'waiting' ? 'on' : ''}>
          <span className="triad-label">Waiting on</span>
          <span className="triad-value">
            {status.phase === 'waiting' ? 'Your approval' : status.phase === 'doing' ? 'Nothing — running' : '—'}
          </span>
        </li>
        <li className={status.phase === 'done' ? 'on' : ''}>
          <span className="triad-label">Did</span>
          <span className="triad-value">
            {didCount === 0 ? 'Nothing yet' : `${didCount} step${didCount === 1 ? '' : 's'} logged`}
          </span>
        </li>
      </ol>
    </section>
  );
}
