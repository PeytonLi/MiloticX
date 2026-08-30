'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
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
  finalReport,
  ingestStreamEvent,
  isPausedTurnDone,
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
  const resolvedRef = useRef<string[]>([]);
  const bump = () => setTick((t) => t + 1);

  function persistSnapshot() {
    localStorage.setItem(
      STORAGE_KEY,
      serializeSnapshot({
        sessionId,
        repo,
        report,
        order: orderRef.current,
        events: [...indexRef.current.entries()],
        resolvedToolCallIds: resolvedRef.current,
      }),
    );
  }

  useEffect(() => {
    const snap = parseSnapshot(localStorage.getItem(STORAGE_KEY));
    if (snap) {
      setRepo(snap.repo);
      setReport(snap.report);
      setSessionId(snap.sessionId);
      indexRef.current = new Map(snap.events) as Map<string, AnyEvent>;
      orderRef.current = snap.order;
      resolvedRef.current = snap.resolvedToolCallIds ?? [];
      const restored = pendingFromEvents(indexRef.current, resolvedRef.current);
      setPending(restored);
      if (restored.length > 0) {
        setReport(null);
      }
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    persistSnapshot();
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
    // Merge model.message.delta tool-call chunks into the base message.
    // Without this, extractApprovals cannot resolve the gated tool and the
    // Allow/Deny card never appears (timeline still shows "Paused").
    ingestStreamEvent(indexRef.current, orderRef.current, event);
    if (event.type === 'tool.approval_required' || isPausedTurnDone(event)) {
      setPending(pendingFromEvents(indexRef.current, resolvedRef.current));
    }
    if (event.type === 'turn.done') {
      if (!isPausedTurnDone(event)) {
        const r = finalReport(indexRef.current);
        if (r) setReport(r);
      }
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
    resolvedRef.current = [];
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
    const held = pending;
    const inputs = buildApprovalInputs(held, decision);
    setPending([]);
    setRunning(true);
    setError(null);
    bump();
    let accepted = false;
    try {
      const res = await fetch('/api/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, approvals: inputs }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setPending(held);
        setError(data.error ?? `Request failed (${res.status})`);
        setRunning(false);
        bump();
        return;
      }
      accepted = true;
      // Headers 200: TrueForge accepted the resume. Persist before consuming SSE
      // so a reload mid-stream does not resurrect the gate. Failures after this
      // (stream errors) must not restore pending — the decision already landed.
      resolvedRef.current = [...new Set([...resolvedRef.current, ...held.map((p) => p.toolCallId)])];
      for (const input of inputs) {
        const id = `user-approval:${input.toolCallId}`;
        indexRef.current.set(id, input);
        orderRef.current.push(id);
      }
      persistSnapshot();
      bump();
      for await (const event of readSse(res)) processEvent(event as AnyEvent);
    } catch (err) {
      setError(String(err));
      setRunning(false);
      if (!accepted) setPending(held);
      bump();
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
    resolvedRef.current = [];
    localStorage.removeItem(STORAGE_KEY);
    bump();
  }

  return (
    <MotionConfig reducedMotion="user">
      <main className="app">
        <header className="masthead">
          <div className="brand-lockup">
            <div className="wordmark">
              <span className="mark" aria-hidden>
                <i />
              </span>
              MiloticX
            </div>
            <span className="product-type">README operations</span>
          </div>
          <div className="masthead-meta">
            <p className="tagline">See every move. Approve every consequence.</p>
            <span className="safety-chip">
              <i aria-hidden />
              Sandbox isolated
            </span>
          </div>
        </header>

        <StatusBoard status={status} didCount={timeline.length} />

        <AnimatePresence mode="wait">
          {pending.length > 0 && (
            <ApprovalGate
              key={pending.map((item) => item.toolCallId).join(':')}
              pending={pending}
              onAllow={() => approve('allow')}
              onDeny={() => approve('deny')}
            />
          )}
        </AnimatePresence>

        <LaunchPad
          repo={repo}
          running={running}
          locked={pending.length > 0}
          onChange={setRepo}
          onRun={run}
          onReset={reset}
        />

        <AnimatePresence>
          {error && (
            <motion.div
              className="error"
              role="alert"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              <span className="error-mark" aria-hidden />
              <div>
                <strong>Run interrupted</strong>
                <span>{error}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          className="workspace"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14, duration: 0.38 }}
        >
          <section className="panel log-panel">
            <header className="panel-head">
              <div>
                <span className="panel-kicker">Run trace</span>
                <h2>What happened</h2>
              </div>
              <span className="count">
                <i className={running || pending.length > 0 ? 'is-live' : ''} aria-hidden />
                {timeline.length} events
              </span>
            </header>
            <ActivityLog items={timeline} live={running || pending.length > 0} />
          </section>

          <section className="panel report-panel">
            <header className="panel-head">
              <div>
                <span className="panel-kicker">Generated artifact</span>
                <h2>Verification report</h2>
              </div>
              <span className={`count report-status${report ? ' is-ready' : ''}`}>
                <i aria-hidden />
                {report ? 'Ready' : 'Pending'}
              </span>
            </header>
            <AnimatePresence mode="wait">
              {report ? (
                <motion.pre
                  key="report"
                  className="report"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  {report}
                </motion.pre>
              ) : (
                <motion.div
                  key="empty-report"
                  className="report-empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <div className="report-blueprint" aria-hidden>
                    <span className="blueprint-head" />
                    <span />
                    <span />
                    <span className="short" />
                    <motion.i
                      animate={running ? { y: [0, 74, 0] } : { y: 0 }}
                      transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
                    />
                  </div>
                  <div>
                    <p className="empty-title">{running ? 'Building the evidence' : 'Report waiting room'}</p>
                    <p className="muted">
                      Results appear after the sandbox run. Public changes can only happen through the
                      approval checkpoint.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        </motion.div>
      </main>
    </MotionConfig>
  );
}
