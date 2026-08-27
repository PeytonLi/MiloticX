import { describe, it, expect } from 'vitest';
import {
  buildApprovalInputs,
  eventToTimelineItem,
  extractApprovals,
  finalReport,
  isDeltaEvent,
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

describe('eventToTimelineItem', () => {
  it('maps turn.created', () => {
    const item = eventToTimelineItem({ type: 'turn.created', id: '1', threadId: null });
    expect(item?.kind).toBe('turn-start');
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

  it('maps model.message with tool calls to a "Calling" title', () => {
    const item = eventToTimelineItem({
      type: 'model.message',
      id: '4',
      threadId: 'main',
      content: '',
      toolCalls: [{ id: 'tc1', function: { name: 'extract_steps', arguments: '{}' } }],
    });
    expect(item?.kind).toBe('message');
    expect(item?.title).toContain('extract_steps');
  });

  it('maps model.message with text content only', () => {
    const item = eventToTimelineItem({ type: 'model.message', id: '5', threadId: 'main', content: 'hello' });
    expect(item?.kind).toBe('message');
    expect(item?.title).toBe('Agent');
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
    expect(eventToTimelineItem({ type: 'tool.approval_required', id: '9', threadId: 'main' })?.kind).toBe('approval');
  });

  it('maps turn.done with status', () => {
    const item = eventToTimelineItem({ type: 'turn.done', id: '10', threadId: null, state: { status: 'done' } });
    expect(item?.kind).toBe('turn-end');
    expect(item?.title).toBe('Turn done');
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
});
