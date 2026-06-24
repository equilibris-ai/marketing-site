#!/usr/bin/env bash
# Print the Chromatic build URL + APP_ID + BUILD number for a PR.
# Usage: chromatic-build-info.sh <PR_NUMBER>
#
# We can't fetch the diff snapshots ourselves — Chromatic's GraphQL API
# requires user-level auth (login session or User API token, not the
# project token in .env). What we CAN surface:
#   - the build URL (so the user opens it)
#   - the change count (from the chromatic-com check_run output)
#
# Once the user shares specific snapshot URLs (right-click "Copy image
# address" on a chromatic.com build page), they can be WebFetch'd and
# inspected.

set -euo pipefail

PR="${1:?Usage: $0 <PR_NUMBER>}"
REPO="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"
SHA="$(gh pr view "$PR" --json headRefOid --jq '.headRefOid')"

# The chromatic-com GitHub App posts a check_run per commit. Newer commits
# may have it queued/cancelled; walk back up to 5 commits to find one with
# a completed chromatic check.
for offset in 0 1 2 3 4; do
  CHECK_SHA=$(git rev-parse "$SHA~$offset" 2>/dev/null || true)
  [ -z "$CHECK_SHA" ] && continue
  RESULT=$(gh api "repos/$REPO/commits/$CHECK_SHA/check-runs?per_page=100" \
    --jq '.check_runs[] | select(.app.slug == "chromatic-com" and .conclusion != null) | {sha: "'"$CHECK_SHA"'", name, conclusion, html_url, details_url, summary: .output.summary}' 2>/dev/null | head -1)
  if [ -n "$RESULT" ]; then
    echo "$RESULT" | python3 -m json.tool
    exit 0
  fi
done

echo "No completed chromatic-com check found in the last 5 commits — chromatic may still be running." >&2
exit 1
