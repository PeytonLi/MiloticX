import { serve } from '@hono/node-server';
import { createMcpHonoApp } from '@modelcontextprotocol/hono';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { buildServer } from './buildServer.js';

const port = Number(process.env.PORT ?? 8791);

function hostOptions(): { host: string; allowedHosts?: string[] } {
  const allowed = process.env.ALLOWED_HOSTS?.trim();
  if (allowed === '*') {
    // No host validation (e.g. behind a Render/Heroku proxy where the Host header
    // is the public domain). Use with care — this disables DNS-rebinding protection.
    return { host: '0.0.0.0' };
  }
  if (allowed) {
    return {
      host: '0.0.0.0',
      allowedHosts: allowed
        .split(',')
        .map((h) => h.trim())
        .filter(Boolean),
    };
  }
  return { host: '0.0.0.0', allowedHosts: ['localhost', '127.0.0.1', 'host.docker.internal'] };
}

const handler = createMcpHandler(buildServer);
const app = createMcpHonoApp(hostOptions());
app.get('/healthz', (c) => c.text('ok'));
app.all('/mcp', (c) => handler.fetch(c.req.raw));

serve({ fetch: app.fetch, port, hostname: '0.0.0.0' }, () => {
  console.error(`[readme-verifier] MCP server listening on http://0.0.0.0:${port}/mcp`);
});
