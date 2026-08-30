'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityLog } from '../components/ActivityLog';
import { ApprovalGate } from '../components/ApprovalGate';
import { LaunchPad } from '../components/LaunchPad';
import { StatusBoard } from '../components/StatusBoard';
import { parseSnapshot, serializeSnapshot, STORAGE_KEY } from '../lib/persist';
import { readSse } from '../lib/sse';
import {
  buildApprovalInputs,
  deriveRunStatus,
  eventToTimelineItem,
  extractApprovals,
  finalReport,
  isDeltaEvent,
  pendingFromEvents,
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
      setPending(pendingFromEvents(indexRef.current));
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

  const status = useMemo(
    () => deriveRunStatus({ running, pending, timeline, report, error }),
    // tick forces recompute when refs mutate
    [running, pending, report, error, tick],
  );

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

  async function approve(decision: 'allow' | 'deny') {
    if (!sessionId || pending.length === 0) return;
    const inputs = buildApprovalInputs(pending, decision);
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
    <main className="app">
      <header className="masthead">
        <div className="wordmark">
          <span className="mark" aria-hidden />
          README Verifier
        </div>
        <p className="tagline">
          Paste a repo. Watch the agent. Approve before anything public.
        </p>
      </header>

      <StatusBoard status={status} didCount={timeline.length} />

      <LaunchPad repo={repo} running={running} onChange={setRepo} onRun={run} onReset={reset} />

      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}

      <ApprovalGate pending={pending} onAllow={() => approve('allow')} onDeny={() => approve('deny')} />

      <div className="workspace">
        <section className="panel log-panel">
          <header className="panel-head">
            <h2>What it did</h2>
            <span className="count">{timeline.length} steps</span>
          </header>
          <ActivityLog items={timeline} live={running || pending.length > 0} />
        </section>

        <section className="panel report-panel">
          <header className="panel-head">
            <h2>Report</h2>
            {report && <span className="count">ready</span>}
          </header>
          {report ? (
            <pre className="report">{report}</pre>
          ) : (
            <div className="empty-log">
              <p className="empty-title">The report lands here</p>
              <p className="muted">
                After each step runs in the sandbox, the agent writes a verification report. A pull
                request is never opened from this panel — only from the approval gate.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
