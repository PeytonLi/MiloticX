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

The `Executor` interface in `src/verify` is the seam where the TrueForge sandbox
plugs in: in production, the agent's sandbox tool implements
`Executor.run(step)`. In tests, a fake executor stands in.

`skills/readme-verification/SKILL.md` is the TrueForge skill pack: the reusable
methodology the agent loads to do README verification safely
(interactive-prompt detection, sudo handling, timeouts, report format).

## Requirements

- Node.js 22+
- The deterministic library has no runtime deps. The MCP server uses
  `@modelcontextprotocol/*`, `@hono/node-server`, and `zod`.

## Development

```sh
npm install
npm test          # vitest run — full suite, single pass
npm run test:watch  # vitest watch mode
npm run start:server  # run the MCP server on http://127.0.0.1:8791/mcp
```

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

## Wiring it into TrueForge

1. **Start the harness** — `npx @truefoundry/trueforge`, open `http://localhost:8790`.
2. **Start this MCP server** — `npm run start:server` (listens on `127.0.0.1:8791`).
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
