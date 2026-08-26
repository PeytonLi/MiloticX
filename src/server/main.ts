import { serve } from '@hono/node-server';
import { createMcpHonoApp } from '@modelcontextprotocol/hono';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { buildServer } from './buildServer.js';

const port = Number(process.env.PORT ?? 8791);

const handler = createMcpHandler(buildServer);
const app = createMcpHonoApp({
  host: '0.0.0.0',
  allowedHosts: ['localhost', '127.0.0.1', 'host.docker.internal'],
});
app.all('/mcp', (c) => handler.fetch(c.req.raw));

serve({ fetch: app.fetch, port, hostname: '0.0.0.0' }, () => {
  console.error(`[readme-verifier] MCP server listening on http://0.0.0.0:${port}/mcp`);
});
