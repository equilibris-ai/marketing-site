#!/usr/bin/env bash
#
# .claude/scripts/comments-watch.sh — Quiet PR-activity watcher for Monitor.
#
# Polls a PR's `updated_at` timestamp via the REST API. Emits exactly one
# stdout line each time it advances — i.e., something happened on the PR
# (new comment, new review, edited body, label, push, etc.). The
# orchestrator processes the change and re-fetches unresolved threads;
# false positives (label changes, etc.) are cheap because the
# orchestrator finds 0 unresolved threads and exits.
#
# Why dumb-poll instead of GraphQL pagination + thread-count + max-id
# tracking: the prior version was ~125 lines defending against three
# layers of edge cases (pagination, count-only signal missing follow-ups,
# self-replies bumping ids). PR `updated_at` is one HTTP field that
# advances on any actionable change. ~50 lines beats ~125 lines for the
# same orchestrator-visible behavior.
#
# Consumers (Monitor-armed; what to do on NEW_COMMENTS lives in
# .claude/skills/triage-pr-comment/SKILL.md):
#   review-pr-comments SKILL.md Step 6 (wait-loop)
#   implement-feature SKILL.md 7b-2, fix-bug SKILL.md 7b (alongside ci-watch.sh)
#   Monitor( command: "bash .claude/scripts/comments-watch.sh <PR>" )
#
# Emission contract:
#   NEW_COMMENTS:<updated_at>      updated_at advanced beyond baseline
#   (silent exit)                  10 min of no advance — PR went quiet.
#   COMMENTS_WATCH:ERROR (...)     gh api failed 10× consecutively (exit 1)
#
# Re-arm rule (CI-length watches): for pipeline callers that watch comments
# for the whole CI duration (implement-feature 7b-2, fix-bug 7b), a quiet
# exit while CI is still running is NOT "done" — re-arm this watcher until
# ci-watch.sh emits its CI_DONE token. The 10-min quiet exit itself stays:
# review-pr-comments Step 6 relies on it as the wait-loop bound.
#
# Trade-off: emits on label / title / push / review-state changes too.
# In practice these arrive bundled with comment activity on bot reviews,
# and the orchestrator's "fetch unresolved threads" check is cheap.

set -u

PR="${1:-}"
[ -n "$PR" ] || { echo "usage: comments-watch.sh <pr-number>" >&2; exit 64; }

# Self-dedupe via pidfile (mirrors ci-watch.sh). /compact resets the
# orchestrator's TaskList, so stacked watchers accumulate across compacts
# unless the script itself enforces single-instance-per-PR.
PIDFILE="/tmp/comments-watch-pr-$PR.pid"
if [ -f "$PIDFILE" ]; then
  prev=$(cat "$PIDFILE" 2>/dev/null || true)
  if [ -n "${prev:-}" ] && [ "$prev" != "$$" ] && kill -0 "$prev" 2>/dev/null; then
    # Cross-platform identity check: ps works on Linux + macOS.
    cmdline=$(ps -p "$prev" -o command= 2>/dev/null || true)
    case "$cmdline" in
      *"comments-watch.sh $PR"*) kill "$prev" 2>/dev/null || true; sleep 1 ;;
      *)                         : ;;
    esac
  fi
fi
echo "$$" > "$PIDFILE"
trap '[ "$(cat "$PIDFILE" 2>/dev/null)" = "$$" ] && rm -f "$PIDFILE"' EXIT

repo=$(gh repo view --json nameWithOwner --jq .nameWithOwner 2>/dev/null) || {
  echo "comments-watch: gh repo view failed (not in a repo dir, or auth bad)" >&2; exit 1; }

# Cap consecutive API failures so the script terminates explicitly
# rather than retrying forever on auth expiry / outage / bad PR.
MAX_ERRORS=10  # 10 × 30s = 5 min of consecutive failures
consecutive_errors=0
last_seen=""
quiet_rounds=0
while true; do
  current=$(gh api "repos/$repo/pulls/$PR" --jq .updated_at 2>/dev/null || true)

  if [ -z "$current" ] || [ "$current" = "null" ]; then
    consecutive_errors=$((consecutive_errors + 1))
    if [ "$consecutive_errors" -ge "$MAX_ERRORS" ]; then
      echo "COMMENTS_WATCH:ERROR (gh api failed ${MAX_ERRORS}× consecutively)"
      exit 1
    fi
    sleep 30
    continue
  fi
  consecutive_errors=0

  if [ -z "$last_seen" ]; then
    # Baseline. Don't emit on first poll — orchestrator just finished
    # processing, so anything visible now is already accounted for.
    last_seen=$current
  elif [ "$current" != "$last_seen" ]; then
    echo "NEW_COMMENTS:$current"
    last_seen=$current
    quiet_rounds=0
  else
    quiet_rounds=$((quiet_rounds + 1))
  fi

  [ "$quiet_rounds" -ge 20 ] && break  # 10 min quiet → done
  sleep 30
done
