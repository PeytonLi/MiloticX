import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { extractSteps } from '../extract/index.js';
import { classifyFailure } from '../classify/index.js';
import { buildReport } from '../report/index.js';
import { fingerprint } from '../ledger/index.js';
import type { Verification } from '../types.js';

export function buildServer(): McpServer {
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
        'Render a deterministic Markdown verification report from a Verification JSON string (see src/types.ts for the shape).',
      inputSchema: z.object({ verification_json: z.string() }),
    },
    async ({ verification_json }) => {
      try {
        const verification = JSON.parse(verification_json) as Verification;
        return { content: [{ type: 'text', text: buildReport(verification) }] };
      } catch (err) {
        return {
          content: [{ type: 'text', text: `Error parsing verification JSON: ${String(err)}` }],
          isError: true,
        };
      }
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

  return server;
}
