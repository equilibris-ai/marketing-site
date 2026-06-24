#!/usr/bin/env bash
# Extract failure details for failing jobs on a PR's latest workflow run.
# Usage: pr-failure-logs.sh <PR_NUMBER> [<OWNER/REPO>]
#
# Thin wrapper since FRO-187: PR→run resolution and bounded per-job log
# extraction live in the canonical extractor `.claude/scripts/ci-logs.sh`
# (--pr mode — single fetch per red job, ANSI/timestamp normalization,
# rspec/Cypress/jest summary extraction, never-empty output). Kept so
# existing ci-review SKILL.md call sites keep working unchanged.
set -euo pipefail

PR="${1:-}"
if [[ -z "$PR" ]]; then
  echo "Usage: $0 <PR_NUMBER> [<OWNER/REPO>]" >&2
  exit 2
fi

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
exec "$SCRIPT_DIR/../../../scripts/ci-logs.sh" --pr "$PR" ${2:+"$2"}
