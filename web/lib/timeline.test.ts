import { describe, it, expect } from 'vitest';
import {
  buildApprovalInputs,
  describeApproval,
  deriveRunStatus,
  eventToTimelineItem,
  extractApprovals,
  finalReport,
  humanToolLabel,
  isDeltaEvent,
  isIrreversibleTool,
  isPausedTurnDone,
  pendingFromEvents,
} from './timeline';

describe('isDeltaEvent', () => {
  it('is true for delta types', () => {
    expect(isDeltaEvent({ type: 'model.message.delta' })).toBe(true);
  });
  it('is false for non-delta types', () => {
    expect(isDeltaEvent({ type: 'model.message' })).toBe(false);
    expect(isDeltaEvent({})).toBe(false);
  });
});

describe('humanToolLabel', () => {
  it('maps known tools to plain English', () => {
    expect(humanToolLabel('extract_steps')).toMatch(/Extract/i);
    expect(humanToolLabel('create_pull_request')).toMatch(/pull request/i);
  });
  it('falls back to spaced names', () => {
    expect(humanToolLabel('some_custom_tool')).toBe('some custom tool');
  });
});

describe('eventToTimelineItem', () => {
  it('maps turn.created', () => {
    const item = eventToTimelineItem({ type: 'turn.created', id: '1', threadId: null });
    expect(item?.kind).toBe('turn-start');
    expect(item?.title).toMatch(/Started/i);
  });

  it('maps mcp.initialize with server names', () => {
    const item = eventToTimelineItem({
      type: 'mcp.initialize',
      id: '2',
      threadId: 'main',
      mcpServers: [{ name: 'github' }, { name: 'readme-verifier' }],
    });
    expect(item?.kind).toBe('mcp');
    expect(item?.detail).toContain('github');
    expect(item?.detail).toContain('readme-verifier');
  });

  it('maps sandbox.created', () => {
    const item = eventToTimelineItem({ type: 'sandbox.created', id: '3', threadId: 'main', sandboxId: 'sbx-1' });
    expect(item?.kind).toBe('sandbox');
    expect(item?.detail).toBe('sbx-1');
  });

  it('maps model.message with tool calls to a Running title', () => {
    const item = eventToTimelineItem({
      type: 'model.message',
      id: '4',
      threadId: 'main',
      content: '',
      toolCalls: [{ id: 'tc1', function: { name: 'extract_steps', arguments: '{}' } }],
    });
    expect(item?.kind).toBe('message');
    expect(item?.title).toMatch(/Running/i);
    expect(item?.title).toMatch(/Extract/i);
  });

  it('maps model.message with text content only', () => {
    const item = eventToTimelineItem({ type: 'model.message', id: '5', threadId: 'main', content: 'hello' });
    expect(item?.kind).toBe('message');
    expect(item?.title).toBe('Thinking');
    expect(item?.detail).toBe('hello');
  });

  it('maps tool.response and truncates long content', () => {
    const item = eventToTimelineItem({
      type: 'tool.response',
      id: '6',
      threadId: 'main',
      toolCallId: 'tc1',
      content: 'x'.repeat(1000),
    });
    expect(item?.kind).toBe('tool-result');
    expect(item?.detail?.length).toBeLessThan(450);
  });

  it('maps subagent thread events', () => {
    expect(eventToTimelineItem({ type: 'thread.created', id: '7', threadId: 'sub', title: 'research' })?.kind).toBe(
      'subagent-start',
    );
    expect(eventToTimelineItem({ type: 'thread.done', id: '8', threadId: 'sub', title: 'research' })?.kind).toBe(
      'subagent-end',
    );
  });

  it('maps tool.approval_required', () => {
    const item = eventToTimelineItem({ type: 'tool.approval_required', id: '9', threadId: 'main' });
    expect(item?.kind).toBe('approval');
    expect(item?.title).toMatch(/approval/i);
  });

  it('maps paused turn.done to an approval item, not Finished', () => {
    const item = eventToTimelineItem({
      type: 'turn.done',
      id: 'p',
      threadId: 'main',
      state: { status: 'waiting_for_approval', requiredActions: [{ id: 'tc-9' }] },
    });
    expect(item?.kind).toBe('approval');
    expect(item?.title).toMatch(/approval/i);
  });

  it('maps turn.done with status', () => {
    const item = eventToTimelineItem({ type: 'turn.done', id: '10', threadId: null, state: { status: 'done' } });
    expect(item?.kind).toBe('turn-end');
    expect(item?.title).toBe('Finished');
  });

  it('maps terminal turn.done with leftover requiredActions as Finished', () => {
    const item = eventToTimelineItem({
      type: 'turn.done',
      id: '10',
      threadId: 'main',
      state: { status: 'done', requiredActions: [{ id: 'tc-9' }] },
    });
    expect(item?.kind).toBe('turn-end');
    expect(item?.title).toBe('Finished');
  });

  it('returns null for unknown events', () => {
    expect(eventToTimelineItem({ type: 'weird.event', id: '11' })).toBeNull();
  });
});

describe('extractApprovals', () => {
  it('resolves tool name and args from the source model.message', () => {
    const events = new Map<string, any>([
      [
        'msg-1',
        {
          type: 'model.message',
          id: 'msg-1',
          threadId: 'main',
          toolCalls: [{ id: 'tc-9', function: { name: 'create_pull_request', arguments: '{"repo":"x"}' } }],
        },
      ],
    ]);
    const approvals = extractApprovals(
      { type: 'tool.approval_required', threadId: 'main', toolCalls: [{ id: 'tc-9', sourceEventId: 'msg-1' }] },
      events,
    );
    expect(approvals).toHaveLength(1);
    expect(approvals[0]?.toolName).toBe('create_pull_request');
    expect(approvals[0]?.toolCallId).toBe('tc-9');
    expect(approvals[0]?.arguments).toContain('repo');
  });

  it('skips refs whose source event is missing', () => {
    const approvals = extractApprovals(
      { type: 'tool.approval_required', threadId: 'main', toolCalls: [{ id: 'tc-x', sourceEventId: 'gone' }] },
      new Map(),
    );
    expect(approvals).toHaveLength(0);
  });
});

describe('buildApprovalInputs', () => {
  const pending = [
    { threadId: 'main', toolCallId: 'tc-1', toolName: 'x', arguments: '{}', sourceEventId: 'm1' },
  ];

  it('builds allow inputs', () => {
    const inputs = buildApprovalInputs(pending, 'allow');
    expect(inputs[0]).toEqual({
      type: 'user.tool_approval',
      threadId: 'main',
      toolCallId: 'tc-1',
      approval: { status: 'allow' },
    });
  });

  it('builds deny inputs with a reason', () => {
    const inputs = buildApprovalInputs(pending, 'deny', 'no thanks');
    expect(inputs[0]?.approval).toEqual({ status: 'deny', reason: 'no thanks' });
  });
});

describe('pendingFromEvents', () => {
  const msg = [
    'msg-1',
    {
      type: 'model.message',
      id: 'msg-1',
      toolCalls: [{ id: 'tc-9', function: { name: 'create_pull_request', arguments: '{}' } }],
    },
  ] as const;

  it('returns the latest unresolved approval', () => {
    const events = new Map<string, any>([
      msg,
      [
        'appr',
        { type: 'tool.approval_required', threadId: 'main', toolCalls: [{ id: 'tc-9', sourceEventId: 'msg-1' }] },
      ],
    ]);
    expect(pendingFromEvents(events)[0]?.toolName).toBe('create_pull_request');
  });

  it('keeps the gate after tool.approval_required followed by the paused turn\'s turn.done', () => {
    const events = new Map<string, any>([
      msg,
      [
        'appr',
        { type: 'tool.approval_required', threadId: 'main', toolCalls: [{ id: 'tc-9', sourceEventId: 'msg-1' }] },
      ],
      [
        'done',
        {
          type: 'turn.done',
          id: 'done',
          threadId: 'main',
          state: {
            status: 'waiting_for_approval',
            requiredActions: [{ id: 'tc-9', sourceEventId: 'msg-1' }],
          },
        },
      ],
    ]);
    expect(pendingFromEvents(events)).toHaveLength(1);
    expect(pendingFromEvents(events)[0]?.toolCallId).toBe('tc-9');
  });

  it('reconstructs the gate when paused turn.done requiredActions are id-only', () => {
    const events = new Map<string, any>([
      msg,
      [
        'appr',
        { type: 'tool.approval_required', threadId: 'main', toolCalls: [{ id: 'tc-9', sourceEventId: 'msg-1' }] },
      ],
      [
        'done',
        {
          type: 'turn.done',
          id: 'done',
          threadId: 'main',
          state: { status: 'waiting_for_approval', requiredActions: [{ id: 'tc-9' }] },
        },
      ],
    ]);
    expect(isPausedTurnDone(events.get('done'))).toBe(true);
    const pending = pendingFromEvents(events);
    expect(pending).toHaveLength(1);
    expect(pending[0]?.toolName).toBe('create_pull_request');
    expect(pending[0]?.sourceEventId).toBe('msg-1');
  });

  it('clears after a matching user.tool_approval', () => {
    const events = new Map<string, any>([
      msg,
      [
        'appr',
        { type: 'tool.approval_required', threadId: 'main', toolCalls: [{ id: 'tc-9', sourceEventId: 'msg-1' }] },
      ],
      ['done', { type: 'turn.done', id: 'done', state: { status: 'waiting_for_approval' } }],
      [
        'allow',
        { type: 'user.tool_approval', threadId: 'main', toolCallId: 'tc-9', approval: { status: 'allow' } },
      ],
    ]);
    expect(pendingFromEvents(events)).toEqual([]);
  });

  it('clears after a later completed turn.done', () => {
    const events = new Map<string, any>([
      msg,
      [
        'appr',
        { type: 'tool.approval_required', threadId: 'main', toolCalls: [{ id: 'tc-9', sourceEventId: 'msg-1' }] },
      ],
      ['paused', { type: 'turn.done', id: 'paused', state: { status: 'waiting_for_approval' } }],
      ['done', { type: 'turn.done', id: 'done', state: { status: 'done' } }],
    ]);
    expect(pendingFromEvents(events)).toEqual([]);
  });

  it('clears snapshot-recorded ids even without a later turn.done', () => {
    const events = new Map<string, any>([
      msg,
      [
        'appr',
        { type: 'tool.approval_required', threadId: 'main', toolCalls: [{ id: 'tc-9', sourceEventId: 'msg-1' }] },
      ],
      [
        'done',
        {
          type: 'turn.done',
          id: 'done',
          threadId: 'main',
          state: {
            status: 'waiting_for_approval',
            requiredActions: [{ id: 'tc-9', sourceEventId: 'msg-1' }],
          },
        },
      ],
    ]);
    expect(pendingFromEvents(events, ['tc-9'])).toEqual([]);
  });

  for (const status of ['done', 'cancelled', 'error'] as const) {
    it(`clears when the first turn.done is explicitly ${status}`, () => {
      const events = new Map<string, any>([
        msg,
        [
          'appr',
          { type: 'tool.approval_required', threadId: 'main', toolCalls: [{ id: 'tc-9', sourceEventId: 'msg-1' }] },
        ],
        ['done', { type: 'turn.done', id: 'done', threadId: 'main', state: { status } }],
      ]);
      expect(pendingFromEvents(events)).toEqual([]);
    });

    it(`clears ${status} even when requiredActions is still populated`, () => {
      const doneEvent = {
        type: 'turn.done',
        id: 'done',
        threadId: 'main',
        state: { status, requiredActions: [{ id: 'tc-9' }] },
      };
      expect(isPausedTurnDone(doneEvent)).toBe(false);
      const events = new Map<string, any>([
        msg,
        [
          'appr',
          { type: 'tool.approval_required', threadId: 'main', toolCalls: [{ id: 'tc-9', sourceEventId: 'msg-1' }] },
        ],
        ['done', doneEvent],
      ]);
      expect(pendingFromEvents(events)).toEqual([]);
    });
  }

  it('keeps the gate for a status-less first turn.done (paused stream close)', () => {
    const events = new Map<string, any>([
      msg,
      [
        'appr',
        { type: 'tool.approval_required', threadId: 'main', toolCalls: [{ id: 'tc-9', sourceEventId: 'msg-1' }] },
      ],
      ['done', { type: 'turn.done', id: 'done', threadId: 'main' }],
    ]);
    expect(pendingFromEvents(events)).toHaveLength(1);
  });
});

describe('finalReport', () => {
  it('returns the last turn.done output content', () => {
    const events = new Map<string, any>([
      ['1', { type: 'turn.created', id: '1' }],
      ['2', { type: 'turn.done', id: '2', state: { status: 'done', output: { content: '# Verification Report' } } }],
    ]);
    expect(finalReport(events)).toBe('# Verification Report');
  });

  it('returns null when no done output', () => {
    expect(finalReport(new Map())).toBeNull();
  });

  it('falls back to a model.message that contains the verification report', () => {
    const events = new Map<string, any>([
      [
        '1',
        {
          type: 'model.message',
          id: '1',
          content: '## Verification Report\n\n| Step | Command |\n',
        },
      ],
      ['2', { type: 'turn.done', id: '2', state: { status: 'done' } }],
    ]);
    expect(finalReport(events)).toMatch(/Verification Report/);
  });
});

describe('isIrreversibleTool / describeApproval', () => {
  it('flags PR tools as irreversible', () => {
    expect(isIrreversibleTool('create_pull_request')).toBe(true);
    expect(isIrreversibleTool('extract_steps')).toBe(false);
  });

  it('summarizes approval in plain English', () => {
    const d = describeApproval({
      threadId: 'main',
      toolCallId: 'tc',
      toolName: 'create_pull_request',
      arguments: '{"owner":"acme","repo":"demo","title":"Fix README"}',
      sourceEventId: 'm',
    });
    expect(d.summary).toMatch(/pull request/i);
    expect(d.summary).toContain('acme');
    expect(d.risk).toMatch(/Nothing happens until you approve/i);
  });
});

describe('deriveRunStatus', () => {
  it('is idle with no activity', () => {
    const s = deriveRunStatus({ running: false, pending: [], timeline: [], report: null, error: null });
    expect(s.phase).toBe('idle');
  });

  it('is waiting when approvals are pending', () => {
    const s = deriveRunStatus({
      running: false,
      pending: [
        {
          threadId: 'main',
          toolCallId: 'tc',
          toolName: 'create_pull_request',
          arguments: '{}',
          sourceEventId: 'm',
        },
      ],
      timeline: [],
      report: null,
      error: null,
    });
    expect(s.phase).toBe('waiting');
    expect(s.headline).toMatch(/Waiting/i);
  });

  it('is doing while running', () => {
    const s = deriveRunStatus({
      running: true,
      pending: [],
      timeline: [{ id: '1', kind: 'sandbox', threadId: 'main', title: 'Opened isolated sandbox' }],
      report: null,
      error: null,
    });
    expect(s.phase).toBe('doing');
    expect(s.headline).toMatch(/sandbox/i);
  });

  it('is done when a report exists', () => {
    const s = deriveRunStatus({
      running: false,
      pending: [],
      timeline: [{ id: '1', kind: 'turn-end', threadId: null, title: 'Finished' }],
      report: '# ok',
      error: null,
    });
    expect(s.phase).toBe('done');
  });

  it('is error when an error string is set', () => {
    const s = deriveRunStatus({
      running: false,
      pending: [],
      timeline: [],
      report: null,
      error: 'boom',
    });
    expect(s.phase).toBe('error');
    expect(s.detail).toBe('boom');
  });
});
