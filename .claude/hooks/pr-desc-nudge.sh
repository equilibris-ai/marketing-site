#!/bin/bash
# ============================================================================
# pr-desc-nudge — PostToolUse hook
# ============================================================================
#
# Fires after a successful `git push` on a branch that has an open PR.
# Surfaces a nudge in the tool-result context reminding the agent (and human
# operator) that PR descriptions go stale fast — if the just-pushed commits
# change what the PR does (new behavior, new edge cases, reverted things,
# scope creep), the description should be updated.
#
# Non-blocking: always exits 0. Nudge is emitted as
# `{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":…}}`
# on stdout. (Stderr is silently dropped by Claude Code for non-blocking
# PostToolUse hooks.)
#
# ----------------------------------------------------------------------------
# Match rule
# ----------------------------------------------------------------------------
#
# Conservatively narrow:
#   1. Bash command contains a `git push` invocation as a word (covers chained
#      forms like `git add … && git commit … && git push`, env-var prefixes
#      like `FOO=1 git push`, and parenthesized subshells).
#   2. Current branch has an open PR via `gh pr list --head <branch>`.
#
# Skips silently when neither holds.
#
# Note on `if:` filter and exit-code: an earlier version of this hook used
# `if: Bash(git push*)` in settings.json + exit-code 0 gating. Empirical:
# PostToolUse hooks don't honor `if:` (PreToolUse does — gate-git-push and
# e2e-stack-nudge work fine with it). Without `if:`, the hook fires on every
# Bash call, so the verb check moved into the script. Exit-code gating was
# also dropped because chained commands report the LAST sub-command's exit
# (often `echo`/`ls`), not the push itself — false negatives on success
# outweighed the filter's value.
#
# ----------------------------------------------------------------------------
# What we do NOT do
# ----------------------------------------------------------------------------
#
# - Do not auto-edit the PR body. Risk of clobbering the operator's prose
#   far outweighs the convenience.
# - Do not enumerate "Recent commits" in the nudge or PR body — the
#   archive-dot-com repo's PR template (`.github/PULL_REQUEST_TEMPLATE.md`)
#   has Visual Changes / Affected Places / Tech Details sections; we follow
#   that and prefer prose.
# - Do not try to detect "is the body actually stale?" — fuzzy heuristic, the
#   nudge is non-blocking, false-fires cost ≈ zero. Better to remind on every
#   push than miss real staleness.
# ============================================================================

set -u

# python3 is required to parse the JSON payload + emit the JSON nudge. If it's
# missing on the host (rare, but possible in minimal containers), bail silently
# rather than letting `python3 -c …` print a `command not found` to the user.
command -v python3 >/dev/null 2>&1 || exit 0

# Read PostToolUse JSON payload from stdin.
input=$(cat)
[ -z "$input" ] && exit 0

CMD=$(printf '%s' "$input" | python3 -c '
import sys, json
try:
    d = json.loads(sys.stdin.read())
    print(d.get("tool_input", {}).get("command", ""))
except Exception:
    pass
' 2>/dev/null) || exit 0

[ -z "$CMD" ] && exit 0

# Detect a `git push` invocation anywhere in the command. The harness sends
# the FULL bash string, including chained forms (`git add && git push`),
# env-var prefixes (`FOO=1 git push`), global options (`git -C dir push`),
# and quoted strings inside other commands (`echo "git push"`).
#
# Earlier versions used pure bash regex; that was good enough until Codex
# pointed out cases like `git checkout push` (where `push` is a branch/
# remote/refspec name) would false-fire because the regex couldn't tell a
# global-option middle from a subcommand+arg pair. Switched to shlex-based
# tokenization which handles quoting properly and lets us check the actual
# subcommand position.
PUSH_FOUND=$(printf '%s' "$CMD" | python3 -c '
import sys, shlex
try:
    raw_tokens = shlex.split(sys.stdin.read(), posix=True)
except ValueError:
    sys.exit(0)

# shlex with posix=True does not treat shell metacharacters like `(`, `)`,
# `{`, `}` as syntax — it bundles them into adjacent word tokens. So
# `(git push)` becomes `["(git", "push)"]` rather than the conceptual
# `["(", "git", "push", ")"]`. Strip leading/trailing subshell chars from
# each token so the matcher sees the underlying command words.
def strip_subshell(tok):
    return tok.lstrip("({").rstrip(")}")

tokens = [strip_subshell(t) for t in raw_tokens]
tokens = [t for t in tokens if t]

# Tokens that act as command boundaries. shlex.split keeps these as single
# tokens (e.g. "&&", ";", "|", "||"). After such a token, the next argv
# starts fresh, so we treat them as resets.
BOUNDARIES = {";", "&&", "||", "|", "&", "\n"}

# Global-option flags that take a value as the next token.
GIT_GLOBAL_VALUE_FLAGS = {
    "-C", "-c", "--git-dir", "--work-tree", "--namespace",
    "--super-prefix", "--exec-path", "--config-env", "--list-cmds",
    "--attr-source",
}

def find_push(toks):
    i = 0
    n = len(toks)
    while i < n:
        # Skip env-var assignments like FOO=1 (only at the start of an argv).
        while i < n and "=" in toks[i] and not toks[i].startswith("-") \
              and toks[i].split("=", 1)[0].replace("_", "").isalnum():
            i += 1
        if i >= n:
            return False
        if toks[i] == "git":
            j = i + 1
            # Walk past global flags.
            while j < n and toks[j].startswith("-"):
                if toks[j] in GIT_GLOBAL_VALUE_FLAGS and j + 1 < n:
                    j += 2
                else:
                    j += 1
            # The first non-flag token is the subcommand.
            if j < n and toks[j] == "push":
                return True
        # Advance past the current argv to the next command boundary.
        while i < n and toks[i] not in BOUNDARIES:
            i += 1
        # Skip the boundary itself.
        while i < n and toks[i] in BOUNDARIES:
            i += 1
    return False

print("1" if find_push(tokens) else "")
' 2>/dev/null)

[ -z "$PUSH_FOUND" ] && exit 0

# Find the PR for the current branch (skip silently if none).
BRANCH=$(git branch --show-current 2>/dev/null) || exit 0
[ -z "$BRANCH" ] && exit 0

PR_NUMBER=$(gh pr list --head "$BRANCH" --json number --jq '.[0].number // empty' 2>/dev/null) || exit 0
[ -z "$PR_NUMBER" ] && exit 0

# Detect stale gh — the GraphQL `projectCards` deprecation that breaks
# `gh pr edit` was filed Oct 2025 (cli/cli#11992); fixes have been rolling
# out since ~v2.85+. Even on the latest version `gh pr edit` may still 400
# in some cases (issue still open as of 2026-04), so we always recommend
# REST PATCH — but if gh is markedly old we add an upgrade hint.
GH_OLD_HINT=""
GH_VERSION=$(gh --version 2>/dev/null | head -1 | awk '{print $3}')
GH_MAJOR=$(printf '%s' "$GH_VERSION" | cut -d. -f1)
GH_MINOR=$(printf '%s' "$GH_VERSION" | cut -d. -f2)
if [ -n "$GH_MAJOR" ] && [ -n "$GH_MINOR" ]; then
  # < v2.85 is "old" for the projectCards regression.
  if [ "$GH_MAJOR" = "2" ] && [ "$GH_MINOR" -lt 85 ] 2>/dev/null; then
    GH_OLD_HINT=" Your gh is ${GH_VERSION} (latest is 2.91+); upgrade with \\\`brew upgrade gh\\\` or \\\`sudo apt install --only-upgrade gh\\\`."
  fi
fi

# Build the nudge message in a quoted heredoc — bash does NOT interpolate,
# so we can write the inner shell snippets the user will copy-paste with
# their literal quoting intact. Substitution into Python is via env vars
# (PR_NUMBER / GH_OLD_HINT) plus an f-string.
#
# The advertised inner command is `python3 -c '<single-quoted code>' < file`
# so it has no nested double-quote escaping (the previous form
# `python3 -c "json.dumps({\"body\": open(\"…\").read()})"` was unparseable
# after the harness stripped one layer of escaping — Codex P2 catch).
PR_NUMBER="$PR_NUMBER" GH_OLD_HINT="$GH_OLD_HINT" python3 <<'PYEOF'
import json, os
pr = os.environ['PR_NUMBER']
hint = os.environ['GH_OLD_HINT']
msg = f"""📝 Pushed to PR #{pr}. PR descriptions go stale fast — if the just-pushed commits change what this PR does (new behavior, new edge cases, reverted things, scope creep), update the description to match.

Follow the repo template: `## Visual Changes` / `## Affected Places` / `## Tech Details`. Keep the body short — wrap rationale and history in `<details>`.

Update via REST PATCH (`gh pr edit` may 400 with a deprecated GraphQL endpoint error — still open in cli/cli#11992):{hint}

  python3 -c 'import json,sys; print(json.dumps({{"body": sys.stdin.read()}}))' < /tmp/pr_body.md > /tmp/pr_body.json
  gh api repos/OWNER/REPO/pulls/{pr} -X PATCH --input /tmp/pr_body.json
"""
# PostToolUse uses the same nested shape as PreToolUse:
#   {hookSpecificOutput: {hookEventName, additionalContext}}
print(json.dumps({
    'hookSpecificOutput': {
        'hookEventName': 'PostToolUse',
        'additionalContext': msg,
    },
}))
PYEOF
exit 0
