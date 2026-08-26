# Build Plan — README Verifier

> One-day build plan for the TrueForge **Agent Harness Hackathon**.
> See `docs/PRD.md` for requirements and scope.

## 0. Pre-hackathon prep (outside the build window)

- [ ] Create a GitHub **fine-grained PAT** (public repo: read + fork + PR) — for the GitHub MCP server.
- [ ] Create a **Daytona API key** (sandbox provider) with the minimum required permissions.
- [ ] Choose a model provider + key (cheap model for dev; keep an OpenAI-compatible endpoint handy).
- [ ] **Scout 2–3 real public repos with broken READMEs.** Verify *by hand* that a step actually
      fails. Candidates: older CLIs, packages renamed on npm, Node version floors that moved.
- [ ] Install Node.js 22+ and confirm `npx @truefoundry/trueforge` boots.

## 1. Schedule (10 hours)

### H0–1 — Setup & the review trail starts
- [ ] Run `npx @truefoundry/trueforge`; open `http://localhost:8790`.
- [ ] Configure model provider (Settings → Models).
- [ ] Connect GitHub MCP + Daytona (Settings → Connectors / Sandbox providers).
- [ ] `git init` the project repo, add `.gitignore` (exclude keys, `.env`, `sqlite`).
- [ ] **Install Qodo on the repo** and open the first PR (initial commit) — review trail begins.

### H1–3 — Skeleton: verify a single path
- [ ] Agent reads README via GitHub MCP and extracts ordered setup steps.
- [ ] Provision Daytona sandbox, clone repo, run steps, capture per-step logs + exit code.
- [ ] Emit a structured verification report (JSON/Markdown).
- [ ] **Milestone:** the agent verifies *any* repo from a URL.

### H3–5 — Fix loop + approval gate
- [ ] Failure classification (missing-dependency / outdated-command / interactive-prompt /
      needs-secrets / docs-drift).
- [ ] Investigation: `--version` checks, documented alternates.
- [ ] Generate candidate README diff.
- [ ] Fork → push fix branch → draft PR, **gated on approval** before any public action.

### H5–7 — Harness depth
- [ ] Subagent fan-out for parallel install paths.
- [ ] Package methodology into `SKILL.md` (interactive-step detection, `sudo` handling, timeouts).
- [ ] Verify session persistence across a reload, still holding for approval.
- [ ] Ledger via the user's database connector: README fingerprint + result; skip unchanged repos.

### H7–8 — Harden
- [ ] Per-step timeouts; tail-cap step logs.
- [ ] Handle empty/missing README, `sudo` prompts, interactive prompts.
- [ ] Second Qodo PR round; address findings (or document disagreement).

### H8–9 — Real-repo run + record
- [ ] Run on the pre-scouted broken repo end to end.
- [ ] Record the demo (3 min).

### H9–10 — Ship
- [ ] Polish repo README (a stranger can run it).
- [ ] 3-minute demo video + short write-up + submission form.
- [ ] Blog post skeleton (Field Report) + 3 social clips (Radio Traffic).

## 2. Repo layout

```
readme-verifier/
  SKILL.md            # methodology pack (loaded as a TrueForge skill)
  agents/             # agent definition: model + connectors + skills + instructions
  src/                # ledger, report templates, failure classifiers (TypeScript)
  tests/
  README.md           # the repo a stranger can actually run
  demo/               # recorded clips (no keys, no personal data)
```

## 3. Demo script (3 minutes, mapped to judging criteria)

| Time | Beat | Judging criterion |
|------|------|-------------------|
| 0:00 | Problem: README rot — show a real repo whose README fails | Impact |
| 0:30 | Agent working: sandbox provisioned, steps executing, subagent fan-out visible | Use of TrueForge |
| 1:30 | Investigation + candidate diff | Technical excellence |
| **1:45** | **THE PAUSE** — approval UI on camera before opening the PR | Control & safety |
| 2:15 | Reload page mid-task → session persists, still holding for approval | Use of TrueForge |
| 2:15 | Approve → fork → PR opens with report comment | Use of TrueForge |
| 2:45 | Ledger + Qodo review trail | Technical excellence |
| 3:00 | Close: how a skill swap turns this into a new agent | Creativity |

## 4. Risks & mitigations

| Risk | Mitigation |
|------|------------|
| No genuinely broken demo repo | Pre-scout 3 candidates; fall back to your own repo (honest, always works) |
| Interactive prompts (`npm init`, `sudo`) | `SKILL.md` heuristics detect and skip; report as "needs human" |
| Sandbox timeouts on slow installs | Per-step timeouts; reuse sandbox across steps |
| Context bloat from huge step output | Tail-cap logs to last N lines + exit code |
| API spend | Cheap model (DeepSeek / OpenAI-compatible) or SF credits |
| GitHub rate limits | Public repos, few targets — negligible |

## 5. Stretch goals (only if ahead of schedule)

- [ ] Gmail/Slack MCP: draft verification summary, ask before sending (second approval-gated tool).
- [ ] Embed `@truefoundry/trueforge-ui` with a mission-control theme (keeps the Savile Row door open).
- [ ] Web-search MCP to resolve `outdated-command` failures automatically.

## 6. Submission checklist

- [ ] Public repo, MIT license, runnable README.
- [ ] Agent runs on TrueForge; harness visibly doing the work (tool + sandbox + approval).
- [ ] Qodo installed from the start; PRs it reviewed (fix findings or document disagreement).
- [ ] No keys / personal data in repo or video.
- [ ] ~3-minute demo video.
- [ ] Short write-up + blog post + social posts.
