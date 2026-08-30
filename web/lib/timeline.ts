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
      if (isPausedTurnDone(event)) {
        return {
          id,
          kind: 'approval',
          threadId,
          title: 'Paused — needs your approval',
          lane: 'Gate',
        };
      }
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

function isWaitingStatus(status: unknown): boolean {
  return (
    status === 'waiting_for_approval' ||
    status === 'requires_action' ||
    status === 'paused' ||
    status === 'approval_required'
  );
}

function isCompletedStatus(status: unknown): boolean {
  return status === 'done' || status === 'completed' || status === 'cancelled' || status === 'error';
}

function normalizeRequiredActions(event: AnyEvent): AnyEvent[] {
  const raw = event?.state?.requiredActions ?? event?.state?.required_actions ?? [];
  if (!Array.isArray(raw)) return [];
  return raw
    .map((a: AnyEvent) => ({
      id: a?.id ?? a?.toolCallId,
      sourceEventId: a?.sourceEventId,
    }))
    .filter((a: AnyEvent) => typeof a.id === 'string' && a.id.length > 0);
}

function refsByToolCallId(toolCalls: AnyEvent[] | undefined): Map<string, AnyEvent> {
  const map = new Map<string, AnyEvent>();
  for (const ref of toolCalls ?? []) {
    const id = ref?.id ?? ref?.toolCallId;
    if (typeof id !== 'string' || !id) continue;
    map.set(id, { id, sourceEventId: ref?.sourceEventId });
  }
  return map;
}

/** Keep sourceEventId from the last approval_required when turn.done only sends the tool-call id. */
function mergeApprovalRefs(previous: AnyEvent | null, incoming: AnyEvent[]): AnyEvent[] {
  const prior = refsByToolCallId(previous?.toolCalls);
  return incoming.map((a) => ({
    id: a.id,
    sourceEventId: a.sourceEventId ?? prior.get(a.id)?.sourceEventId,
  }));
}

/** TrueForge closes a paused approval stream with turn.done; that is not a resolution. */
export function isPausedTurnDone(event: AnyEvent): boolean {
  if (event?.type !== 'turn.done') return false;
  if (normalizeRequiredActions(event).length > 0) return true;
  return isWaitingStatus(event?.state?.status);
}

function asApprovalEvent(threadId: string, toolCalls: AnyEvent[]): AnyEvent {
  return { type: 'tool.approval_required', threadId, toolCalls };
}

/**
 * Rebuild pending approvals from stored events (page reload mid-gate).
 * A paused turn.done does not clear the gate. Only a matching allow/deny
 * (`user.tool_approval` or snapshot `resolvedToolCallIds`) or a later completed
 * turn does.
 */
export function pendingFromEvents(
  events: Map<string, AnyEvent>,
  resolvedToolCallIds: Iterable<string> = [],
): PendingApproval[] {
  const resolved = new Set(resolvedToolCallIds);
  let latest: AnyEvent | null = null;
  let pauseClosed = false;

  for (const event of events.values()) {
    if (event?.type === 'tool.approval_required') {
      latest = event;
      pauseClosed = false;
    }
    if (event?.type === 'user.tool_approval' && typeof event.toolCallId === 'string') {
      resolved.add(event.toolCallId);
    }
    if (event?.type !== 'turn.done') continue;

    const actions = normalizeRequiredActions(event);
    if (actions.length > 0) {
      latest = asApprovalEvent(
        event.threadId ?? latest?.threadId ?? 'main',
        mergeApprovalRefs(latest, actions),
      );
      pauseClosed = true;
      continue;
    }
    if (isWaitingStatus(event?.state?.status)) {
      pauseClosed = true;
      continue;
    }
    if (!latest) continue;

    // Explicit terminal statuses resolve the gate before any first-close fallback.
    if (isCompletedStatus(event?.state?.status)) {
      latest = null;
      pauseClosed = false;
      continue;
    }

    const open = extractApprovals(latest, events).filter((p) => !resolved.has(p.toolCallId));
    // Status-less first stream close after an unresolved approval is the pause.
    if (!pauseClosed && open.length > 0) {
      pauseClosed = true;
      continue;
    }
    if (pauseClosed) {
      latest = null;
      pauseClosed = false;
    }
  }

  if (!latest) return [];
  return extractApprovals(latest, events).filter((p) => !resolved.has(p.toolCallId));
}

export function extractApprovals(
  approvalEvent: AnyEvent,
  events: Map<string, AnyEvent>,
): PendingApproval[] {
  const threadId = approvalEvent?.threadId ?? 'main';
  const result: PendingApproval[] = [];
  for (const ref of approvalEvent?.toolCalls ?? []) {
    const toolCallId = ref?.id ?? ref?.toolCallId;
    if (typeof toolCallId !== 'string' || !toolCallId) continue;
    let source = events.get(ref?.sourceEventId);
    let call =
      source?.type === 'model.message'
        ? (source.toolCalls ?? []).find((c: AnyEvent) => c.id === toolCallId)
        : undefined;
    if (!call) {
      for (const event of events.values()) {
        if (event?.type !== 'model.message') continue;
        call = (event.toolCalls ?? []).find((c: AnyEvent) => c.id === toolCallId);
        if (call) {
          source = event;
          break;
        }
      }
    }
    if (!call) continue;
    result.push({
      threadId,
      toolCallId,
      toolName: toolCallName(call),
      arguments: toolCallArgs(call),
      sourceEventId: ref?.sourceEventId ?? source?.id,
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
