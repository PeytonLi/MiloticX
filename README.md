# readme-verifier

An agent that verifies a repository's README by **actually running it**, then
fixes what's broken. Built on [TrueForge](https://trueforge.dev) for the
WeMakeDevs × TrueFoundry **Agent Harness Hackathon**.

The core insight: open-source onboarding rots. READMEs promise setup steps that
no longer run — a package was renamed, a command was deprecated, a version floor
moved. Nothing re-executes a README after it's written, so maintainers never
notice and contributors bounce. This agent does the re-execution, in a sandbox,
and pauses for a human before opening a fix PR.

## What's in this repo

The deterministic core is a small TypeScript library, built test-first. Each
module is pure and independently testable:

| Module | Responsibility |
|--------|----------------|
| `src/extract` | Parse a README into an ordered list of commands (`extractSteps`) |
| `src/classify` | Classify a command's result (`classifyFailure`) |
| `src/report` | Render a deterministic Markdown report (`buildReport`) |
| `src/ledger` | Fingerprint a README for incremental verification (`fingerprint`, `shouldReVerify`) |
| `src/verify` | Orchestrate extract → execute → classify → report (`verify`) |
| `src/sandbox` | Execute a shell command safely (`runCommand`, `createSandboxExecutor`) |
| `src/server` | MCP server exposing the pure tools (`extract_steps`, `classify_failure`, `build_report`, `fingerprint`) |

`src/types.ts` defines the shared contracts (`Step`, `StepResult`,
`StepOutcome`, `Verification`, `FailureCategory`).

`src/verify` composes the loop (extract → execute → classify → report) behind an
`Executor` interface, and `src/sandbox` provides a real executor that shells out
to a command and captures stdout/stderr/exit code with a timeout and tail-capping.
That pair is the local/test harness that proves the loop end-to-end (see
`src/sandbox/integration.test.ts`). In production, the agent runs the same loop
through the harness — the sandbox executes the commands, and the MCP tools carry
the deterministic logic.

`skills/readme-verification/SKILL.md` is the TrueForge skill pack: the reusable
methodology the agent loads to do README verification safely
(interactive-prompt detection, sudo handling, timeouts, report format).

## Requirements

- Node.js 22+ and [pnpm](https://pnpm.io)
- The deterministic library has no runtime deps. The MCP server uses
  `@modelcontextprotocol/*`, `@hono/node-server`, and `zod`. The web UI uses
  Next.js + React.

## Development

```sh
pnpm install
pnpm test            # vitest run — full suite, single pass
pnpm run typecheck   # tsc --noEmit
pnpm run test:watch  # vitest watch mode
pnpm run start:server  # run the MCP server on http://127.0.0.1:8791/mcp
```

CI (`.github/workflows/ci.yml`) runs the core `typecheck` + `test` and the web
`typecheck` + `test` + `build` on every push and PR.

## The MCP server

`npm run start:server` exposes the deterministic logic as four pure MCP tools so
the agent reaches tested code instead of hallucinating classification or report
formatting:

| Tool | Input | Output |
|------|-------|--------|
| `extract_steps` | `markdown` | ordered JSON steps |
| `classify_failure` | `exit_code`, `stdout`, `stderr`, `timed_out` | category |
| `build_report` | `verification_json` | Markdown report |
| `fingerprint` | `markdown` | hex fingerprint |

Commands still execute in the sandbox — these tools are pure, so nothing runs on
the host. See `agents/readme-verifier.json` for the agent spec that wires GitHub,
this MCP server, the skill, and the sandbox together.

## Web UI (mission control)

`web/` is a Next.js + React app that drives the agent through TrueForge's HTTP
API and shows what it is doing — the Savile Row (Best UI) track. Paste a repo
URL, and watch the live timeline (tool calls, sandbox, subagents), the approval
gate with Allow/Deny, and the rendered report.

```sh
cd web
pnpm install
pnpm dev            # http://localhost:3000
```

It proxies the TrueForge SSE turn stream through `/api/run` and `/api/approve`
(server-side, so there is no CORS issue), and streams events to the browser. Set
`TRUEFORGE_BASE_URL` (default `http://localhost:8790`) and `TRUEFORGE_AGENT`
(default `readme-verifier`) to point at your harness and saved agent.

## Wiring it into TrueForge

1. **Start the harness** — `npx @truefoundry/trueforge`, open `http://localhost:8790`.
2. **Start this MCP server** — `pnpm run start:server` (listens on `127.0.0.1:8791`).
3. **Connect the model** — Settings → Models → add your provider (e.g. DeepSeek).
4. **Connect GitHub** — Settings → Connectors → add the GitHub MCP server with your PAT.
5. **Connect this server** — Settings → Connectors → add a custom MCP server by URL,
   named `readme-verifier`:
   - TrueForge on the host: `http://127.0.0.1:8791/mcp`
   - TrueForge in Docker (Windows bug workaround): `http://host.docker.internal:8791/mcp`
6. **Add the skill** — Settings → Skills → import from this repo, folder `skills/readme-verification`.
7. **Add the sandbox** — Settings → Sandbox providers → Daytona → paste your API key.
8. **Create the agent** — apply `agents/readme-verifier.json` (or recreate it in the
   UI: pick the model, attach both connectors + the skill, enable the sandbox).

## How it maps to TrueForge

1. **GitHub MCP connector** — reads the README, forks, pushes a branch, opens the PR.
2. **Daytona sandbox** — each extracted step executes in isolation (sandbox-as-tool).
3. **Custom MCP server** — the four pure tools above carry the tested logic.
4. **Approvals** — the agent pauses before any public, semi-irreversible action.
5. **Subagents** — fan out per documented install path (macOS vs Linux, npm vs pnpm).
6. **Persistent sessions** — a long verification survives a reload, still holding for approval.
7. **Skills** — `SKILL.md` is the git-backed instruction pack the agent loads.

## Demo

`docs/DEMO.md` is the 3-minute demo script, mapped beat-by-beat to the judging
criteria — including the approval-gate moment the hackathon says "nobody films".

## Contributing

Changes land through pull requests, and the Qodo app is installed on the repo so
each PR gets a repository-aware review (required for the Best Code Quality track).

