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
  /** Short label for the activity rail (e.g. "Sandbox", "Tool"). */
  lane?: string;
}

export interface PendingApproval {
  threadId: string;
  toolCallId: string;
  toolName: string;
  arguments: string;
  sourceEventId: string;
}

/** High-level phase for the stranger-facing status board. */
export type RunPhase = 'idle' | 'doing' | 'waiting' | 'done' | 'error';

export interface RunStatus {
  phase: RunPhase;
  /** One-line headline: what the agent is doing / waiting on / finished. */
  headline: string;
  /** Supporting sentence for strangers. */
  detail: string;
  /** The most recent activity item, if any. */
  current: TimelineItem | null;
}

type AnyEvent = Record<string, any>;

const TOOL_LABELS: Record<string, string> = {
  extract_steps: 'Extract setup steps from README',
  classify_failure: 'Classify a failed command',
  build_report: 'Build the verification report',
  fingerprint: 'Fingerprint the README',
  ledger_check: 'Check if this README was verified before',
  ledger_record: 'Record this verification in the ledger',
  create_pull_request: 'Open a pull request',
  create_or_update_file: 'Write or update a file',
  push_files: 'Push files to a branch',
  fork_repository: 'Fork the repository',
  create_branch: 'Create a branch',
  get_file_contents: 'Read a file from GitHub',
  search_code: 'Search the repository',
  list_commits: 'List commits',
};

export function humanToolLabel(name: string): string {
  if (!name) return 'a tool';
  return TOOL_LABELS[name] ?? name.replace(/_/g, ' ');
}

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
      return { id, kind: 'turn-start', threadId, title: 'Started verification', lane: 'Start' };
    case 'mcp.initialize': {
      const servers = (event?.mcpServers ?? []).map((s: AnyEvent) => s?.name).filter(Boolean).join(', ');
      return {
        id,
        kind: 'mcp',
        threadId,
        title: 'Connected tools',
        detail: servers || undefined,
        lane: 'Tools',
      };
    }
    case 'sandbox.created':
      return {
        id,
        kind: 'sandbox',
        threadId,
        title: 'Opened isolated sandbox',
        detail: event?.sandboxId,
        lane: 'Sandbox',
      };
    case 'model.message': {
      const content = event?.content ?? '';
      const calls = event?.toolCalls ?? [];
      if (calls.length > 0) {
        const names = calls.map((c: AnyEvent) => toolCallName(c));
        const labels = names.map(humanToolLabel).join('; ');
        return {
          id,
          kind: 'message',
          threadId,
          title: `Running: ${labels}`,
          detail: content || names.join(', '),
          lane: 'Action',
        };
      }
      return {
        id,
        kind: 'message',
        threadId,
        title: 'Thinking',
        detail: content || undefined,
        lane: 'Agent',
      };
    }
    case 'tool.response': {
      const content = truncate(event?.content ?? '');
      return {
        id,
        kind: 'tool-result',
        threadId,
        title: 'Got a result',
        detail: content || undefined,
        lane: 'Result',
      };
    }
    case 'thread.created':
      return {
        id,
        kind: 'subagent-start',
        threadId,
        title: `Started a helper: ${event?.title ?? 'subagent'}`,
        lane: 'Helper',
      };
    case 'thread.done':
      return {
        id,
        kind: 'subagent-end',
        threadId,
        title: `Helper finished: ${event?.title ?? 'subagent'}`,
        lane: 'Helper',
      };
    case 'tool.approval_required':
      return {
        id,
        kind: 'approval',
        threadId,
        title: 'Paused — needs your approval',
        lane: 'Gate',
      };
    case 'turn.done': {
      const status = event?.state?.status;
      const metrics = event?.state?.metrics;
      const detail = metrics ? `tokens: ${metrics.totalTokens ?? '?'}` : undefined;
      return {
        id,
        kind: 'turn-end',
        threadId,
        title: status === 'done' || status === 'completed' ? 'Finished' : `Turn ${status}`,
        detail,
        lane: 'Done',
      };
    }
    default:
      return null;
  }
}

/** Rebuild pending approvals from stored events (page reload mid-gate). */
export function pendingFromEvents(events: Map<string, AnyEvent>): PendingApproval[] {
  let latest: AnyEvent | null = null;
  for (const event of events.values()) {
    if (event?.type === 'tool.approval_required') latest = event;
    if (event?.type === 'turn.done') latest = null;
  }
  return latest ? extractApprovals(latest, events) : [];
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

/** True when this tool would change something public / hard to undo. */
export function isIrreversibleTool(toolName: string): boolean {
  const n = toolName.toLowerCase();
  return (
    n.includes('pull_request') ||
    n.includes('push') ||
    n.includes('fork') ||
    n.includes('create_or_update') ||
    n.includes('delete') ||
    n.includes('merge') ||
    n.includes('commit')
  );
}

/** Plain-English summary of what approving will do. */
export function describeApproval(approval: PendingApproval): { summary: string; risk: string } {
  const label = humanToolLabel(approval.toolName);
  let hint = '';
  try {
    const args = JSON.parse(approval.arguments || '{}') as Record<string, unknown>;
    const bits: string[] = [];
    for (const key of ['owner', 'repo', 'title', 'path', 'branch', 'head', 'base']) {
      if (typeof args[key] === 'string' && args[key]) bits.push(`${key}: ${args[key]}`);
    }
    if (bits.length) hint = bits.join(' · ');
  } catch {
    /* keep raw args for the UI */
  }

  const irreversible = isIrreversibleTool(approval.toolName);
  return {
    summary: hint ? `${label} — ${hint}` : label,
    risk: irreversible
      ? 'This can change a public repository. Nothing happens until you approve.'
      : 'The agent is waiting for your go-ahead before continuing.',
  };
}

/**
 * Derive the three-pane status the prize asks for:
 * what the agent is doing, what it is waiting on, and what it did.
 */
export function deriveRunStatus(opts: {
  running: boolean;
  pending: PendingApproval[];
  timeline: TimelineItem[];
  report: string | null;
  error: string | null;
}): RunStatus {
  const { running, pending, timeline, report, error } = opts;

  if (error) {
    return {
      phase: 'error',
      headline: 'Something went wrong',
      detail: error,
      current: timeline[timeline.length - 1] ?? null,
    };
  }

  if (pending.length > 0) {
    const first = pending[0]!;
    const { summary, risk } = describeApproval(first);
    return {
      phase: 'waiting',
      headline: 'Waiting on you',
      detail: `${summary}. ${risk}`,
      current: timeline[timeline.length - 1] ?? null,
    };
  }

  if (running) {
    const current =
      [...timeline].reverse().find((t) => t.kind !== 'approval' && t.kind !== 'turn-end') ??
      timeline[timeline.length - 1] ??
      null;
    return {
      phase: 'doing',
      headline: current?.title ?? 'Working…',
      detail: current?.detail ?? 'The agent is verifying the README in an isolated sandbox.',
      current,
    };
  }

  if (report || timeline.some((t) => t.kind === 'turn-end')) {
    return {
      phase: 'done',
      headline: 'Done',
      detail: report
        ? 'Verification finished. Review the report below.'
        : 'The run finished. Check the timeline for what happened.',
      current: timeline[timeline.length - 1] ?? null,
    };
  }

  return {
    phase: 'idle',
    headline: 'Ready when you are',
    detail: 'Paste a GitHub repo URL and press Verify. You’ll see every step — and you’ll be asked before anything public.',
    current: null,
  };
}
