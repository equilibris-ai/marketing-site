#!/bin/bash
# ============================================================================
# nudge-gh-pr-body — PreToolUse hook
# ============================================================================
#
# Always-nudge reminder pointing at `.github/PULL_REQUEST_TEMPLATE.md` when
# any of these body-setting gh shapes is invoked:
#
#   - `gh pr create`                                    (editor flow uses the
#                                                       template too — fire
#                                                       even without body args)
#   - `gh pr edit  … --body | --body-file`              (only when body is touched —
#                                                       silent on label/assignee edits)
#   - `gh api … pulls/<n> … -X PATCH …`                 (REST PR-edit form, the
#                                                       cli/cli#11992 workaround) —
#                                                       fire when the command
#                                                       string mentions `body`
#
# Always exits 0; emits JSON on stdout. PreToolUse stderr is dropped, so any
# nudge MUST go through `additionalContext`.
#
# ----------------------------------------------------------------------------
# Why always-nudge
# ----------------------------------------------------------------------------
#
# Matches the convention of the other nudge hooks in this directory
# (`pr-desc-nudge.sh`, `e2e-stack-nudge.sh`, `lsp-reminder.sh`): condition on
# the COMMAND SHAPE, not on the content of what the command is doing. The
# firing is the reminder; the agent is trusted to compare the body against
# the template.
#
# Earlier versions tried to parse the body, compare sections to the template,
# and fire only when sections were missing. That worked but added marked +
# shell-quote dependencies, an async/ESM dance, and ~250 LoC for what
# `pr-desc-nudge` does in 50. The added precision didn't translate to better
# outcomes — compliance data showed conditional vs always wasn't the
# load-bearing variable.
#
# ----------------------------------------------------------------------------
# Why a Claude-Code hook and not a GitHub Action
# ----------------------------------------------------------------------------
#
# Considered: a GitHub Action that runs on `pull_request` events, reads the
# PR body, and fails the check (potentially blocking merge via branch
# protection) when sections are missing. Theoretically stronger because it
# catches every PR regardless of how it was created (web UI, gh CLI, API)
# and can hard-block via branch protection.
#
# Skipped: compliance data after the original create-only hook landed (~30
# PRs in 3-day windows pre/post): 87% → 97% template-following, with the
# single post-hook miss likely from a web-UI / non-Claude-Code path.
# Marketplace Actions for this niche are sparsely maintained (top hits 7-star
# single-maintainer repos), and a custom workflow is ongoing infra to own.
# Hook also gives pre-execution feedback the Action can't.
#
# If the web-UI outlier rate climbs in practice, the Action path stays open.
# Sketch lives in PR #12340's description.
# ============================================================================
set -u

# Read the JSON payload from stdin and pull `tool_name` + `tool_input.command`.
# python3 is preinstalled on macOS + Ubuntu — no jq dependency.
INPUT=$(cat)
[ -z "$INPUT" ] && { echo '{}'; exit 0; }

CMD=$(printf '%s' "$INPUT" | python3 -c '
import sys, json
try:
    d = json.loads(sys.stdin.read())
    if d.get("tool_name") != "Bash":
        sys.exit(0)
    print(d.get("tool_input", {}).get("command", ""))
except Exception:
    pass' 2>/dev/null)
[ -z "$CMD" ] && { echo '{}'; exit 0; }

# Decide whether to nudge. Stricter than the settings.json `if:` filter
# (which uses leading-wildcard `Bash(*gh pr create*)` so chained / env-prefixed
# commands still invoke this script). The script's own regex requires the
# verb at a word boundary so we don't fire on `echo "gh pr create"` or
# commit messages.
WB='(^|[^A-Za-z0-9])'

NUDGE=0

# `gh pr create …` — always nudge. Editor flow opens the template, so even
# invocations without --body benefit from the reminder.
if [[ "$CMD" =~ ${WB}gh[[:space:]]+pr[[:space:]]+create([[:space:]]|$) ]]; then
  NUDGE=1
# `gh pr edit …` — nudge only when body is being touched. Label/assignee/
# title-only edits don't need a template reminder.
elif [[ "$CMD" =~ ${WB}gh[[:space:]]+pr[[:space:]]+edit[[:space:]] ]]; then
  # `-F` is the short form of `--body-file` in `gh pr edit` (different from
  # `gh api` where `-F` is `--field`). Only matched in the edit branch.
  if [[ "$CMD" =~ (^|[[:space:]])(-b|-F|--body|--body-file)([[:space:]]|=) ]]; then
    NUDGE=1
  fi
# `gh api … pulls/<n> … -X PATCH …` (REST PR-edit, cli/cli#11992 workaround) —
# nudge when command mentions `body` (any form). State/title-only PATCHes
# pass silently. Loose substring match mirrors e2e-stack-nudge convention;
# false positives are cheap on a non-blocking nudge and outweighed by
# simplicity.
elif [[ "$CMD" =~ ${WB}gh[[:space:]]+api([[:space:]]|$) ]] \
  && [[ "$CMD" =~ /pulls/[0-9]+ ]] \
  && [[ "$CMD" =~ (-X|--method)([[:space:]]+|=)PATCH ]] \
  && { [[ "$CMD" =~ (^|[^A-Za-z0-9])body([^A-Za-z0-9]|$) ]] || [[ "$CMD" =~ --input ]]; }; then
  # PATCH on /pulls/N nudges if the command mentions `body` (any inline
  # form: -f body=, -F body=@file, --field body=) OR uses --input (the
  # JSON-file form whose body lives in the file, not the command line).
  # State/title-only PATCHes use `-f state=` / `-f title=` and stay silent.
  NUDGE=1
fi

if [ "$NUDGE" -eq 0 ]; then
  echo '{}'
  exit 0
fi

# Emit the nudge JSON. Quoted heredoc so bash doesn't try to interpolate
# anything inside the message body.
cat <<'EOF'
{"hookSpecificOutput":{"hookEventName":"PreToolUse","additionalContext":"📝 Reminder: PR body should follow .github/PULL_REQUEST_TEMPLATE.md (Visual Changes / Affected Places / Tech Details). PR #12217 is the canonical example."}}
EOF
exit 0
