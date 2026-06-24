#!/usr/bin/env bash
# .claude/scripts/pr-feedback.sh — Discover ALL feedback surfaces on a PR
# (line-anchored threads + top-level review bodies). Codex P2/P1 findings
# post as the latter, never as threads. Triage rules for the output live in
# .claude/skills/triage-pr-comment/SKILL.md (Step 1).
#
# Usage: pr-feedback.sh <PR_NUMBER> [<SINCE_ISO8601>] [--full]
#   PR_NUMBER       — required
#   SINCE_ISO8601   — optional cutoff for review bodies. Default: PR HEAD's
#                     committed-at timestamp. ⚠️ The default assumes all
#                     pre-HEAD feedback was already addressed — after a fix
#                     push it DROPS unaddressed reviews on prior SHAs. The
#                     safe wide cutoff is the PR's createdAt; already-addressed
#                     reviews are filtered by the caller's dedupe scan
#                     (#pullrequestreview-<id> quotes in own PR comments),
#                     not by this cutoff. See SKILL.md Step 1.
#   --full          — emit untruncated bodies. Without it, thread bodies are
#                     capped at 400 chars and review bodies at 600: the default
#                     output is a cheap INVENTORY for context budget — fetch
#                     the full body (rerun with --full) before any decide/fix
#                     action, or severity markers / diff blocks may be cut off.
#
# Output: two JSON arrays separated by markers, suitable for jq parsing.
#   ===THREADS===
#   [{thread_id, comment_id, author, path, line, body}, ...]
#   ===REVIEWS===
#   [{id, author, state, submitted, body}, ...]
set -euo pipefail

PR=""
SINCE=""
FULL=0
for arg in "$@"; do
  case "$arg" in
    --full) FULL=1 ;;
    *)
      if [[ -z "$PR" ]]; then PR="$arg"
      elif [[ -z "$SINCE" ]]; then SINCE="$arg"
      else echo "Usage: $0 <PR_NUMBER> [<SINCE_ISO8601>] [--full]" >&2; exit 2
      fi ;;
  esac
done

if [[ -z "$PR" || ! "$PR" =~ ^[0-9]+$ ]]; then
  echo "Usage: $0 <PR_NUMBER> [<SINCE_ISO8601>] [--full]" >&2
  exit 2
fi
# A malformed SINCE must fail loudly: jq's string compare against a bad cutoff
# silently empties the REVIEWS array — exactly the dropped-feedback failure
# mode this script exists to prevent.
if [[ -n "$SINCE" && ! "$SINCE" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]+)?(Z|[+-][0-9]{2}:[0-9]{2})$ ]]; then
  echo "Invalid SINCE '$SINCE' — expected ISO8601 (e.g. 2026-06-11T00:00:00Z)" >&2
  echo "Usage: $0 <PR_NUMBER> [<SINCE_ISO8601>] [--full]" >&2
  exit 2
fi

OWNER_REPO=$(gh pr view "$PR" --json url --jq '.url' \
  | sed -E 's|https://github\.com/([^/]+/[^/]+)/.*|\1|')
OWNER="${OWNER_REPO%/*}"
REPO="${OWNER_REPO#*/}"

if [[ -z "$SINCE" ]]; then
  # Default: the timestamp of the PR's HEAD commit (see header caveat).
  # Note: `gh pr view --json commits` returns commits with `committedDate`
  # at the top level (NOT under `.commit.committedDate` like REST does).
  SINCE=$(gh pr view "$PR" --json commits \
    --jq '.commits[-1].committedDate // ""')
  [[ -z "$SINCE" ]] && SINCE="2000-01-01T00:00:00Z"
fi

if [[ "$FULL" -eq 1 ]]; then
  THREAD_BODY='.comments.nodes[0].body'
  REVIEW_BODY='.bodyText'
else
  THREAD_BODY='(.comments.nodes[0].body[:400])'
  REVIEW_BODY='(.bodyText[:600])'
fi

# 1) Unresolved review threads (line-anchored)
echo "===THREADS==="
gh api graphql -f query="
query {
  repository(owner: \"$OWNER\", name: \"$REPO\") {
    pullRequest(number: $PR) {
      reviewThreads(first: 100) {
        nodes {
          id isResolved isOutdated
          comments(first: 1) {
            nodes { databaseId author { login } path line body }
          }
        }
      }
    }
  }
}" --jq ".data.repository.pullRequest.reviewThreads.nodes
        | map(select(.isResolved == false))
        | map({thread_id: .id,
               comment_id: .comments.nodes[0].databaseId,
               author: .comments.nodes[0].author.login,
               path: .comments.nodes[0].path,
               line: .comments.nodes[0].line,
               body: $THREAD_BODY})"

# 2) Top-level review bodies (Codex P2/P1 land here)
#    No isResolved field exists for review submissions — the caller dedupes
#    already-addressed ones via its reply-quote scan; SINCE only narrows.
#    Bodies under 50 chars are noise (👍 reactions, etc).
echo "===REVIEWS==="
gh api graphql -f query="
query {
  repository(owner: \"$OWNER\", name: \"$REPO\") {
    pullRequest(number: $PR) {
      reviews(first: 50) {
        nodes { databaseId author { login } state submittedAt bodyText }
      }
    }
  }
}" --jq ".data.repository.pullRequest.reviews.nodes
        | map(select((.bodyText // \"\") | length > 50))
        | map(select(.submittedAt > \"$SINCE\"))
        | map({id: .databaseId,
               author: .author.login,
               state: .state,
               submitted: .submittedAt,
               body: $REVIEW_BODY})
        | sort_by(.submitted) | reverse"
