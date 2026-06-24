#!/bin/bash
# PostToolUse hook: auto-format frontend files with Prettier after Edit/Write
# Exit 0 = success, Exit 2 = formatting failed (fed back to Claude)
# Fail-safe: silently exits if node/pnpm/prettier unavailable (for users without host Node)

# Bail if jq unavailable
command -v jq >/dev/null 2>&1 || exit 0

FILE=$(jq -r '.tool_input.file_path // empty')
[ -z "$FILE" ] && exit 0
[[ "$FILE" =~ \.(ts|tsx|js|jsx|cjs|mjs|css|scss|json|yml|yaml)$ ]] || exit 0

PRETTIER="./node_modules/.bin/prettier"
[ -x "$PRETTIER" ] || exit 0

OUTPUT=$("$PRETTIER" --log-level warn --write "$FILE" 2>&1)
if [ $? -ne 0 ]; then
  echo "$OUTPUT" >&2
  exit 2
fi
