#!/usr/bin/env bash
# resolve-thread.sh — Reply to a PR review thread and resolve it ATOMICALLY,
# then verify. Mechanically enforces triage-pr-comment SKILL.md Step 5's
# invariants: reply-before-resolve, resolve-right-after-reply, verify-after —
# one invocation instead of three hand-rolled calls that drift apart.
#
# Usage: resolve-thread.sh <PR_NUMBER> <COMMENT_DB_ID> <THREAD_NODE_ID> <REPLY_BODY>
#   PR_NUMBER       — PR number
#   COMMENT_DB_ID   — databaseId of the thread's first comment (reply anchor)
#   THREAD_NODE_ID  — GraphQL node id of the review thread (resolve anchor)
#   REPLY_BODY      — reply text, one quoted argument (newlines allowed)
#
# Output (last line):
#   RESOLVED:<thread_node_id>           reply posted, thread verified resolved
#   STILL_UNRESOLVED:<thread_node_id>   reply posted, resolve did NOT stick (exit 1)
# Any earlier failure (bad args, reply POST failed) exits non-zero before the
# resolve runs — a failed reply must never leave a silently-resolved thread.
set -euo pipefail

if [[ $# -ne 4 ]]; then
  echo "Usage: $0 <PR_NUMBER> <COMMENT_DB_ID> <THREAD_NODE_ID> <REPLY_BODY>" >&2
  exit 2
fi
PR="$1"; COMMENT_ID="$2"; THREAD_ID="$3"; BODY="$4"
if [[ ! "$PR" =~ ^[0-9]+$ || ! "$COMMENT_ID" =~ ^[0-9]+$ || -z "$THREAD_ID" || -z "$BODY" ]]; then
  echo "Usage: $0 <PR_NUMBER> <COMMENT_DB_ID> <THREAD_NODE_ID> <REPLY_BODY>" >&2
  exit 2
fi

REPO=$(gh repo view --json nameWithOwner --jq .nameWithOwner)

# 1) Reply first — a resolve without a reply reads as "ignored" to reviewers.
gh api "repos/$REPO/pulls/$PR/comments/$COMMENT_ID/replies" \
  -X POST -f body="$BODY" --jq '.id' >/dev/null

# 2) Resolve immediately after.
gh api graphql -f query="mutation {
  resolveReviewThread(input: {threadId: \"$THREAD_ID\"}) { thread { isResolved } }
}" >/dev/null

# 3) Verify — trust the re-query, not the mutation response.
state=$(gh api graphql -f query="query {
  node(id: \"$THREAD_ID\") { ... on PullRequestReviewThread { isResolved } }
}" --jq '.data.node.isResolved')

if [[ "$state" == "true" ]]; then
  echo "RESOLVED:$THREAD_ID"
else
  echo "STILL_UNRESOLVED:$THREAD_ID"
  exit 1
fi
