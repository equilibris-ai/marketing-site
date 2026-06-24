#!/usr/bin/env bash
# coderabbit-review.sh — Run a soft, local CodeRabbit review of the current
# branch / working-tree diff. The pre-push counterpart to the PR-based
# review-pr-comments / ci-review skills.
#
# Modeled on .claude/skills/implement-feature/scripts/codex-review.sh, with ONE
# deliberate divergence: CodeRabbit unavailability is a SILENT SKIP, never a
# BLOCK. This script therefore ALWAYS exits 0 — callers (the /local-coderabbit
# skill and the implement-feature / fix-bug pipelines) must never be gated by it.
#
# Usage:
#   coderabbit-review.sh [--mode plain|agent] [--type all|committed|uncommitted]
#                        [--base-commit <sha>]
#
#   --mode         plain  → human-readable severity-grouped report (interactive)
#                  agent  → structured findings for agent/pipeline consumption
#                  (default: agent)
#   --type         scope of the review (default: all = committed + uncommitted)
#   --base-commit  base commit to diff against
#                  (default: git merge-base HEAD origin/master)
#
# Output (stdout) — the STATUS LINE is ALWAYS emitted LAST so callers extract it
# with `tail -n 1`:
#   On success:        <review text / structured findings>\n[coderabbit] ok
#   On no findings:    <clean message>\n[coderabbit] ok:clean
#   On not-ready:      [coderabbit] skipped: <reason>   # CLI missing / not authed
#   On runtime error:  [coderabbit] errored: <reason>   # timeout / crash / network
#
# Exit code: ALWAYS 0. Soft by construction — never blocks a caller.
#
# Notes:
#   - Stderr from CodeRabbit is captured internally; first 300 bytes surfaced in
#     the "errored:" reason. Never propagated to the caller's stderr.
#   - Timeout ladder: GNU `timeout` → `gtimeout` (macOS coreutils) → none.
#   - Uses `--base-commit` (not `git diff master`) per repo convention: local
#     `master` is frequently stale in worktrees, so we diff the merge-base.
#   - `--prompt-only` is a DEPRECATED alias for `--agent`; we use `--agent`.

set -u

mode="agent"
type="all"
base_commit=""

# ---- Parse args ----
while [ "$#" -gt 0 ]; do
  case "$1" in
    --mode)        mode="${2:-agent}"; shift 2 ;;
    --type)        type="${2:-all}"; shift 2 ;;
    --base-commit) base_commit="${2:-}"; shift 2 ;;
    *)             shift ;;   # ignore unknown args — soft by construction
  esac
done

case "$mode" in
  plain|agent) ;;
  *) mode="agent" ;;
esac

# ---- Gate 1: CLI must be installed. ----
if ! command -v coderabbit >/dev/null 2>&1; then
  echo "[coderabbit] skipped: CLI not installed (https://www.coderabbit.ai/cli)"
  exit 0
fi

# ---- Gate 2: CLI must be ready (authenticated, backend reachable, in a repo). ----
# `coderabbit doctor` exits non-zero when any readiness check fails.
if ! coderabbit doctor >/dev/null 2>&1; then
  echo "[coderabbit] skipped: not ready (run 'coderabbit auth login' or 'coderabbit doctor')"
  exit 0
fi

# ---- Resolve base commit (merge-base with origin/master by default). ----
if [ -z "$base_commit" ]; then
  base_commit="$(git merge-base HEAD origin/master 2>/dev/null || true)"
fi

# ---- Portable timeout ladder: timeout → gtimeout → none. ----
if command -v timeout >/dev/null 2>&1; then
  cr_timeout="timeout 300s"
elif command -v gtimeout >/dev/null 2>&1; then
  cr_timeout="gtimeout 300s"
else
  cr_timeout=""
fi

# ---- Run the review. Capture stderr separately so it never leaks. ----
# Feed the repo's CLAUDE.md as additional instructions so the review honors
# project conventions, mirroring what the PR reviewer sees.
config_args=()
[ -f CLAUDE.md ] && config_args=(-c CLAUDE.md)

base_args=()
[ -n "$base_commit" ] && base_args=(--base-commit "$base_commit")

cr_err=$(mktemp)
if cr_out=$($cr_timeout coderabbit review --"$mode" --type "$type" \
             "${base_args[@]}" "${config_args[@]}" 2>"$cr_err"); then
  printf '%s\n' "$cr_out"
  # Detect a clean review. --agent emits a structured completion record
  # (`{"type":"complete",...,"findings":0}`); --plain prints a "no issues"
  # style message. Match either.
  if printf '%s' "$cr_out" | grep -qE '"findings"[[:space:]]*:[[:space:]]*0\b' \
     || printf '%s' "$cr_out" | grep -qiE 'no (issues|findings|comments)'; then
    echo "[coderabbit] ok:clean"
  else
    echo "[coderabbit] ok"
  fi
  rm -f "$cr_err"
  exit 0
else
  reason="$(head -c 300 "$cr_err" | tr '\n' ' ')"
  rm -f "$cr_err"
  [ -n "$reason" ] || reason="coderabbit review exited non-zero"
  echo "[coderabbit] errored: $reason"
  exit 0
fi
