#!/bin/bash
# PostToolUse hook: auto-format Ruby files with RuboCop after Edit/Write
# Exit 0 = success, Exit 2 = offenses remain (fed back to Claude)
# Fail-safe: silently exits if ruby/bundle/rubocop unavailable (for users without host Ruby)

# Bail if jq unavailable
command -v jq >/dev/null 2>&1 || exit 0

FILE=$(jq -r '.tool_input.file_path // empty')
[ -z "$FILE" ] && exit 0
[[ "$FILE" =~ \.rb$ ]] || exit 0
FILE=$(realpath "$FILE" 2>/dev/null) || exit 0

# Run RuboCop from the worktree that owns $FILE — not from the Claude session's
# cwd. Otherwise rubocop loads two .rubocop.yml configs (one from PWD, one
# walked up from $FILE), each runs its relative `require:` paths, and the
# custom cops get defined twice from different absolute paths — producing
# "already initialized constant" warnings under cross-worktree edits.
DIR=$(dirname "$FILE")
while [ "$DIR" != "/" ] && [ ! -f "$DIR/.rubocop.yml" ]; do
  DIR=$(dirname "$DIR")
done
[ -f "$DIR/.rubocop.yml" ] || exit 0
cd "$DIR" || exit 0

command -v bundle >/dev/null 2>&1 || exit 0
bundle show rubocop >/dev/null 2>&1 || exit 0

# Auto-fix what we can
bundle exec rubocop -A --format quiet "$FILE" 2>/dev/null

# Check if offenses remain — exit 2 so Claude sees them
OUTPUT=$(bundle exec rubocop --format simple "$FILE" 2>&1)
if [ $? -ne 0 ]; then
  echo "$OUTPUT" >&2
  exit 2
fi
