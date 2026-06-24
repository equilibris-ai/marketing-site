# Context Hygiene

## Why

The biggest single source of context bloat in long Claude Code sessions is large tool outputs read repeatedly. Telemetry across 33 sessions that crossed 100K context in 24h showed a small set of patterns dominate the cost:

- Screenshot Reads (often re-read 2–4× per session): ~45% of bytes
- Edit/Write of large config/skill/spec files: ~28%
- Bash output (CI logs, paginated `gh api`, big greps/cats): ~26%
- Subagent return payloads duplicating file artifacts: ~5%

A handful of habits remove most of this cost without changing what Claude can do. This doc is the canonical guidance referenced from the root `CLAUDE.md`.

## What

Five rules. Each one targets a specific bloat pattern surfaced by the telemetry investigation.

### 1. Don't re-Read the same screenshot or large file

Screenshot Reads commonly cost 90–120K characters each. Sessions in the wild had the same PNG read 3+ times. **A 3× re-read of one screenshot can blow the whole context budget.**

If you've already Read `/tmp/foo.png` in this session, refer to it from prior context. Do not Read the same path twice unless the file has actually changed on disk.

### 2. Bounded CI-log extraction; truncate `gh` comment fetches

For CI failure logs, **never use `gh run view <id> --log-failed`** — for this repo's single-step test jobs it returns 30K+ characters of `UNKNOWN STEP`-tagged noise that no amount of `tail` makes useful (see triage-ci-failure Step 1.7 for the mechanism). Use the bounded extractor instead: `bash .claude/scripts/ci-logs.sh <run_id>` (or `--pr <pr_number>`).

`gh api .../comments --paginate` routinely returns 30K+ characters. Pipe through `| tail -200`, `| head -500`, or `jq '.[] | {field1, field2}'` to extract only what you need. If you genuinely need everything, write to a file and Read it with `offset`/`limit` rather than slurping the whole thing.

### 3. Never Read your own session transcript

Files matching `~/.claude/projects/**/*.jsonl` are the conversation log Claude is **currently writing**. Reading them creates a feedback loop that doubles context: every previous tool call is now in the transcript *and* re-quoted as a Read result.

If you need to recall earlier work in the session, rely on context (or the user's prompt). Never `Read` or `cat` your own `.jsonl`.

### 4. Use Read `offset`/`limit` proactively for large files

The Read tool's 25K-token-per-call limit exists for a reason. When you know a file is >25K tokens (rake-task transcripts, large markdown docs, generated logs), don't try to slurp it in one shot — pass `offset` and `limit` to read the slice you actually need.

### 5. Subagents that produce a file artifact must return a summary, not the full content

When an agent writes its output to a path, the orchestrator already has the file. Sending the same content back through the return value duplicates it in parent context every cycle.

The canonical pattern is `.claude/agents/plan-composer.md` (writes plan to `plan_path`, returns ≤1500-char summary) and `.claude/agents/debugger.md` (writes investigation to `report_path`, returns summary + `<confidence>` tag). Apply the same shape to any new agent whose primary output is a markdown artifact.

## How

These rules apply to **Claude's own behavior** during a session — there is no linter or hook enforcing them. Internalize them like the other rules in `CLAUDE.md`: when about to issue a Read/Bash/Agent call, ask whether it triggers one of the five patterns above, and if so, take the cheaper path.

For agents and skills you author, the file-handoff pattern (rule 5) is the one that bakes the saving in permanently — see the linked agent definitions for templates.
