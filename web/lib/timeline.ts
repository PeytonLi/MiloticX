export type TimelineKind =
  | 'session'
  | 'turn-start'
  | 'mcp'
  | 'sandbox'
  | 'message'
  | 'tool-result'
  | 'subagent-start'
  | 'subagent-end'
  | 'approval'
  | 'turn-end';

export interface TimelineItem {
  id: string;
  kind: TimelineKind;
  threadId: string | null;
  title: string;
  detail?: string;
}

export interface PendingApproval {
  threadId: string;
  toolCallId: string;
  toolName: string;
  arguments: string;
  sourceEventId: string;
}

type AnyEvent = Record<string, any>;

function toolCallName(call: AnyEvent | undefined): string {
  return call?.function?.name ?? call?.toolInfo?.name ?? 'tool';
}

function toolCallArgs(call: AnyEvent | undefined): string {
  return call?.function?.arguments ?? call?.arguments ?? '';
}

function truncate(text: string, max = 400): string {
  const t = text ?? '';
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

export function isDeltaEvent(event: AnyEvent): boolean {
  return typeof event?.type === 'string' && event.type.endsWith('.delta');
}

export function eventToTimelineItem(event: AnyEvent): TimelineItem | null {
  const type = event?.type;
  const threadId = event?.threadId ?? null;
  const id = event?.id ?? `${type}-${Math.random()}`;

  switch (type) {
    case 'turn.created':
      return { id, kind: 'turn-start', threadId, title: 'Turn started' };
    case 'mcp.initialize': {
      const servers = (event?.mcpServers ?? []).map((s: AnyEvent) => s?.name).filter(Boolean).join(', ');
      return { id, kind: 'mcp', threadId, title: 'MCP connected', detail: servers || undefined };
    }
    case 'sandbox.created':
      return { id, kind: 'sandbox', threadId, title: 'Sandbox provisioned', detail: event?.sandboxId };
    case 'model.message': {
      const content = event?.content ?? '';
      const calls = event?.toolCalls ?? [];
      if (calls.length > 0) {
        const names = calls.map((c: AnyEvent) => toolCallName(c)).join(', ');
        return { id, kind: 'message', threadId, title: `Calling: ${names}`, detail: content || undefined };
      }
      return { id, kind: 'message', threadId, title: 'Agent', detail: content || undefined };
    }
    case 'tool.response': {
      const content = truncate(event?.content ?? '');
      return { id, kind: 'tool-result', threadId, title: `Tool result`, detail: content || undefined };
    }
    case 'thread.created':
      return { id, kind: 'subagent-start', threadId, title: `Subagent started: ${event?.title ?? ''}` };
    case 'thread.done':
      return { id, kind: 'subagent-end', threadId, title: `Subagent done: ${event?.title ?? ''}` };
    case 'tool.approval_required':
      return { id, kind: 'approval', threadId, title: 'Approval required' };
    case 'turn.done': {
      const status = event?.state?.status;
      const metrics = event?.state?.metrics;
      const detail = metrics ? `tokens: ${metrics.totalTokens ?? '?'}` : undefined;
      return { id, kind: 'turn-end', threadId, title: `Turn ${status}`, detail };
    }
    default:
      return null;
  }
}

export function extractApprovals(
  approvalEvent: AnyEvent,
  events: Map<string, AnyEvent>,
): PendingApproval[] {
  const threadId = approvalEvent?.threadId ?? 'main';
  const result: PendingApproval[] = [];
  for (const ref of approvalEvent?.toolCalls ?? []) {
    const source = events.get(ref?.sourceEventId);
    if (source?.type !== 'model.message') continue;
    const call = (source.toolCalls ?? []).find((c: AnyEvent) => c.id === ref?.id);
    result.push({
      threadId,
      toolCallId: ref?.id,
      toolName: toolCallName(call),
      arguments: toolCallArgs(call),
      sourceEventId: ref?.sourceEventId,
    });
  }
  return result;
}

export function buildApprovalInputs(
  approvals: PendingApproval[],
  status: 'allow' | 'deny',
  reason?: string,
): AnyEvent[] {
  return approvals.map((a) => ({
    type: 'user.tool_approval',
    threadId: a.threadId,
    toolCallId: a.toolCallId,
    approval:
      status === 'allow'
        ? { status: 'allow' }
        : { status: 'deny', reason: reason ?? 'denied by user' },
  }));
}

export function finalReport(events: Map<string, AnyEvent>): string | null {
  for (const event of events.values()) {
    if (event.type === 'turn.done' && event.state?.output?.content) {
      return event.state.output.content;
    }
  }
  return null;
}
