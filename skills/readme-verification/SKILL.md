---
name: readme-verification
description: >
  Safely verify a repository's README by executing its setup steps inside an
  isolated sandbox, classifying each failure, and preparing a fix. Use this
  whenever a task involves validating, testing, or fixing a README's install,
  build, or usage instructions. Covers interactive-prompt detection, sudo
  handling, timeout discipline, and how to format a verification report.
---

# README Verification

Verify a README the only honest way: by running it. These instructions tell an
agent how to execute a repo's documented setup steps safely and report what
broke.

## Workflow

1. **Read** the README from the repository.
2. **Extract** the ordered setup commands (see `src/extract`). Use
   `extractSteps(markdown)` to turn the README into an ordered list of `Step`s.
3. **Provision a sandbox** and clone the repository into it. Never execute
   README steps on the host.
4. **Execute** each step in order, capturing `stdout`, `stderr`, and the exit
   code. Tail-cap each stream to the last 50 lines to protect context.
5. **Classify** every non-zero result using `classifyFailure` (see
   `src/classify`): `missing-dependency`, `outdated-command`,
   `interactive-prompt`, `needs-secrets`, `docs-drift`, or `unknown`.
6. **Investigate** failures: check installed tool versions, try the documented
   alternates, and only then propose a corrected command.
7. **Report** via `buildReport` (see `src/report`): a per-step status table,
   failing commands, and a candidate diff.
8. **Pause for approval** before any public, semi-irreversible action — forking,
   pushing a branch, or opening a PR.

## Execution safety rules

- Run everything in the sandbox. The host is never a target.
- Apply a per-step timeout (default 120s). Mark a step that exceeds it as timed
  out rather than retrying forever.
- Do NOT run commands that request credentials, secrets, or interactive input.
  Detect these and report them as "requires human" instead of blocking.
- Do NOT run destructive commands (`rm -rf`, `sudo`, database migrations,
  `git push --force`) without an explicit human approval gate.
- A line that starts with `# ` is a shell comment unless it also matches a known
  command prefix (e.g. `# apt-get install`).

## Failure classification cheat-sheet

| Signal in output | Category |
|------------------|----------|
| exit code 0 | success |
| "command not found", "ENOENT", "no such file or directory" | missing-dependency |
| "unknown/invalid option", "unrecognized argument", "deprecated" | outdated-command |
| "password", "passphrase", "[y/n]", "are you sure" | interactive-prompt |
| "401", "403", "authentication failed", "access denied" | needs-secrets |
| anything else non-zero | unknown |

## Report format

Use `buildReport(verification)` for a deterministic Markdown report. It must
always include: the repo, a status table, a pass/fail summary, a Failures
section, and (when a fix is available) a Suggested fixes section with a diff.
