'use client';

import { AnimatePresence, motion } from 'motion/react';
import type { RunPhase, RunStatus } from '../lib/timeline';

const PHASE_COPY: Record<RunPhase, { label: string; signal: string }> = {
  idle: { label: 'Standing by', signal: 'Ready' },
  doing: { label: 'Agent in motion', signal: 'Live' },
  waiting: { label: 'Human checkpoint', signal: 'Action needed' },
  done: { label: 'Run complete', signal: 'Verified' },
  error: { label: 'Run interrupted', signal: 'Attention' },
};

type Stage = 'doing' | 'waiting' | 'did';

function StageIcon({ stage }: { stage: Stage }) {
  if (stage === 'doing') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden>
        <path d="M5 12h3l2.1-5.1L14 17l2-5h3" />
      </svg>
    );
  }
  if (stage === 'waiting') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden>
        <path d="M12 3v9m0 4.5v.5" />
        <circle cx="12" cy="12" r="9" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="m7 12 3 3 7-7" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}

function stageState(stage: Stage, phase: RunPhase): 'active' | 'complete' | 'quiet' | 'error' {
  if (phase === 'error') return stage === 'doing' ? 'error' : 'quiet';
  if (phase === 'doing') return stage === 'doing' ? 'active' : 'quiet';
  if (phase === 'waiting') return stage === 'waiting' ? 'active' : stage === 'doing' ? 'complete' : 'quiet';
  if (phase === 'done') return stage === 'did' ? 'active' : 'complete';
  return 'quiet';
}

export function StatusBoard({ status, didCount }: { status: RunStatus; didCount: number }) {
  const meta = PHASE_COPY[status.phase];
  const stages: Array<{ stage: Stage; eyebrow: string; value: string; note: string }> = [
    {
      stage: 'doing',
      eyebrow: 'Doing',
      value:
        status.phase === 'doing'
          ? status.headline
          : status.phase === 'waiting'
            ? 'Paused safely'
            : status.phase === 'done'
              ? 'Work complete'
              : status.phase === 'error'
                ? 'Run stopped'
                : 'Ready to verify',
      note:
        status.phase === 'doing'
          ? 'Streaming live from the harness'
          : status.phase === 'waiting'
            ? 'Context saved at the checkpoint'
            : 'No process is running',
    },
    {
      stage: 'waiting',
      eyebrow: 'Waiting on',
      value:
        status.phase === 'waiting'
          ? 'Your decision'
          : status.phase === 'error'
            ? 'A retry'
            : status.phase === 'doing'
              ? 'Nothing'
              : 'No action',
      note:
        status.phase === 'waiting'
          ? 'Review the proposed action below'
          : status.phase === 'doing'
            ? 'The agent can continue autonomously'
            : 'There are no pending approvals',
    },
    {
      stage: 'did',
      eyebrow: 'Did',
      value: didCount === 0 ? 'Nothing yet' : `${didCount} event${didCount === 1 ? '' : 's'}`,
      note: didCount === 0 ? 'The audit trail starts with the run' : 'Every action captured in the audit trail',
    },
  ];

  return (
    <motion.section
      className={`status-board phase-${status.phase}`}
      aria-live="polite"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="status-atmosphere" aria-hidden>
        <motion.span
          className="status-sweep"
          animate={status.phase === 'doing' ? { x: ['-20%', '120%'] } : { x: '-20%' }}
          transition={{ duration: 3.2, repeat: Infinity, ease: 'linear', repeatDelay: 0.4 }}
        />
      </div>

      <header className="status-overview">
        <div className="status-identity">
          <div className="signal-orbit" aria-hidden>
            <motion.span
              className="signal-core"
              animate={
                status.phase === 'doing' || status.phase === 'waiting'
                  ? { scale: [1, 1.16, 1], opacity: [1, 0.82, 1] }
                  : { scale: 1, opacity: 1 }
              }
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            />
            <span className="signal-ring ring-one" />
            <span className="signal-ring ring-two" />
          </div>
          <div className="status-copy">
            <div className="status-kicker">
              <span className="status-signal">{meta.signal}</span>
              <span>{meta.label}</span>
            </div>
            <AnimatePresence mode="wait" initial={false}>
              <motion.h1
                key={status.headline}
                className="status-headline"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.22 }}
              >
                {status.headline}
              </motion.h1>
            </AnimatePresence>
            <p className="status-detail">{status.detail}</p>
          </div>
        </div>
        <div className="status-proof">
          <span className="proof-label">Environment</span>
          <span className="proof-value">
            <span className="proof-dot" aria-hidden />
            Isolated sandbox
          </span>
        </div>
      </header>

      <div className="flow-shell">
        <ol className="status-flow" aria-label="What the agent is doing, waiting on, and did">
          {stages.map((item, index) => {
            const state = stageState(item.stage, status.phase);
            return (
              <motion.li
                key={item.stage}
                className={`flow-stage stage-${item.stage} state-${state}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 + index * 0.06, duration: 0.28 }}
                layout
              >
                {state === 'active' && (
                  <motion.span
                    className="active-stage-glow"
                    layoutId="active-stage"
                    transition={{ type: 'spring', stiffness: 180, damping: 24 }}
                  />
                )}
                <div className="stage-topline">
                  <span className="stage-icon">
                    <StageIcon stage={item.stage} />
                  </span>
                  <span className="stage-number">0{index + 1}</span>
                  <span className="stage-state">
                    {state === 'active'
                      ? item.stage === 'waiting'
                        ? 'Needs you'
                        : 'Current'
                      : state === 'complete'
                        ? 'Complete'
                        : state === 'error'
                          ? 'Stopped'
                          : 'Standby'}
                  </span>
                </div>
                <div className="stage-content">
                  <span className="triad-label">{item.eyebrow}</span>
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.strong
                      key={item.value}
                      className="triad-value"
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.18 }}
                    >
                      {item.value}
                    </motion.strong>
                  </AnimatePresence>
                  <span className="stage-note">{item.note}</span>
                </div>
              </motion.li>
            );
          })}
        </ol>
      </div>
    </motion.section>
  );
}
