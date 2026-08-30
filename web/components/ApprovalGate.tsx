'use client';

import { motion } from 'motion/react';
import { describeApproval, type PendingApproval } from '../lib/timeline';

function ShieldCheck() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M12 3 5 6v5c0 4.7 2.9 8 7 10 4.1-2 7-5.3 7-10V6l-7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function ArrowUpRight() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M7 17 17 7M8 7h9v9" />
    </svg>
  );
}

export function ApprovalGate({
  pending,
  onAllow,
  onDeny,
}: {
  pending: PendingApproval[];
  onAllow: () => void;
  onDeny: () => void;
}) {
  if (pending.length === 0) return null;
  const first = pending[0]!;
  const { summary, risk } = describeApproval(first);

  return (
    <motion.section
      className="gate"
      role="alertdialog"
      aria-labelledby="gate-title"
      aria-describedby="gate-desc"
      initial={{ opacity: 0, y: 18, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.99 }}
      transition={{ type: 'spring', stiffness: 240, damping: 26 }}
    >
      <div className="gate-beacon" aria-hidden>
        <motion.span
          animate={{ scale: [0.9, 1.45], opacity: [0.65, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
        />
        <i>
          <ShieldCheck />
        </i>
      </div>

      <div className="gate-main">
        <div className="gate-banner">
          <span className="gate-badge">
            <span className="gate-badge-dot" aria-hidden />
            Human checkpoint
          </span>
          <h2 id="gate-title">Your call. Nothing has changed yet.</h2>
          <p id="gate-desc" className="gate-lead">
            MiloticX reached a public action and suspended the run. Review the exact consequence, then allow it
            once or keep everything private.
          </p>
        </div>

        <div className="gate-card">
          <div className="gate-action-label">
            Proposed action
            <span className="gate-scope">One-time permission</span>
          </div>
          <div className="gate-summary">{summary}</div>
          <p className="gate-risk">{risk}</p>
          {pending.length > 1 && (
            <p className="gate-more">
              Plus {pending.length - 1} related gated action{pending.length > 2 ? 's' : ''}.
            </p>
          )}
          <details className="gate-raw">
            <summary>Inspect tool payload</summary>
            <pre>
              {first.toolName}
              {'\n'}
              {first.arguments || '{}'}
            </pre>
          </details>
        </div>

        <div className="gate-actions">
          <motion.button
            type="button"
            className="btn ok"
            onClick={onAllow}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
          >
            Allow this action
            <ArrowUpRight />
          </motion.button>
          <motion.button
            type="button"
            className="btn danger"
            onClick={onDeny}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.98 }}
          >
            Deny — keep private
          </motion.button>
        </div>
      </div>
    </motion.section>
  );
}
