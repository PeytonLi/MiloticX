# Demo Script (3 minutes)

**MiloticX** — show the problem, the agent doing real work through the harness, and the
one moment every other submission skips — the approval pause. Two surfaces are
available; the **Mission Control UI** (`web/`) is the primary showcase and the
Savile Row (Best UI) entry.

## Setup before recording

- TrueForge running (Docker → `http://localhost:8790`), MCP server running
  (`pnpm run start:server` → `http://127.0.0.1:8791`), agent saved as
  `readme-verifier`.
- Web UI running: `cd web && pnpm install && pnpm dev` → `http://localhost:3000`.
- **A fast, deliberately-broken demo repo.** Pre-scout it by hand so the demo is
  guaranteed to break. Ideal README — two or three quick commands, one that fails:

  ```markdown
  # demo
  ## Install
  ```sh
  node --version
  npm --versoin
  ```
  ```

  Keep it fast: a long `pnpm install`/`npm test` gives the Daytona sandbox time to
  idle out (see Risks). Your own `readme-verifier` repo is too slow for the demo —
  use a tiny throwaway repo instead. Two ready-made repos exist for this:
  `github.com/PeytonLi/readme-verifier-demo` (single broken flag) and
  `github.com/PeytonLi/readme-verifier-demo-multipath` (macOS/Linux paths, for a
  subagent fan-out).

- **GitHub token with write access.** The fine-grained PAT in the GitHub
  connector must have `Contents: Read and write` + `Pull requests: Read and
  write` on the demo repo(s), or the PR-open step will fail with `403 Resource
  not accessible by personal access token`. Read-only PATs can verify but not
  fix.

## The beats (Mission Control UI)

| Time | What you show | Judging criterion |
|------|---------------|-------------------|
| 0:00–0:20 | **Problem.** Open the demo repo's README; "READMEs rot — this command no longer exists, and nothing re-runs a README after it's written." | Impact |
| 0:20–0:55 | **Run.** Paste the repo URL in the UI, hit **Verify README**. Point at the timeline as `MCP connected` (github + readme-verifier), `Sandbox provisioned`, then the agent downloading the README and cloning into the sandbox. | Use of TrueForge |
| 0:55–1:30 | **Failure + classification.** The broken step fails; the agent calls `classify_failure` and labels it `missing-dependency` / `outdated-command`. It tries the documented alternate. | Technical excellence |
| **1:30–1:50** | **THE PAUSE.** The UI shows the **Approve this step?** gate: plain-English summary of the proposed public action, risk copy, and **Allow / Deny**. Leave it on screen. This is the moment the hackathon says nobody films. | Control & safety |
| 1:50–2:10 | **Approve → PR.** Click Approve; the agent forks, pushes, and opens the PR. The **Report** panel fills with the markdown report. | Use of TrueForge |
| 2:10–2:40 | **Harness depth.** Point out what the timeline captured: sandbox-as-tool (code ran in Daytona, not the host), the custom `readme-verifier` MCP tools, the skill driving the procedure. | Use of TrueForge |
| 2:40–3:00 | **Close.** Repo hygiene (CI green on the PR, tests), and one line: "swap the skill and this becomes any other verification agent." | Technical excellence / originality |

## The beats (chat UI — fallback if the web UI is flaky)

Same story in the built-in chat at `http://localhost:8790`: give the repo URL,
open the **Agent steps** panel, and show the same milestones (MCP init, sandbox,
tool calls, approval). The web UI is the better demo because it renders the
timeline and approval gate as first-class UI.

## What the judges are explicitly looking for (do not cut)

1. **A real tool reached** — the GitHub connector is live (README downloaded, PR opened).
2. **Code running in the sandbox** — show the sandbox provisioned, not a local shell.
3. **A pause before irreversible** — leave the approval gate on screen.
4. **The harness doing the work** — if it would work as a chat box, change the project.

## Risks and mitigations

| Risk | Mitigation |
|------|------------|
| **Daytona sandbox dies mid-run** (`Sandbox is unavailable; recovery attempt failed`) | Use a fast repo (2–3 quick commands); keep the demo under ~90s; restart the turn if it flakes. Observed live during testing. |
| Agent takes a slow code-mode detour | A short README keeps it from drifting; the skill directs it to the MCP tools. |
| Keys / personal data on screen | Keep the demo repo public and key-free; don't show `.env`. |
| No broken command found | Pre-scout; the demo repo has a guaranteed-failing command. |

## Notes

- One narrow job done end-to-end beats a platform with three half-finished features.
- If time permits, run the same repo twice to show `fingerprint` returning
  "unchanged" (incremental verification).
