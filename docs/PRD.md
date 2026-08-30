# PRD — MiloticX

> An agent that verifies a repository's README by actually running it, then fixes what's broken.
> Built on TrueForge for the WeMakeDevs × TrueFoundry **Agent Harness Hackathon** (Aug 24–30, 2026).
> Target track: **Double-O (Best Use of TrueForge)**.

## 1. Problem

Open-source onboarding rots. READMEs promise setup steps that no longer run — a package was
renamed, a Node version floor moved, a command was deprecated, a path drifted. Maintainers
don't notice because nothing re-executes the README after it's written. Contributors hit the
first broken command and bounce.

Engineers use AI today by *asking what to check*. The harder, unsolved problem is an agent
that actually checks it. This project is a working answer: an agent that does the work, not
one that explains it.

## 2. Product

README Verifier is an agent, not a chat wrapper. Given a public GitHub repo URL, it:

1. Reads the README via a GitHub MCP connector and extracts the setup steps.
2. Provisions an isolated **Daytona sandbox** and clones the repo into it.
3. Executes each step, capturing `stdout`, `stderr`, and the exit code.
4. Fans out **subagents** in parallel when the README documents multiple install paths
   (macOS vs Linux, npm vs pnpm, Docker vs bare metal).
5. Classifies each failure:
   - `missing-dependency` — tool not installed
   - `outdated-command` — command/flag removed or renamed
   - `interactive-prompt` — step requires a human (`npm init`, `sudo`); skipped and flagged
   - `needs-secrets` — step requires credentials not safe to hand an agent
   - `docs-drift` — README text contradicts observed behavior
6. Investigates: checks installed tool versions, tries documented alternates, and (optionally)
   web-searches for the current install method.
7. Produces a **verification report**: per-step status table, exact failing commands, and a
   candidate README diff.
8. **Pauses for human approval** before any public, semi-irreversible action — forking the repo,
   pushing a fix branch, and opening the PR.
9. On approval, opens the PR with the report as a comment.

### Non-goals (v1)

- Not a general chat assistant.
- Not fixing code — only the README/documentation that is verifiably wrong.
- Not touching private repos or repos the user doesn't own/control.
- Not auto-merging anything, ever.

## 3. Users & personas

- **Solo maintainer** of a mid-size OSS project that's drifted out of date.
- **Hackathon judge** — needs to *see* the harness doing work in a 3-minute demo.

## 4. Scope: one narrow job, done end to end

The demo is three minutes. A single narrow job completed reliably beats a platform with three
half-finished features. The narrow job: **verify one repo's README and open one fix PR.**

## 5. Requirements

### Functional

| ID | Requirement | Priority |
|----|-------------|----------|
| F1 | Accept a public GitHub repo URL and begin verification | P0 |
| F2 | Execute README steps inside a Daytona sandbox, never on the host | P0 |
| F3 | Capture per-step stdout/stderr/exit code, tail-capped to protect context | P0 |
| F4 | Classify failures into the five categories above | P0 |
| F5 | Fan out subagents for parallel install paths | P0 |
| F6 | Generate a candidate README diff for verified failures | P0 |
| F7 | Pause for human approval before forking/pushing/opening a PR | P0 |
| F8 | Open the PR (from a fork) with the report as a comment on approval | P0 |
| F9 | Survive a page reload mid-verification (persistent session) | P0 |
| F10 | Package the execution methodology as a git-backed `SKILL.md` | P1 |
| F11 | Ledger: store per-repo README fingerprint + result; skip unchanged repos | P1 |
| F12 | (Stretch) Draft a summary and ask before sending via Gmail/Slack MCP | P2 |
| F13 | (Stretch) Custom mission-control UI via `@truefoundry/trueforge-ui` | P2 |

### Non-functional

| ID | Requirement |
|----|-------------|
| N1 | A stranger can clone, run, and understand the repo (README + Qodo-reviewed PRs) |
| N2 | No keys or personal data in the repo or the demo video |
| N3 | Only tools/accounts the user is authorized to connect |
| N4 | Code executes only in the sandbox; sensitive actions are approval-gated |
| N5 | Public repo, open source, MIT license |

## 6. Harness feature map (Double-O evidence)

| TrueForge feature | How the project uses it (must be visible in the demo) |
|-------------------|-------------------------------------------------------|
| **MCP connectors** | GitHub MCP to read the repo, fork, push, and open the PR |
| **Sandbox-as-tool** | Daytona sandbox is provisioned only when execution is needed; every install runs there |
| **Approvals** | Human checkpoint before the public act of opening a PR |
| **Subagents** | Parallel fan-out per documented install path |
| **Persistent sessions** | Reload the page mid-run and the session resumes, still holding for approval |
| **Skills** | `SKILL.md` encodes the "how to execute a README" methodology |
| **Multi-model** | Model is hot-swappable (cheap model for dev, any OpenAI-compatible endpoint) |

## 7. Success metrics

- Verifies a real, pre-scouted broken-README repo end to end and opens a correct fix PR.
- The approval pause is demonstrably on camera (the moment "nobody films").
- Demo runs ~3 minutes with no dead time.
- Qodo review trail exists from the first commit.
- A judge can clone the repo and run it on their own machine.
