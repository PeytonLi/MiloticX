'use client';

import { useEffect, useRef } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { TimelineItem } from '../lib/timeline';

function EventIcon({ kind }: { kind: TimelineItem['kind'] }) {
  if (kind === 'approval') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden>
        <path d="M12 3v9m0 4.5v.5" />
        <circle cx="12" cy="12" r="9" />
      </svg>
    );
  }
  if (kind === 'turn-end' || kind === 'subagent-end') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden>
        <path d="m7 12 3 3 7-7" />
        <circle cx="12" cy="12" r="9" />
      </svg>
    );
  }
  if (kind === 'sandbox') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden>
        <path d="M4 6h16v12H4zM8 10l2 2-2 2m4 0h4" />
      </svg>
    );
  }
  if (kind === 'mcp') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden>
        <circle cx="7" cy="7" r="3" />
        <circle cx="17" cy="17" r="3" />
        <path d="m9 9 6 6M17 4v5h-5" />
      </svg>
    );
  }
  if (kind === 'tool-result') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden>
        <path d="M5 5h14v14H5zM8 9h8M8 12h5M8 15h7" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M5 12h3l2.1-5.1L14 17l2-5h3" />
    </svg>
  );
}

export function ActivityLog({ items, live }: { items: TimelineItem[]; live: boolean }) {
  const endRef = useRef<HTMLLIElement | null>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (live) endRef.current?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'nearest' });
  }, [items.length, live, reduceMotion]);

  if (items.length === 0) {
    return (
      <motion.div className="empty-log" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div className="empty-radar" aria-hidden>
          <span />
          <i />
        </div>
        <div>
          <p className="empty-title">The trace starts here</p>
          <p className="muted">
            Tool calls, sandbox runs, and decisions will arrive as a readable audit trail.
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <ol className="activity-log">
      <AnimatePresence initial={false}>
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          const longDetail = Boolean(item.detail && item.detail.length > 180);
          return (
            <motion.li
              key={item.id}
              ref={isLast ? endRef : undefined}
              className={`log-item kind-${item.kind}${isLast && live ? ' live' : ''}`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              layout="position"
            >
              <div className="log-rail" aria-hidden>
                <span className="log-icon">
                  <EventIcon kind={item.kind} />
                </span>
                {isLast && live && (
                  <motion.i
                    className="log-live-ring"
                    animate={{ scale: [0.7, 1.45], opacity: [0.75, 0] }}
                    transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }}
                  />
                )}
              </div>
              <div className="log-body">
                <div className="log-meta">
                  <span className="log-lane">{item.lane ?? item.kind}</span>
                  <span className="log-sequence">{String(i + 1).padStart(2, '0')}</span>
                </div>
                <div className="log-title">{item.title}</div>
                {item.detail &&
                  (longDetail ? (
                    <details className="log-disclosure" open={isLast && live}>
                      <summary>Inspect output</summary>
                      <pre className="log-detail">{item.detail}</pre>
                    </details>
                  ) : (
                    <pre className="log-detail">{item.detail}</pre>
                  ))}
              </div>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ol>
  );
}
