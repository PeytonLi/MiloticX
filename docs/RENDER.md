# Deploying to Render

`render.yaml` is a [Render Blueprint](https://render.com/docs/blueprint-spec) that
stands up the three services on Render's free tier. Render runs Linux, so the
Windows ESM bug that blocks local `npx` on Windows never occurs.

## What it deploys

| Service | Runtime | Purpose |
|---|---|---|
| `trueforge` | Docker (`trueforge.Dockerfile`) | The harness, standalone mode, SQLite on a persistent disk |
| `readme-verifier-mcp` | Node | The custom MCP server (pure tools) |
| `readme-verifier-web` | Node (Next.js) | The mission-control UI |

## Deploy

1. Push this repo to GitHub, then in Render: **New → Blueprint**, pick the repo.
   Render provisions the three services from `render.yaml`.
2. Open `https://trueforge.onrender.com` and configure the harness exactly as you
   would locally (these live in its SQLite, not in the blueprint):
   - Settings → Models → DeepSeek (your key)
   - Settings → Connectors → GitHub (your PAT)
   - Settings → Connectors → **readme-verifier** by URL:
     `https://readme-verifier-mcp.onrender.com/mcp`
   - Settings → Skills → import from this repo, folder `skills/readme-verification`
   - Settings → Sandbox providers → Daytona (your key)
   - Create the agent from `agents/readme-verifier.json`
3. Open `https://readme-verifier-web.onrender.com`, paste a repo URL, verify.

> The only wiring difference from local is the `readme-verifier` MCP connector URL:
> it points at the hosted MCP service, not `host.docker.internal`.

## Security (important)

Standalone TrueForge has **no login**, and on Render it is on the public internet.
Anyone with the URL can drive the agent — which holds your GitHub, DeepSeek, and
Daytona keys. For a demo:

- Keep the deployment short-lived (deploy, record, tear down).
- Use **minimal-privilege keys** (GitHub PAT scoped to public repos; a low-balance
  DeepSeek key).
- For anything longer-lived, run TrueForge in **hosted mode** (Postgres + Redis)
  and enable OIDC login instead of standalone.

## Cold starts

Free-tier web services sleep after ~15 min of inactivity and cold-start in ~50s.
The first request after idle will be slow; the UI and MCP server will warm up
before the harness responds.
