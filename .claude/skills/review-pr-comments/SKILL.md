---
name: review-pr-comments
description: >-
  End-to-end workflow for processing ALL review comments on the current PR: find the PR, pick the
  review mode (manual / auto / auto+major), run triage rounds via the triage-pr-comment skill, then
  wait-loop to catch bot follow-ups (CodeRabbit/Codex post follow-ups 1–5 min after replies) and
  summarize. Use whenever the user wants the PR's comments handled, even without the word "review":
  "process the PR comments", "address the CodeRabbit review", "handle the review feedback",
  "respond to the comments on my PR", "any unresolved threads?". This is the user-facing entry
  point; per-comment rules (fetch, classify, decide, resolve) live in the triage-pr-comment skill.
---

# Review PR Comments

The **workflow shell** for PR-comment processing: find the PR, pin a mode, run triage rounds, then
**loop to catch follow-up comments** that bots routinely post within 1–3 minutes after each reply.
All per-comment rules — fetching both feedback surfaces, source identification, severity, decision
policy, resolution mechanics, reply templates — live in the **`triage-pr-comment` skill**; this
shell never restates them.

<!-- Step numbers 0/1/6/7 are referenced from other skills and scripts
     (e.g. comments-watch.sh header). Never renumber. -->

---

## Step 0: Find the PR

```bash
gh pr list --head "$(git branch --show-current)" --json number,url --jq '.[0]'
```

Extract `OWNER/REPO` from the URL and `NUMBER` from the result. If no PR exists, tell the user and stop.

---

## Step 1: Pick mode — the single prompt site

Mode semantics and the resolution order are owned by `triage-pr-comment` Step 0 — Mode contract;
this step is the **only place that asks**. If **session auto-mode is active**, default to `auto`
silently — don't ask.

Otherwise use `AskUserQuestion` with header "Review mode":

| Option | Maps to mode token |
| --- | --- |
| **Auto-accept (Recommended)** | `auto` |
| **Auto-accept + Major-autofix** | `auto+major` |
| **Manual** | `manual` |

Pass the chosen token to every triage round below. Don't restate what each mode does — the matrix
lives in triage-pr-comment Step 0.

---

## Steps 2–5: Run a triage round

**Run the `triage-pr-comment` skill** with the pinned mode — it is the single source of truth for
fetching all feedback surfaces (its Step 1 — Fetch), source identification and severity
classification (Steps 2–3 — Identify/Classify), decision policy and the deferred-items contract
(Step 4 — Decision policy), and resolution mechanics with reply templates (Step 5 — Resolve).

One invocation = one triage round over everything currently unresolved. The round ends with
per-comment `comment-triage:` evidence lines and one `comment-triage-round:` summary line — Step 7
aggregates from those.

<!-- Steps 2–5 intentionally collapsed: their content moved to triage-pr-comment
     (FRO-188). The heading keeps the historical numbering so Step 6/7 anchors
     referenced elsewhere stay stable. -->

---

## Step 6: Wait-loop for follow-ups

Bots post follow-up comments **on their own schedule** — anywhere from ~1 minute to 5+ minutes
after a reply. After a round completes, arm a quiet Monitor:

```
Monitor( command: "bash .claude/scripts/comments-watch.sh <PR>",
         timeout_ms: 1800000 )
```

The watcher's emission contract (`NEW_COMMENTS:` token, 10-min quiet exit, error token) lives in
`comments-watch.sh`'s header. False positives are cheap: a round on a quiet PR fetches 0
unresolved items and ends immediately.

When the Monitor emits `NEW_COMMENTS:<updated_at>`, **stop the Monitor** (`TaskStop`) and run
another triage round (Steps 2–5) with the same mode — skip Step 1, the mode is already pinned. On
quiet exit, nothing actionable arrived — Step 6 is done.

### Loop bounds

- **Max 3 outer rounds** of (process → wait → reprocess). At round 3, summarize and stop
  regardless — talkative bots can keep generating clever new edge cases indefinitely.
- **Quiet-stop**: the watcher's 10-min silent exit means bots have moved on. No emission means
  nothing to do.

### Stopping the loop

The wait-loop must always be interruptible. Two paths:

- **User says "stop"** (or "skip the rest", "we're done", anything similar). Treat it as immediate
  exit: stop the Monitor (TaskStop), skip remaining loop iterations, jump to Step 7 with whatever
  was processed so far. Do not "finish this round first".
- **Esc / Ctrl+C** kills the current Bash / Monitor and surfaces the interrupt. Same handling —
  exit, summarize, do not resume.

Default behaviour also bounds the loop: max 3 outer rounds, max 10 min of quiet per round. Even
without user input, the skill terminates on its own.

---

## Step 7: Summary

Aggregate the rounds' `comment-triage-round:` lines:

```
## PR Comment Review Complete

### Loops
- N rounds of comment processing (typical: 1-3)

### Processed (by source)
- N CodeRabbitAI / N Codex / N Aikido / N human / N other-bot comments
- N CodeRabbit acks auto-resolved

### Actions
- X fixed (code changes applied) — commits: <SHAs>
- Y resolved with reply
- Z skipped (left open)

### Deferred — needs user
- <the triage rounds' deferred list, verbatim — surface it even when empty-handed elsewhere>
```

---

## Workflow notes

- Per-comment policy questions ("can this be auto-fixed?", "who needs confirmation?") are answered
  by `triage-pr-comment` — if you find yourself deciding policy here, you're in the wrong file.
- If `gh pr edit` fails with "Projects (classic) is being deprecated", use
  `gh api repos/OWNER/REPO/pulls/NUMBER -X PATCH --input body.json` instead. Known issue with the
  GraphQL endpoint `gh` uses internally.
