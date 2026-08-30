'use client';

import { useEffect, useRef } from 'react';
import type { TimelineItem } from '../lib/timeline';

export function ActivityLog({ items, live }: { items: TimelineItem[]; live: boolean }) {
  const endRef = useRef<HTMLLIElement | null>(null);

  useEffect(() => {
    if (live) endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [items.length, live]);

  if (items.length === 0) {
    return (
      <div className="empty-log">
        <p className="empty-title">What it did will show up here</p>
        <p className="muted">
          Every tool call, sandbox run, and helper agent lands in this log — so you can always answer
          &ldquo;what just happened?&rdquo;
        </p>
      </div>
    );
  }

  return (
    <ol className="activity-log">
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <li
            key={item.id}
            ref={isLast ? endRef : undefined}
            className={`log-item kind-${item.kind}${isLast && live ? ' live' : ''}`}
          >
            <div className="log-lane">{item.lane ?? item.kind}</div>
            <div className="log-body">
              <div className="log-title">{item.title}</div>
              {item.detail && <pre className="log-detail">{item.detail}</pre>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
