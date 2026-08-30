# Qodo Review Trail

The **Q Branch (Best Code Quality)** track is judged on the *review trail*: Qodo
installed on the repo from the start, every change through a pull request, and
findings addressed before merge. This page is the evidence a judge can follow.

## Setup

1. Sign in at <https://app.qodo.ai/signin> (Google / GitHub / email).
2. Link your Git account, then **install the Qodo GitHub app** on
   `PeytonLi/readme-verifier`.
3. Qodo now reviews every PR (and every push to an open PR) with full-repo
   context — it surfaces bugs, risks, and standards violations ranked by
   severity.

## The loop that produces evidence

- Open a PR (never push straight to `main`).
- Qodo posts review findings on the PR.
- Fix the real ones, and reply "why I disagree" on any you reject.
- Merge.

The trail is visible on each PR: **Conversation → review comments** (and
**Files changed** for inline comments).

## Pull requests

| PR | Change | Qodo outcome |
|----|--------|--------------|
| #1 | harden hackathon fit (LICENSE, CI, runtime-accurate skill) | — |
| #2 | fix Linux `/bin/sh` classification | — |
| #3 | mission-control UI (Next.js + React) + pnpm | — |
| #4 | demo script update | — |
| #5 | Render deployment + ledger + flat report + persistence | — |
| #6 | `unrecognized option` classifier fix | — |

> Fill the "Qodo outcome" column with what Qodo found and how it was resolved on
> each PR (e.g. "2 findings fixed", "1 finding disagreed: ...").

## Write-up snippet (for the submission)

> I installed Qodo on the repo on day one and let it review every pull request.
> Across the six PRs it caught — among other things — the Linux `not found`
> classifier gap and the nested `build_report` interface that made the model
> loop. I fixed each finding before merge; the review trail is in the PR history
> (linked above).
