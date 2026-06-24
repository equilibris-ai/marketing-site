#!/usr/bin/env bash
#
# PostToolUse hook on Bash. When Claude runs `git worktree add`, symlinks
# the primary worktree's `.env*.local` files into every non-primary worktree
# that's missing them.
#
# WHY a Claude Code hook rather than a git `post-checkout` hook
# -------------------------------------------------------------
# Earlier iterations of this PR shipped a `post-checkout` hook (first
# hand-rolled, then via husky). Both work, but both have the same downside:
# `post-checkout` fires on EVERY git checkout, switch, rebase commit, etc.,
# not just `worktree add`. We relied on the hook body's guards (primary
# worktree detect + per-file existence check) to keep it no-op in unrelated
# triggers — which is *correct* but felt brittle. Concerns documented during
# review:
#
#   - Spurious firings on `git rebase` (once per replayed commit), `git pull
#     --rebase`, `git switch`, IDE-driven checkouts, etc. All no-op in
#     steady state, but a parse miss or guard regression would have a wide
#     blast surface.
#   - "Self-healing on deleted files" surprised devs who deliberately
#     removed a symlink and saw it reappear.
#   - Required modifying `core.hooksPath` in every developer's `.git/config`
#     (via husky's prepare hook or our own postinstall script).
#   - Husky adds a devDependency for what is fundamentally one line of bash.
#
# Switching to a Claude Code `PostToolUse` hook narrows the trigger surface
# to exactly the operation we care about (`git worktree add`) and reuses
# archive's existing `.claude/hooks/` infrastructure (gate-git-push,
# nudge-linear-mcp, etc).
#
# Trade-off accepted: this hook ONLY fires when Claude Code is the one
# running `git worktree add`. Manual `git worktree add` from a terminal or
# IDE menu does not trigger it — those devs still need to copy env files
# themselves. At archive this is acceptable because worktree creation is
# overwhelmingly Claude-driven; teammates can invoke this script by hand
# if they need (`.claude/hooks/symlink-worktree-env.sh`) or just `cp` the
# files.
#
# Design notes
# ------------
# - No command-line parsing. Instead of trying to extract the new worktree
#   path from the `git worktree add` invocation (which has many flag forms
#   — `-b`, `-B`, `--track`, `--orphan`, quoted paths, env prefixes), we
#   walk `git worktree list --porcelain` and symlink into every non-primary
#   worktree missing the env files. Idempotent, self-healing, no fragile
#   regex.
# - Always exits 0 (PostToolUse hooks don't block). Errors print to stderr
#   and surface in the Claude Code log but never derail the tool flow.

set -euo pipefail

# Read JSON payload from stdin (Claude Code hook contract).
#
# Three invocation modes, all supported:
#   1. Claude Code PostToolUse: framework pipes JSON + closes stdin. We parse
#      it and filter by `git worktree add` command (defense-in-depth on top
#      of settings.json's `if: "Bash(*git worktree add*)"` matcher).
#   2. Manual interactive run (`./symlink-worktree-env.sh` in a terminal):
#      stdin is a TTY. Skip the read entirely (otherwise `cat` would block
#      waiting for EOF). Proceed straight to the worktree walk.
#   3. Manual scripted run (`./symlink-worktree-env.sh </dev/null` or piped
#      empty): stdin is closed/empty. Read returns empty, command filter is
#      skipped, proceed.
INPUT=""
if [ ! -t 0 ]; then
  INPUT=$(cat 2>/dev/null || true)
fi

# If stdin had a payload (mode 1), filter by command. Empty payload (modes
# 2 & 3) means manual invocation — just proceed.
if [ -n "$INPUT" ]; then
  CMD=$(printf '%s' "$INPUT" | jq -r '.tool_input.command // ""' 2>/dev/null || echo "")
  printf '%s' "$CMD" | grep -qE '(^|[^[:alnum:]])git[[:space:]]+worktree[[:space:]]+add\b' || exit 0
fi

# Resolve the primary worktree's root via git-common-dir (shared across all
# worktrees of this clone). Without this we can't know what to symlink from.
common_dir=$(git rev-parse --git-common-dir 2>/dev/null || true)
[ -n "$common_dir" ] || exit 0
primary_root=$(cd "$common_dir/.." && pwd -P) || exit 0

# Walk every worktree git knows about. We strip the `worktree ` prefix with
# `sed` (not `awk '{print $2}'`, which would truncate at the first space —
# so a worktree at `/home/me/My Project/repo` would parse as `/home/me/My`).
# Sed prefix-stripping preserves anything that isn't a newline.
#
# (`git worktree list --porcelain -z` would be NUL-safe, but it was added
# in git 2.36; we support git 2.34+ which doesn't recognize the flag.)
#
# Record shape per `git worktree list --porcelain`:
#   worktree /abs/path/to/wt
#   HEAD <sha>
#   branch refs/heads/<name>
git -C "$primary_root" worktree list --porcelain 2>/dev/null \
  | sed -n 's/^worktree //p' \
  | while IFS= read -r wt; do
      [ "$wt" = "$primary_root" ] && continue
      [ -d "$wt" ] || continue

      for f in .env.local .env.test.local .env.e2e.local; do
        src="$primary_root/$f"
        dst="$wt/$f"
        # `! -e` skips files + working symlinks (which `-e` follows).
        # `! -L` additionally skips DANGLING symlinks so we don't trip
        # ln -s on a path occupied by a broken link.
        if [ -f "$src" ] && [ ! -e "$dst" ] && [ ! -L "$dst" ]; then
          ln -s "$src" "$dst"
          echo "[symlink-worktree-env] symlinked $f into $(basename "$wt")"
        fi
      done
    done

exit 0
