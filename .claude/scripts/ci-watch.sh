#!/usr/bin/env bash
#
# .claude/scripts/ci-watch.sh — Quiet CI watcher for the Monitor tool.
#
# Polls `gh pr checks <PR>` until every check has reached a terminal bucket,
# then emits exactly ONE stdout line:
#   - `CI_DONE:PASS` if every bucket is pass/skipping
#   - `CI_DONE:FAIL (failed-check-name, ...)` if any check failed/cancelled.
#     When every red check is `cancel`-bucket (none truly failed), the line
#     carries an `[ALL cancelled — ...]` annotation after the paren group so
#     the consumer can route to supersession-reconcile WITHOUT reading logs
#     (FRO-186 — collapsing fail+cancel unannotated erased the most decisive
#     triage bit). The aggregate `all-checks` is excluded from the name lists.
#   - `CI_DONE:PASS_PENDING_REVIEW (check, ...)` if the ONLY remaining
#     pending checks are Chromatic's manual-baseline-approval ones
#     (`UI Tests:` / `UI Review:`), which stay pending forever until a
#     human accepts diffs in the Chromatic UI — there is no automated
#     transition we can wait for.
#
# Used by CLAUDE.md hard rule #3:
#   Monitor( command: "bash .claude/scripts/ci-watch.sh <PR>", ... )
#
# Why a script, not inline in CLAUDE.md: the pattern needs to be exact
# (single emission, terminal-bucket detection) and CLAUDE.md noise scales
# with the prose. Encapsulate here, reference there.

set -u

PR="${1:-}"
[ -n "$PR" ] || { echo "usage: ci-watch.sh <pr-number>" >&2; exit 64; }

# Self-dedupe via pidfile. CLAUDE.md rule #3 says "single instance per PR";
# the orchestrator was supposed to TaskStop prior monitors, but /compact
# resets the TaskList while leaving OS processes running, so stacked
# watchers accumulated across compacts. Encapsulating dedup here makes
# the rule load-bearing without depending on the orchestrator's memory.
#
# PID-reuse safety: a stale pidfile (prior watcher SIGKILLed, leaving the
# pidfile behind) could match a recycled PID belonging to an unrelated
# process. `kill -0` only checks liveness, not identity. Verify the target
# is actually ci-watch.sh for THIS PR via /proc/<pid>/cmdline before kill.
# Trap-on-EXIT also restricts to "still our pidfile" to avoid racing a
# replacement instance that already claimed it.
PIDFILE="/tmp/ci-watch-pr-$PR.pid"
if [ -f "$PIDFILE" ]; then
  prev=$(cat "$PIDFILE" 2>/dev/null || true)
  if [ -n "${prev:-}" ] && [ "$prev" != "$$" ] && kill -0 "$prev" 2>/dev/null; then
    # Cross-platform identity check: ps works on Linux + macOS; /proc is Linux-only.
    cmdline=$(ps -p "$prev" -o command= 2>/dev/null || true)
    case "$cmdline" in
      *"ci-watch.sh $PR"*) kill "$prev" 2>/dev/null || true; sleep 1 ;;
      *)                   : ;;  # not our process — leave it alone
    esac
  fi
fi
echo "$$" > "$PIDFILE"
trap '[ "$(cat "$PIDFILE" 2>/dev/null)" = "$$" ] && rm -f "$PIDFILE"' EXIT

# `gh pr checks` (TSV format, no --json — that flag was added in gh 2.42
# but the team's working copies pin to 2.40). Output is one tab-separated
# row per check: <name>\t<bucket>\t<duration>\t<url>[\t<extra>]. The
# bucket field uses gh's normalized values: pass / fail / pending /
# skipping / cancel.
#
# **`gh pr checks` exit code is a STATUS signal, not an error signal.**
# It returns non-zero (typically 8) whenever any check is pending or
# failing — that's gh's overall-status flag, identical to a green run
# only on full pass. We therefore IGNORE the exit code and inspect the
# stdout TSV instead. A real command error (missing gh, auth expiry,
# bad PR number) produces empty stdout or a stderr message without tab
# delimiters; we detect that via "no tab-separated rows found" and
# bound retries at MAX_ERRORS so the script terminates explicitly
# instead of sleeping forever.
MAX_ERRORS=5  # 5 × 60s = 5 min of consecutive API failures
consecutive_errors=0

while true; do
  tsv=$(gh pr checks "$PR" 2>&1) || true  # exit code is status, not error
  buckets=$(awk -F'\t' 'NF >= 2 { print $2 }' <<<"$tsv")

  if [ -z "$buckets" ]; then
    consecutive_errors=$((consecutive_errors + 1))
    if [ "$consecutive_errors" -ge "$MAX_ERRORS" ]; then
      echo "CI_DONE:ERROR (gh pr checks returned no TSV ${MAX_ERRORS}× consecutively: ${tsv})"
      exit 1
    fi
    sleep 60
    continue
  fi
  consecutive_errors=0

  # Chromatic's "UI Tests:" / "UI Review:" checks stay pending forever when
  # visual diffs need manual baseline approval — there's no automated
  # transition to pass/fail, only a human clicking "Accept" in the Chromatic
  # UI. Treat them as non-blocking so the watcher doesn't loop indefinitely
  # on human-gated work; they're surfaced separately as PASS_PENDING_REVIEW
  # below so the orchestrator can flag the manual step.
  pending_blocking=$(awk -F'\t' '$2 == "pending" && $1 !~ /^UI (Tests|Review):/ { print $1 }' <<<"$tsv")
  [ -n "$pending_blocking" ] && { sleep 60; continue; }

  # The branch trigger stays BUCKET-based (raw fail/cancel), because after the
  # all-checks exclusion below BOTH name lists can be empty while a red bucket
  # exists (aggregate-only case — handled by the fallback branch).
  if grep -qE '^(fail|cancel)$' <<<"$buckets"; then
    # Split fail vs cancel name lists (FRO-186): collapsing both into one token
    # erased the single most decisive triage bit. Exclude the all-checks
    # AGGREGATE from both lists and from the all-cancelled test — one cancelled
    # leaf + all else green still FAILS all-checks (its `if: always()` gate
    # mirrors cancelled needs), which would otherwise mislabel a cancelled-only
    # case as mixed.
    failed=$(awk -F'\t' '$2 == "fail" && $1 !~ /all-checks/ { print $1 }' <<<"$tsv" | paste -sd', ')
    cancelled=$(awk -F'\t' '$2 == "cancel" && $1 !~ /all-checks/ { print $1 }' <<<"$tsv" | paste -sd', ')
    # The `CI_DONE:FAIL (...)` prefix is preserved exactly; annotations are
    # appended after the paren group, which is NEVER empty. All consumers
    # (CLAUDE.md rule #3, implement-feature 7b/7c/7d, fix-bug 7d) contains-match
    # the token, not equality, so suffixes are safe. Mixed fail+cancel is
    # deliberately NOT annotated: its action is identical to fail-only (triage →
    # ci-logs.sh, which prints the cancelled names), and brevity wins on a
    # Monitor wake line.
    if [ -n "$failed" ]; then
      echo "CI_DONE:FAIL ($failed) → run the triage-ci-failure skill before fixing or re-triggering"
    elif [ -n "$cancelled" ]; then
      echo "CI_DONE:FAIL ($cancelled) [ALL cancelled — no failure-conclusion checks; run the triage-ci-failure Step 0.5 bucket gate, do NOT read logs]"
    else
      # aggregate-only: every red check matched the all-checks exclusion
      failed=$(awk -F'\t' '$2 == "fail" || $2 == "cancel" { print $1 }' <<<"$tsv" | paste -sd', ')
      echo "CI_DONE:FAIL ($failed) → run the triage-ci-failure skill before fixing or re-triggering"
    fi
  else
    pending_review=$(awk -F'\t' '$2 == "pending" && $1 ~ /^UI (Tests|Review):/ { print $1 }' <<<"$tsv" | paste -sd', ')
    if [ -n "$pending_review" ]; then
      echo "CI_DONE:PASS_PENDING_REVIEW ($pending_review)"
    else
      echo "CI_DONE:PASS"
    fi
  fi
  break
done
