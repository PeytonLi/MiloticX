import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createMemoryStore } from '../ledger/store.js';
import { buildServer } from './buildServer.js';

let client: Client;
let store: ReturnType<typeof createMemoryStore>;

beforeAll(async () => {
  store = createMemoryStore();
  const handler = createMcpHandler(() => buildServer(store));
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

describe('ledger MCP tools', () => {
  it('reports reverify=true for an unknown repo', async () => {
    const result = await client.callTool({
      name: 'ledger_check',
      arguments: { repo: 'owner/demo', fingerprint: 'abc123' },
    });
    const parsed = JSON.parse(textOf(result as { content: unknown[] }));
    expect(parsed.reverify).toBe(true);
    expect(parsed.record).toBeNull();
  });

  it('records a result, then reports reverify=false for a matching fingerprint', async () => {
    await client.callTool({
      name: 'ledger_record',
      arguments: { repo: 'owner/demo', fingerprint: 'abc123', summary: '3 passed, 1 failed' },
    });

    const result = await client.callTool({
      name: 'ledger_check',
      arguments: { repo: 'owner/demo', fingerprint: 'abc123' },
    });
    const parsed = JSON.parse(textOf(result as { content: unknown[] }));
    expect(parsed.reverify).toBe(false);
    expect(parsed.record.repo).toBe('owner/demo');
    expect(parsed.record.summary).toBe('3 passed, 1 failed');
  });

  it('reports reverify=true for a changed fingerprint', async () => {
    const result = await client.callTool({
      name: 'ledger_check',
      arguments: { repo: 'owner/demo', fingerprint: 'changed' },
    });
    const parsed = JSON.parse(textOf(result as { content: unknown[] }));
    expect(parsed.reverify).toBe(true);
  });
});
