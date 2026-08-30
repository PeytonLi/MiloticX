'use client';

import { describeApproval, type PendingApproval } from '../lib/timeline';

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
    <section className="gate" role="alertdialog" aria-labelledby="gate-title" aria-describedby="gate-desc">
      <div className="gate-banner">
        <span className="gate-badge">Before anything public</span>
        <h2 id="gate-title">Approve this step?</h2>
        <p id="gate-desc" className="gate-lead">
          The agent is paused on purpose. It will not open a PR, push a branch, or change GitHub until you say yes.
        </p>
      </div>

      <div className="gate-card">
        <div className="gate-action-label">Proposed action</div>
        <div className="gate-summary">{summary}</div>
        <p className="gate-risk">{risk}</p>
        {pending.length > 1 && (
          <p className="gate-more">
            Plus {pending.length - 1} more gated tool call{pending.length > 2 ? 's' : ''}.
          </p>
        )}
        <details className="gate-raw">
          <summary>Technical details</summary>
          <pre>
            {first.toolName}
            {'\n'}
            {first.arguments || '{}'}
          </pre>
        </details>
      </div>

      <div className="gate-actions">
        <button type="button" className="btn danger" onClick={onDeny}>
          Deny — keep it private
        </button>
        <button type="button" className="btn ok" onClick={onAllow} autoFocus>
          Allow — do this once
        </button>
      </div>
    </section>
  );
}
