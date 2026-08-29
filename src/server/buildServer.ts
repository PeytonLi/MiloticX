import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { extractSteps } from '../extract/index.js';
import { classifyFailure } from '../classify/index.js';
import { buildReportFromFlat } from '../report/flat.js';
import { fingerprint } from '../ledger/index.js';
import { createMemoryStore, reverify, type LedgerStore } from '../ledger/store.js';

export function buildServer(store: LedgerStore = createMemoryStore()): McpServer {
  const server = new McpServer({ name: 'readme-verifier', version: '0.1.0' });

  server.registerTool(
    'extract_steps',
    {
      description: 'Extract the ordered list of setup commands from a README (Markdown). Returns a JSON array of steps.',
      inputSchema: z.object({ markdown: z.string() }),
    },
    async ({ markdown }) => {
      const steps = extractSteps(markdown);
      return { content: [{ type: 'text', text: JSON.stringify(steps) }] };
    },
  );

  server.registerTool(
    'classify_failure',
    {
      description:
        'Classify a single command execution result into a failure category: success, missing-dependency, outdated-command, interactive-prompt, needs-secrets, or unknown.',
      inputSchema: z.object({
        exit_code: z.number().nullable(),
        stdout: z.string(),
        stderr: z.string(),
        timed_out: z.boolean(),
      }),
    },
    async ({ exit_code, stdout, stderr, timed_out }) => {
      const category = classifyFailure({ exitCode: exit_code, stdout, stderr, timedOut: timed_out });
      return { content: [{ type: 'text', text: category }] };
    },
  );

  server.registerTool(
    'build_report',
    {
      description:
        'Render a deterministic Markdown verification report. Pass the repo and a flat list of outcomes: [{ command, category, exit_code, stderr?, fix_diff? }]. category is one of success, missing-dependency, outdated-command, interactive-prompt, needs-secrets, docs-drift, unknown.',
      inputSchema: z.object({
        repo: z.string(),
        outcomes: z.array(
          z.object({
            command: z.string(),
            category: z.string(),
            exit_code: z.number().nullable(),
            stderr: z.string().optional(),
            fix_diff: z.string().optional(),
          }),
        ),
      }),
    },
    async ({ repo, outcomes }) => {
      return { content: [{ type: 'text', text: buildReportFromFlat(repo, outcomes) }] };
    },
  );

  server.registerTool(
    'fingerprint',
    {
      description:
        'Compute a normalized SHA-256 fingerprint of a README, used for incremental verification (skip re-execution when unchanged).',
      inputSchema: z.object({ markdown: z.string() }),
    },
    async ({ markdown }) => {
      return { content: [{ type: 'text', text: fingerprint(markdown) }] };
    },
  );

  server.registerTool(
    'ledger_check',
    {
      description:
        'Check whether a repo needs re-verification given a README fingerprint. Returns { reverify, record } where reverify is false when the stored fingerprint matches (the README is unchanged since the last run).',
      inputSchema: z.object({ repo: z.string(), fingerprint: z.string() }),
    },
    async ({ repo, fingerprint: fp }) => {
      const record = store.get(repo);
      return { content: [{ type: 'text', text: JSON.stringify({ reverify: reverify(record, fp), record }) }] };
    },
  );

  server.registerTool(
    'ledger_record',
    {
      description:
        'Record a verification result for a repo (repo, README fingerprint, and a one-line summary). Enables skipping re-execution on the next run.',
      inputSchema: z.object({ repo: z.string(), fingerprint: z.string(), summary: z.string() }),
    },
    async ({ repo, fingerprint: fp, summary }) => {
      store.put({ repo, fingerprint: fp, summary, verifiedAt: new Date().toISOString() });
      return { content: [{ type: 'text', text: 'ok' }] };
    },
  );

  return server;
}
