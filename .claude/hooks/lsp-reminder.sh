#!/bin/bash
# PreToolUse hook: when Grep/Glob is called with a symbol-like query, nudge
# Claude toward the native LSP tool. Non-blocking: always exits 0 and emits
# additionalContext so the original tool still runs.

INPUT=$(cat)
[ -z "$INPUT" ] && exit 0
command -v python3 >/dev/null 2>&1 || exit 0

HOOK_INPUT="$INPUT" python3 <<'PY'
import json, os, re, sys
try:
    data = json.loads(os.environ.get("HOOK_INPUT", ""))
except Exception:
    sys.exit(0)

tool = data.get("tool_name", "")
if tool not in ("Grep", "Glob"):
    sys.exit(0)

inp = data.get("tool_input", {}) or {}
pattern = inp.get("pattern", "") or ""

# Skip empty, too-long, or clearly-non-identifier queries.
if not pattern or len(pattern) > 80:
    sys.exit(0)
if re.search(r'[/\\\[\]\{\}\(\)\^\$\?\|\+\*]|\.\*', pattern):
    sys.exit(0)
if not re.fullmatch(r'[A-Za-z_][A-Za-z0-9_]{2,}', pattern):
    sys.exit(0)

hint = (
    f"LSP hint: `{pattern}` looks like a symbol. If you need its definition, "
    f"references, type, or callers, prefer the native `LSP` tool "
    f"(`operation: goToDefinition` / `findReferences` / `hover` / "
    f"`documentSymbol` / `workspaceSymbol` / `incomingCalls`) — exact, fast, "
    f"token-cheap. Continue with the current Grep/Glob call only if you're "
    f"doing a genuine text search (substring in comments, log messages, "
    f"multi-word phrases)."
)
print(json.dumps({"hookSpecificOutput": {"hookEventName": "PreToolUse", "additionalContext": hint}}))
PY
exit 0
