#!/usr/bin/env bash
# Summarize CI check status for a PR.
# Usage: pr-checks-status.sh <PR_NUMBER>
#
# Prints a bucket histogram + lists failures and pending jobs explicitly.
# Exit codes:
#   0  — no failures (may still be pending)
#   1  — at least one check failed
#   2  — usage error
set -euo pipefail

PR="${1:-}"
if [[ -z "$PR" ]]; then
  echo "Usage: $0 <PR_NUMBER>" >&2
  exit 2
fi

# `gh pr checks` returns one TSV row per check: name<TAB>state<TAB>elapsed<TAB>url
# Note: it exits non-zero when ANY check is failing/pending — we still want
# the output. Capture stderr separately so we can distinguish "no PR found"
# from "PR has failures" (the latter is the common case).
checks=$(gh pr checks "$PR" 2>/dev/null || true)
if [[ -z "$checks" ]]; then
  echo "gh pr checks returned no output for PR #$PR (does the PR exist?)" >&2
  exit 2
fi

echo "## CI Status for PR #$PR"
echo
echo "### Buckets"
echo "$checks" | awk -F'\t' '{print $2}' | sort | uniq -c | sort -rn

failures=$(echo "$checks" | awk -F'\t' '$2=="fail" {print "  " $1 " | " $4}')
if [[ -n "$failures" ]]; then
  echo
  echo "### Failures"
  echo "$failures"
fi

pending=$(echo "$checks" | awk -F'\t' '$2=="pending" {print "  " $1}')
if [[ -n "$pending" ]]; then
  echo
  echo "### Pending"
  echo "$pending"
fi

# Exit non-zero only if a check actively failed (pending is fine for the loop)
if [[ -n "$failures" ]]; then
  exit 1
fi
exit 0
