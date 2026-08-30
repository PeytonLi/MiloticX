import { describe, expect, it } from 'vitest';
import { parseSnapshot, serializeSnapshot, type Snapshot } from './persist';

function snapshot(): Snapshot {
  return {
    sessionId: 'sess-1',
    repo: 'owner/demo',
    report: '# Verification Report',
    order: ['e1', 'e2'],
    events: [
      ['e1', { type: 'turn.created', id: 'e1' }],
      ['e2', { type: 'turn.done', id: 'e2', state: { status: 'done' } }],
    ],
    resolvedToolCallIds: ['tc-9'],
  };
}

describe('serializeSnapshot / parseSnapshot', () => {
  it('round-trips a snapshot', () => {
    const parsed = parseSnapshot(serializeSnapshot(snapshot()));
    expect(parsed).toEqual(snapshot());
  });

  it('returns null for null/empty input', () => {
    expect(parseSnapshot(null)).toBeNull();
    expect(parseSnapshot('')).toBeNull();
  });

  it('returns null for invalid JSON', () => {
    expect(parseSnapshot('{not json')).toBeNull();
  });

  it('returns null when order/events are missing', () => {
    expect(parseSnapshot('{}')).toBeNull();
    expect(parseSnapshot('{"order":[],"events":[]}')).toEqual({
      order: [],
      events: [],
      resolvedToolCallIds: [],
    });
  });

  it('preserves event payloads exactly', () => {
    const s = snapshot();
    const parsed = parseSnapshot(serializeSnapshot(s));
    expect(parsed?.events[1]?.[1]).toEqual({ type: 'turn.done', id: 'e2', state: { status: 'done' } });
    expect(parsed?.resolvedToolCallIds).toEqual(['tc-9']);
  });
});
