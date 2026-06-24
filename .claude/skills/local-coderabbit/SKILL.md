---
name: local-coderabbit
description: Run a CodeRabbit-style review on the LOCAL working-tree / branch diff before pushing — severity-grouped findings without a PR round-trip. The pre-push counterpart to review-pr-comments / ci-review (which run on a pushed PR). Triggers on "local review", "review my changes locally", "coderabbit locally", "review before push", "run coderabbit on my diff".
argument-hint: "[plain|agent] [--type committed|uncommitted|all]"
---

# Local CodeRabbit Review

Run a CodeRabbit-style review on the **current working-tree / branch diff — before any PR exists** — by wrapping the local CodeRabbit CLI. Surfaces the same class of findings (correctness bugs, suggestions, nitpicks) you'd otherwise only see as CodeRabbit comments on a pushed PR.

This skill is the **inverse / pre-push counterpart** to `review-pr-comments` and `ci-review`, which both start by finding a *pushed PR*. They are complementary, not overlapping:

| Stage | Skill | Operates on |
| ----- | ----- | ----------- |
| **Pre-push (this skill)** | `/local-coderabbit` | Local working-tree / branch diff |
| Post-push | `/review-pr-comments` (workflow; rules: `triage-pr-comment`) | CodeRabbit/Codex/human comments on the PR |
| Post-push | `/ci-review` | CI status + PR comments |

The two stages chain naturally: **local review → push → `review-pr-comments` / `ci-review`.**

---

## Step 0 — Readiness

The wrapper script gates on `coderabbit doctor` and skips silently when CodeRabbit isn't available. In the **interactive** path, *surface* the skip so the user can fix it (the pipeline path swallows it instead — see the Pipeline Contract below).

Quick check before running:

```bash
coderabbit doctor >/dev/null 2>&1 && echo "ready" || echo "not ready"
```

If **not ready**, tell the user how to fix it and stop:

- CLI missing → install the CodeRabbit CLI (`https://www.coderabbit.ai/cli`).
- Not authenticated → `coderabbit auth login`.

Do **not** fabricate a review when CodeRabbit is unavailable.

---

## Step 1 — Pick scope

Default to reviewing **all** local changes (committed + uncommitted) against the merge-base with `origin/master`. Only ask when genuinely ambiguous; otherwise default silently.

| `--type` | Reviews |
| -------- | ------- |
| `all` (default) | Committed + uncommitted changes vs the merge-base |
| `committed` | Only committed changes on the branch |
| `uncommitted` | Only the dirty working tree |

The base commit is resolved by the wrapper as `git merge-base HEAD origin/master` (never `git diff master` — local `master` may be stale in worktrees). Pass `--base-commit <sha>` only to override.

---

## Step 2 — Run the review

Interactive mode uses `--mode plain` (human-readable, severity-grouped):

```bash
bash .claude/skills/local-coderabbit/scripts/coderabbit-review.sh --mode plain --type all
```

The wrapper resolves the base commit, runs `coderabbit review` under a portable timeout, feeds the repo `CLAUDE.md` as extra instructions, captures stderr internally, and emits a **status line as its LAST line**:

- `[coderabbit] ok` — review ran, findings present above.
- `[coderabbit] ok:clean` — review ran, no findings.
- `[coderabbit] skipped: <reason>` — CodeRabbit not available/ready (CLI missing, not authed).
- `[coderabbit] errored: <reason>` — runtime failure (timeout, network, crash).

The script **always exits 0**.

---

## Step 3 — Present findings

Render the findings **grouped by severity**, mirroring CodeRabbit's PR output. For each finding include the `file:line` reference and the suggestion:

```
🔴 Critical
  app/services/foo.rb:42 — <issue> → <suggested fix>

🟠 Major
  app/javascript/widgets/Bar.tsx:88 — <issue> → <suggested fix>

🟡 Minor / Nitpick
  …
```

- On `ok:clean`, report "CodeRabbit found no issues in the local diff."
- On `skipped:` / `errored:`, tell the user the review didn't run and why (interactive path surfaces this; never present a fabricated result).

Offer to apply fixes the user accepts. The review itself is read-only — only edit files when the user opts in.

---

## Step 4 — Chain to post-push review

Once the local diff is clean (or the user has addressed findings), the natural next steps after pushing are:

- `/review-pr-comments` — process CodeRabbit/Codex/human comments on the PR (per-comment rules live in the `triage-pr-comment` skill).
- `/ci-review` — check CI + process PR comments.

The PR remains the **source of truth** for review feedback; this local pass is an early-feedback accelerator.

---

## Pipeline Contract (consumed by `implement-feature` / `fix-bug`)

The delivery pipelines call this wrapper as an **optional, supplementary** reviewer in their pre-push code-review step, using `--mode agent`:

```bash
cr_combined=$(bash .claude/skills/local-coderabbit/scripts/coderabbit-review.sh --mode agent 2>&1)
cr_status=$(printf '%s\n' "$cr_combined" | tail -n 1)
case "$cr_status" in
  "[coderabbit] ok"|"[coderabbit] ok:clean")
    cr_findings=$(printf '%s\n' "$cr_combined" | sed '$d') ;;   # strip status line
  *) cr_findings="" ;;                                          # skipped / errored → ignore
esac
echo "$cr_status"   # surface status; proceed regardless
```

**Hard rules for the pipeline path:**

- The step is **soft**: any `skipped:` / `errored:` status is a **no-op**. It never blocks, never fails, never stops the pipeline. The wrapper always exits 0 — do not treat a non-zero `cr_status` parse as an error.
- When `cr_findings` is non-empty, append it to the `code-reviewer` agent prompt as **supplementary context** under a header like *"Local CodeRabbit findings (supplementary — your verdict remains authoritative):"*. The `code-reviewer` agent stays the single authoritative verdict — CodeRabbit is context only (identical to how Codex is integrated).
- The pipeline's review **source of truth remains CodeRabbit-on-the-PR** (post-push, addressed via `review-pr-comments` / the `triage-pr-comment` rules). This local step only accelerates feedback.
