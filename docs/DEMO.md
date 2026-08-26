# Demo Script (3 minutes)

Goal: show the problem, the agent doing real work through the harness, and the
one moment every other submission skips — the approval pause.

## Setup before recording

- TrueForge running (http://localhost:8790), MCP server running (`npm run start:server`).
- Agent `readme-verifier` open in the chat.
- A target repo whose README demonstrably fails. Best: pre-scout a public repo
  with an outdated command (a renamed npm package or a removed CLI flag). Verify
  the failure by hand first so the demo is guaranteed to break.

## The beats

| Time | What you show | Judging criterion |
|------|---------------|-------------------|
| 0:00–0:20 | **Problem.** Open the target repo's README; note the setup commands. Say: "READMEs rot — this command no longer exists, and nothing re-runs a README after it's written." | Impact |
| 0:20–1:00 | **The agent works.** Give the repo URL. Point at the Agent-steps panel as it: reads the README (GitHub MCP), calls `extract_steps`, provisions the sandbox, and runs the steps. | Use of TrueForge |
| 1:00–1:40 | **Failure + classification.** Show a step failing; the agent calls `classify_failure` and labels it `missing-dependency`/`outdated-command`. Show it trying the documented alternate. | Technical excellence |
| **1:40–2:00** | **THE PAUSE.** The agent stops before opening a PR: "Opening a PR on <repo> is public — approve?" Leave the approval prompt on screen. This is the moment the hackathon says nobody films. | Control & safety |
| 2:00–2:20 | **Persistent session.** Reload the page mid-pause; the session comes back still holding for approval. | Use of TrueForge |
| 2:20–2:45 | **Approve → PR.** Approve; the agent forks, pushes, opens the PR with the report as a comment. Show the report (`build_report`). | Use of TrueForge |
| 2:45–3:00 | **Close.** Repo hygiene (CI green, Qodo-reviewed PRs), and one line on how swapping the skill turns this into a different agent. | Technical excellence / originality |

## What the judges are explicitly looking for (do not cut)

1. **A real tool reached** — the GitHub connector is visible (not mocked).
2. **Code running in the sandbox** — show the sandbox provisioned, not a local shell.
3. **A pause before irreversible** — leave the approval prompt on screen.
4. **The harness is doing the work** — if it would work as a chat box, change the project.

## Notes

- Keep keys and personal data out of the recording (the demo URL and repo names are fine).
- One narrow job done end-to-end beats a platform with three half-finished features.
- If time permits, add a second run of the same repo to show `fingerprint` returning "unchanged" (incremental verification).
