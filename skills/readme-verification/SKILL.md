---
name: readme-verification
description: >
  Safely verify a repository's README by executing its setup steps inside an
  isolated sandbox, classifying each failure, and preparing a fix. Use whenever
  a task involves validating, testing, or fixing a README's install, build, or
  usage instructions. Covers interactive-prompt detection, sudo handling,
  timeout discipline, and how to format a verification report.
---

# README Verification

Verify a README the only honest way: by running it. This skill tells you how to
execute a repo's documented setup steps safely and report what broke.

## Tools you have

- `readme-verifier` MCP server — deterministic helpers you must use for the
  mechanical steps (so counts and categories never come from prose):
  - `extract_steps(markdown)` → ordered list of setup commands (JSON)
  - `classify_failure(exit_code, stdout, stderr, timed_out)` → failure category
  - `build_report(verification_json)` → deterministic Markdown report
  - `fingerprint(markdown)` → hex fingerprint for incremental verification
  - `ledger_check(repo, fingerprint)` → `{ reverify, record }`
  - `ledger_record(repo, fingerprint, summary)` → records a completed run
- the **sandbox** — run commands, clone repos, write files (never the host)
- the **github** MCP server — read the README, fork, push, open PRs

## Workflow

1. **Read** the README from the repository using the GitHub connector.
2. **Extract** the ordered commands with the `extract_steps` tool.
3. **Provision the sandbox** and clone the repository into it.
4. **Execute** each step in the sandbox, capturing stdout/stderr/exit code.
   Tail-cap long output before it enters your context.
5. **Classify** every non-zero result with the `classify_failure` tool.
6. **Investigate** failures: check installed tool versions, try the documented
   alternates, and only then propose a corrected command.
7. **Report** with the `build_report` tool.
8. **Apply the fix through GitHub write tools** (update the README, push a branch,
   open a PR). Do **not** ask for approval in chat and stop. Calling a write tool
   is what triggers the harness approval gate — the human sees Allow/Deny in the
   UI before anything public happens. If there is nothing to fix, say so and end.

## Use subagents for parallel paths

When a README documents several install paths (macOS vs Linux, npm vs pnpm,
Docker vs bare metal), delegate one subagent per path and merge their results.
Keep each subagent scoped to a single path so the root context stays clean.

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

The `classify_failure` tool maps output signals to categories:

| Signal in output | Category |
|------------------|----------|
| exit code 0 | success |
| "command not found", "ENOENT", "no such file or directory" | missing-dependency |
| "unknown/invalid option", "unrecognized argument", "deprecated" | outdated-command |
| "password", "passphrase", "[y/n]", "are you sure" | interactive-prompt |
| "401", "403", "authentication failed", "access denied" | needs-secrets |
| anything else non-zero | unknown |

A seventh category, `docs-drift`, is NOT produced by `classify_failure`. Assign
it yourself when a command succeeds but its output contradicts what the README
claims (wrong version, wrong path, wrong expected output) — evidence of a stale
instruction that still happens to run.

## Report format

Use the `build_report` tool for a deterministic Markdown report. It always
includes: the repo, a status table, a pass/fail summary, a Failures section, and
(when a fix is available) a Suggested fixes section with a diff.

## Incremental verification

Before running anything, use the `fingerprint` tool to hash the README, then call
`ledger_check(repo, fingerprint)`. If it returns `reverify: false`, the README is
unchanged since the last run — report the stored summary as "unchanged since
<record.verifiedAt>" and skip re-execution. Otherwise verify as usual and finish
with `ledger_record(repo, fingerprint, "<summary>")` so the next run can skip.
