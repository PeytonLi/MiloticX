'use client';

import { useEffect, useRef, useState } from 'react';
import { parseSnapshot, serializeSnapshot, STORAGE_KEY } from '../lib/persist';
import { readSse } from '../lib/sse';
import {
  buildApprovalInputs,
  eventToTimelineItem,
  extractApprovals,
  finalReport,
  isDeltaEvent,
  type PendingApproval,
  type TimelineItem,
} from '../lib/timeline';

type AnyEvent = Record<string, any>;

export default function Page() {
  const [repo, setRepo] = useState('');
  const [running, setRunning] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingApproval[]>([]);
  const [report, setReport] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [hydrated, setHydrated] = useState(false);

  const indexRef = useRef(new Map<string, AnyEvent>());
  const orderRef = useRef<string[]>([]);
  const bump = () => setTick((t) => t + 1);

  useEffect(() => {
    const snap = parseSnapshot(localStorage.getItem(STORAGE_KEY));
    if (snap) {
      setRepo(snap.repo);
      setReport(snap.report);
      setSessionId(snap.sessionId);
      indexRef.current = new Map(snap.events) as Map<string, AnyEvent>;
      orderRef.current = snap.order;
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(
      STORAGE_KEY,
      serializeSnapshot({
        sessionId,
        repo,
        report,
        order: orderRef.current,
        events: [...indexRef.current.entries()],
      }),
    );
  }, [hydrated, tick, sessionId, repo, report]);

  const timeline: TimelineItem[] = orderRef.current
    .map((id) => indexRef.current.get(id))
    .filter((e): e is AnyEvent => e !== undefined)
    .map((e) => eventToTimelineItem(e))
    .filter((x): x is TimelineItem => x !== null);

  function processEvent(event: AnyEvent) {
    if (!event || typeof event !== 'object') return;
    if (event.type === 'session') {
      setSessionId(event.sessionId);
      return;
    }
    if (event.type === 'error') {
      setError(event.message ?? 'unknown error');
      setRunning(false);
      return;
    }
    if (isDeltaEvent(event)) {
      const base = indexRef.current.get(event.id);
      if (base) base.content = (base.content ?? '') + (event.content ?? '');
    } else {
      indexRef.current.set(event.id, event);
      orderRef.current.push(event.id);
    }
    if (event.type === 'tool.approval_required') {
      setPending(extractApprovals(event, indexRef.current));
    }
    if (event.type === 'turn.done') {
      const r = finalReport(indexRef.current);
      if (r) setReport(r);
      setRunning(false);
    }
    bump();
  }

  async function run() {
    if (!repo.trim() || running) return;
    setRunning(true);
    setError(null);
    setReport(null);
    setPending([]);
    setSessionId(null);
    indexRef.current = new Map();
    orderRef.current = [];
    bump();

    try {
      const res = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo: repo.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `Request failed (${res.status})`);
        setRunning(false);
        return;
      }
      for await (const event of readSse(res)) processEvent(event as AnyEvent);
    } catch (err) {
      setError(String(err));
      setRunning(false);
    }
  }

  async function approve(status: 'allow' | 'deny') {
    if (!sessionId || pending.length === 0) return;
    const inputs = buildApprovalInputs(pending, status);
    setPending([]);
    setRunning(true);
    setError(null);
    try {
      const res = await fetch('/api/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, approvals: inputs }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `Request failed (${res.status})`);
        setRunning(false);
        return;
      }
      for await (const event of readSse(res)) processEvent(event as AnyEvent);
    } catch (err) {
      setError(String(err));
      setRunning(false);
    }
  }

  function reset() {
    setRepo('');
    setReport(null);
    setSessionId(null);
    setPending([]);
    setError(null);
    indexRef.current = new Map();
    orderRef.current = [];
    localStorage.removeItem(STORAGE_KEY);
    bump();
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="dot" />
          README Verifier
          <span className="muted">· mission control</span>
        </div>
        <div className={`status ${running ? 'live' : ''}`}>{running ? '● running' : 'idle'}</div>
      </header>

      <section className="controls">
        <input
          className="repo-input"
          placeholder="github.com/owner/repo"
          value={repo}
          onChange={(e) => setRepo(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && run()}
          spellCheck={false}
        />
        <button className="btn" onClick={run} disabled={running || !repo.trim()}>
          {running ? 'Verifying…' : 'Verify README'}
        </button>
        <button className="btn ghost" onClick={reset} disabled={running}>
          Reset
        </button>
      </section>

      {error && <div className="error">{error}</div>}

      {pending.length > 0 && (
        <section className="gate">
          <div className="gate-title">Approval required</div>
          <p className="gate-body">
            The agent wants to run <code>{pending[0]?.toolName}</code>. This action is public and may be
            irreversible.
          </p>
          <pre className="gate-args">{pending[0]?.arguments ?? '{}'}</pre>
          <div className="gate-actions">
            <button className="btn danger" onClick={() => approve('deny')}>
              Deny
            </button>
            <button className="btn ok" onClick={() => approve('allow')}>
              Approve
            </button>
          </div>
        </section>
      )}

      <section className="columns">
        <div className="panel">
          <h2>Timeline</h2>
          {timeline.length === 0 && <p className="muted">No activity yet.</p>}
          <ul className="timeline">
            {timeline.map((item) => (
              <li key={item.id} className={`tl tl-${item.kind}`}>
                <div className="tl-title">{item.title}</div>
                {item.detail && <div className="tl-detail">{item.detail}</div>}
              </li>
            ))}
          </ul>
        </div>

        <div className="panel">
          <h2>Report</h2>
          {report ? <pre className="report">{report}</pre> : <p className="muted">The verification report will appear here.</p>}
        </div>
      </section>
    </main>
  );
}
