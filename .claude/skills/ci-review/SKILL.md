---
name: ci-review
description: Check CI status, fix failures, and process PR comments in one workflow. Supports fully automatic mode.
---

# CI Review

Check CI status, fix failures, and process PR review comments in one workflow.

---

## Step 0: Find the PR

```bash
gh pr list --head "$(git branch --show-current)" --json number,url --jq '.[0]'
```

Extract `OWNER/REPO` from the URL and `NUMBER` from the result. If no PR exists, tell the user and stop.

---

## Step 1: Ask Processing Mode

Use `AskUserQuestion` with header "CI Review mode":

| Option                            | Description                                                              | Comment-triage mode token |
| --------------------------------- | ------------------------------------------------------------------------ | ------------------------- |
| **Fully automatic (Recommended)** | Check CI, fix failures, process PR comments without per-item prompts.    | `auto+major`              |
| **CI only**                       | Just check CI status and fix failures. Skip PR comments.                 | —                         |
| **Comments only**                 | Just process PR comments — runs `/review-pr-comments`, which asks the comment mode itself. | (shell asks) |
| **Manual**                        | Check CI + process comments, confirming every action.                    | `manual`                  |

Mode-token semantics (what auto-resolves, what auto-fixes, what always defers to the user) live in
`triage-pr-comment` Step 0 — Mode contract; this table only maps labels to tokens.

---

## Step 2: Check CI Status

**Skip this whole step in `Comments only` mode** — that mode bypasses Step 2 entirely and goes straight to Step 3. The user explicitly opted out of CI handling; do not read CI status, do not fix failures, do not commit on their behalf.

For modes that *do* run Step 2 (`Fully automatic`, `CI only`, `Manual`):

### Get check status

```
.claude/skills/ci-review/scripts/pr-checks-status.sh <PR_NUMBER>
```

Prints a bucket histogram + lists failures and pending jobs explicitly. Exit code 0 means no failures (may still be pending); exit 1 means at least one check failed.

Use the CI bucket to decide whether to fix failures in this iteration. **The decision hinges on the failure bucket alone — any non-zero failure count gates the fix sub-step; pending vs. green doesn't matter:**

- Failures > 0 → fix them (sub-step below), then continue to Step 2.5 / Step 3 in the same iteration (or stop in CI-only mode).
- Failures == 0 (everything is some mix of passing, skipping, and pending) → skip the failure-fix sub-step, continue to Step 2.5 / Step 3 (or stop in CI-only mode). Mixed pass+pending is the common state right after a push; don't stall on it — new review comments arrive on the previous SHA's checks too.

### Analyze failures

```
.claude/skills/ci-review/scripts/pr-failure-logs.sh <PR_NUMBER>
```

Walks PR HEAD → check-suites → workflow run → failing jobs → log extracts. Per failing job, prints the name, URL, and the relevant `Failures:` / `Failed examples` log slices.

### Present summary

| #   | Job                    | Failures | Category      | Root Cause Summary           |
| --- | ---------------------- | -------- | ------------- | ---------------------------- |
| 1   | rspec_with_coverage    | 13       | Test failures | NoMethodError in worker      |
| 2   | rspec_without_coverage | 3        | Test failures | track_event matcher mismatch |
| 3   | rubocop                | 1        | Lint          | Missing cop disable          |

### Fix failures (only when failures exist)

- **Attribute first — run the `triage-ci-failure` skill.** It carries the full procedure (diff-scope → master-green → rebase → flake-vs-reproducible → no-unrelated-fix). Don't fix or re-trigger before it tells you the failure is *ours*; a pre-existing/flaky failure on an untouched file gets a separate ticket, not a fix in this PR.
- Read failing spec files and production code
- Apply fixes (per-category guidance — rspec/rubocop/coverage/chromatic — lives in `triage-ci-failure` Step 6; Chromatic routes back to Step 2.5 below)
- Commit and push
- In **Fully automatic** mode, proceed to Step 3 immediately without waiting for CI to re-run
- In **Manual** mode, ask user if they want to wait for CI or proceed to comments

### Then continue to Step 2.5 / Step 3 (Fully automatic, Manual)

In **Fully automatic** and **Manual** modes, even if CI is still pending and there's nothing to fix this iteration, **do not stop here**. The skill's purpose is CI *and* comments — a pending-CI iteration must still run the comment sweep before scheduling the next wakeup. In **CI only** mode, stop after the failure-fix sub-step (or immediately, if there were no failures) — Step 3 is intentionally skipped. **Comments only** never enters this step.

---

## Step 2.5: Chromatic Visual Diff Review (when applicable)

Run when the PR has Chromatic checks reporting **changes pending acceptance** (state `PASS_PENDING_REVIEW`, label "N changes must be accepted as baselines"). Skip for PRs with no Chromatic activity or all-passing visual tests.

### What we can and cannot do

`CHROMATIC_PROJECT_TOKEN` (already in repo `.env`) is an upload-only token. The Chromatic GraphQL API rejects all read queries with `Must login` / `UNAUTHENTICATED` when called with it. Listing all changed snapshots therefore requires user-level auth (login session or User API token) which we don't have configured.

What we *can* do:
1. Surface the build URL + change count from the `chromatic-com` GitHub App check.
2. Have the user open the build, copy the image addresses for snapshots they want diagnosed, and paste them into chat.
3. WebFetch each pasted snapshot image URL and analyze it (the URLs are signed S3 links valid for ~1h).

### Surface the build URL + change count

```bash
.claude/skills/ci-review/scripts/chromatic-build-info.sh <PR_NUMBER>
```

Prints JSON with `details_url` (build URL) and `summary` (change count). If the latest commit's chromatic check is still queued, the script walks back up to 5 commits to find a completed one.

### Get diff images from the user

Tell the user:

> Open `<details_url>`, click into a snapshot you'd like me to analyze, right-click → "Copy image address" on the diff/baseline/latest image, and paste here. I'll WebFetch and inspect it. Repeat per snapshot you want covered.

Don't try to enumerate all changed stories programmatically — without user-level auth there is no read API path that works.

### Review the pasted diffs

For each URL the user pastes:
1. WebFetch the image.
2. Note position shifts, color/opacity changes, layout changes, missing/added elements.
3. Map to a likely cause:

| Pattern | Likely cause |
|---|---|
| Same shift across many unrelated stories | Global style change (Tailwind class, theme token, antd theme) |
| Single component changed across all viewports | The component itself was modified |
| Specific layout shift (right-aligned, wrapping changed) | Flex/grid gap, padding, or DOM structure change |
| Color-only changes (hue or alpha) | Theme variable / CSS variable change |
| Text content changes | i18n key, copy edit, fixture data |

Decide per snapshot: **regression** (fix and push, retrigger Chromatic) vs **expected baseline shift** (surface to user for acceptance in the Chromatic UI). Don't accept programmatically — Chromatic's accept-baseline mutation requires login session, not the project token.

### Future: full enumeration

Becomes possible if a User API token is added (Chromatic Pro+ plans). When it does, the script can be extended to call `https://index.chromatic.com/graphql` with `Authorization: Bearer <user-token>` and walk all changed tests for the build. Until then, the user-paste flow is the practical path.

---

## Step 3: Process PR Comments

### 3.0 Triage every comment via the `triage-pr-comment` skill

**Run the `triage-pr-comment` skill** with this iteration's mode token — it is the single source
of truth for fetching all feedback surfaces (its Step 1 — Fetch covers `reviewThreads` *and*
top-level review bodies; threads-only queries silently miss every Codex P2 — helper:
`.claude/scripts/pr-feedback.sh`), source/severity classification (Steps 2–3), the decision
policy including Major auto-fix criteria and the always-confirm set (Step 4 — Decision policy),
and resolution mechanics (Step 5 — Resolve).

### 3.1 Mode dispatch

- **Fully automatic**: triage rounds in `auto+major` mode
- **CI only**: skip this step entirely
- **Comments only**: run `/review-pr-comments` directly (the shell asks the comment mode)
- **Manual**: triage rounds in `manual` mode

One skill invocation = one triage round; surface its **deferred — needs user** list (see
triage-pr-comment Step 4 — Decision policy) in the Step 4 summary — never end a Fully-automatic
run without showing it.

---

## Step 4: Summary

```
## CI Review Complete

### CI Status
- [pass/fail] rspec_with_coverage
- [pass/fail] rspec_without_coverage
- [pass/fail] rubocop
- Fixes applied: N commits pushed

### Chromatic Visual Diffs
- N changed stories reviewed
- M flagged as regressions (R fixes pushed)
- K flagged as expected baseline shifts (user must accept in Chromatic UI)

### PR Comments
- aggregated from the triage rounds' `comment-triage-round:` lines
  (processed / fixed / replied / deferred / skipped, by source)

### Deferred — needs user
- [the triage rounds' deferred list, verbatim — Aikido/human/Major items awaiting confirmation]

### Remaining
- [any items user chose to skip or that need follow-up]
```
