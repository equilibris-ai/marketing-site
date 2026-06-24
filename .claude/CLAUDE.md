# `.claude/` — Claude Code configuration for `marketing-site`

This directory configures how Claude Code behaves in this repository: which
slash-command **skills** are available, which **hooks** fire on tool use, what
Bash **permissions** are pre-approved, and which **plugins** load.

> **Origin / provenance.** This folder was copied wholesale from a private
> Rails + React monorepo (internal codename "Archive") and then stripped down
> for this project. Everything specific to that company — its CRM, GraphQL/
> Sidekiq backend, "magic fields"/vetting workflows, Datadog/Sentry telemetry,
> Linear/Slack/Notion automation, ClickHouse, production-DB readers, Cypress
> e2e stack, and its feature-sliced-design frontend — has been removed. What
> remains is **stack-agnostic tooling** plus generic **React/Next.js** and
> **Ruby/Rails** helpers. A full backup of the original lives in the repo root
> at `dot-claude.7z`.

## Target stack

- **Marketing site:** React + Next.js, run with **bun**, styled with TailwindCSS.
- **Application (planned):** Ruby on Rails.
- **Database:** PostgreSQL hosted on **Supabase**.

## Layout

```
.claude/
├── CLAUDE.md              # this file
├── settings.json          # active config (permissions, hooks, plugins)
├── settings.cleaned.json  # proposed fully-cleaned settings — see "Settings" below
├── codex-plugin.md        # wiring notes for the OpenAI Codex plugin
├── context-hygiene.md     # guidance on keeping session context small
├── commands/              # slash commands (/jsdoc, /speckit.*)
├── skills/                # auto-invoked skills (see table)
├── hooks/                 # shell hooks fired on Claude Code events
└── scripts/               # helper scripts used by the CI/PR skills
```

There is intentionally **no `agents/` directory** and **no `routines/`
directory** — those held Archive's multi-agent backend/frontend implementation
pipeline (coupled to `bin/rspec_with_coverage`, Datadog, production read
replicas) and its Sentry/VM automation, all removed.

## Skills (`skills/`)

Auto-invoked by Claude based on their `description`, or callable as
`/<name>`. All are generic to React/Next.js, Ruby/Rails, or git/GitHub workflow.

| Skill | Purpose |
| --- | --- |
| `agent-browser` | Drive a real Chrome via CDP to screenshot/debug the local site or automate browser tasks. Genericized for `bunx agent-browser`. |
| `ci-review` | Check CI status, pull failure logs, and process PR comments in one pass. Uses `scripts/`. |
| `invalid-states` | Apply "make invalid states unrepresentable" with TypeScript discriminated unions. |
| `local-coderabbit` | Run a CodeRabbit-style review on the local working-tree diff before pushing. |
| `react-performance-review` | Measure and fix React rerender/latency problems with evidence. |
| `review-dates` | Catch timezone/date-handling bugs on frontend or backend. |
| `review-docs` | Flag stale docs at the end of a PR and propose edits. |
| `review-pr-comments` | End-to-end workflow to process every review comment on the current PR. |
| `skill-creator` | Anthropic's toolkit for authoring/evaluating new skills. |
| `triage-ci-failure` | Attribute a red CI check (your change vs. pre-existing vs. flake) before fixing. |
| `triage-pr-comment` | Per-comment triage (classify, reply, resolve) used by `review-pr-comments`. |
| `validate-claude-md` | Lint/validate `CLAUDE.md` files for quality. |
| `write-migration` | Generate production-safe Rails migrations (concurrent indexes, idempotency, lock-free drops). |

## Commands (`commands/`)

- `/jsdoc` — add JSDoc comments to non-obvious exported JS/TS symbols.
- `/speckit.*` — the spec-driven-development command set (`specify`, `plan`,
  `tasks`, `clarify`, `analyze`, `checklist`, `constitution`, `implement`,
  `taskstoissues`).

## Hooks (`hooks/`)

Wired up in `settings.json`:

| Hook | Event | Effect |
| --- | --- | --- |
| `lsp-reminder.sh` | PreToolUse (Grep/Glob) | Nudges toward the LSP tool for symbol lookups. Non-blocking. |
| `format-frontend.sh` | PostToolUse (Edit/Write) | Auto-runs Prettier. Silently no-ops if Node/Prettier absent. |
| `format-ruby.sh` | PostToolUse (Edit/Write) | Auto-runs RuboCop. Silently no-ops if Ruby/RuboCop absent. |
| `nudge-gh-pr-body.sh` | PreToolUse (`gh pr create/edit`, `gh api`) | Reminds to use `.github/PULL_REQUEST_TEMPLATE.md`. |
| `pr-desc-nudge.sh` | PostToolUse (after `git push`) | Reminds to refresh a stale PR description. |
| `symlink-worktree-env.sh` | PostToolUse (`git worktree add`) | Symlinks `.env*.local` into new worktrees. |

## Scripts (`scripts/`)

Support helpers for the CI/PR skills: `ci-logs.sh`, `ci-watch.sh`,
`comments-watch.sh`, `pr-feedback.sh`.

## Settings (`settings.json`)

`settings.json` defines pre-approved Bash permissions, the hook wiring above,
and enabled plugins (`codex`, `ruby-lsp`, `typescript-lsp`).

> **Action needed.** The live `settings.json` was only partially cleaned —
> Claude Code's self-modification guard blocks the agent from rewriting its own
> permission/hook file, so a few hook entries that point at now-deleted scripts
> still linger (they fail-safe to no-ops). A fully cleaned replacement that also
> adds `bun`/`supabase`/`just` permissions is provided as
> **`settings.cleaned.json`**. After reviewing it, activate with:
>
> ```bash
> mv .claude/settings.cleaned.json .claude/settings.json
> ```

## Known references to fix later

A few kept files still assume conventions from the origin repo. They are
harmless until the relevant feature exists, but update them when you get there:

- `skills/write-migration` reads `db/CLAUDE.md` and `db/table_sizes.md` — create
  these (or trim the skill) once the Rails app has a schema.
- `scripts/ci-logs.sh` and `skills/triage-ci-failure` filter for a CI workflow
  named **"Archive CI trigger"** — rename to this repo's actual workflow once
  CI is set up.
