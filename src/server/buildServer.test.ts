import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildServer } from './buildServer.js';

let client: Client;

beforeAll(async () => {
  const handler = createMcpHandler(() => buildServer());
  const transport = new StreamableHTTPClientTransport(new URL('http://test.local/mcp'), {
    fetch: (url, init) => handler.fetch(new Request(url, init)),
  });
  client = new Client({ name: 'test', version: '1.0.0' });
  await client.connect(transport);
});

afterAll(async () => {
  await client.close();
});

function textOf(result: { content: unknown[] }): string {
  const block = result.content[0] as { text?: string };
  return block.text ?? '';
}

describe('readme-verifier MCP server', () => {
  it('exposes extract_steps and returns the ordered commands', async () => {
    const result = await client.callTool({
      name: 'extract_steps',
      arguments: { markdown: '```sh\nnpm install\nnpm test\n```' },
    });
    const steps = JSON.parse(textOf(result as { content: unknown[] }));
    expect(steps).toHaveLength(2);
    expect(steps[0].content).toBe('npm install');
    expect(steps[1].content).toBe('npm test');
  });

  it('classifies a command-not-found result as missing-dependency', async () => {
    const result = await client.callTool({
      name: 'classify_failure',
      arguments: { exit_code: 127, stdout: '', stderr: 'bash: foo: command not found', timed_out: false },
    });
    expect(textOf(result as { content: unknown[] })).toBe('missing-dependency');
  });

  it('computes a 64-char fingerprint', async () => {
    const result = await client.callTool({
      name: 'fingerprint',
      arguments: { markdown: '# hi\n\nnpm install' },
    });
    expect(textOf(result as { content: unknown[] })).toMatch(/^[0-9a-f]{64}$/);
  });

  it('renders a report containing the repo name', async () => {
    const result = await client.callTool({
      name: 'build_report',
      arguments: { repo: 'owner/demo', outcomes: [] },
    });
    expect(textOf(result as { content: unknown[] })).toContain('owner/demo');
  });
});
