# Codex Claude Code Plugin

Wiring reference for the `openai/codex-plugin-cc` plugin in this repo. See [CLAUDE.md](../CLAUDE.md) for the one-line pointer.

## Install

```
/plugin marketplace add openai/codex-plugin-cc
/plugin install codex@openai-codex
/codex:setup
```

Requires `OPENAI_API_KEY` or a ChatGPT login. Missing auth is non-blocking — plugin logs a "Run /codex:setup" note instead of erroring.

## Commands

| Command                     | Use                                                                                 |
| --------------------------- | ----------------------------------------------------------------------------------- |
| `/codex:rescue`             | Delegate investigation or fix work to a fresh Codex session (independent reasoning) |
| `/codex:review`             | Codex reviews current git diff                                                      |
| `/codex:adversarial-review` | Same target, harsher framing that challenges design and assumptions                 |
| `/codex:setup`              | Check Codex CLI auth and toggle the **stop-time review gate**                       |

## Stop-time review gate

Opt-in via `/codex:setup --enable-review-gate`. When enabled, Claude Code's `Stop` event runs a Codex review of every turn in this workspace. Good as an always-on safety net across the whole repo, **too broad** if you only want Codex to run during specific pipelines (gate fires on every turn including trivial ones).

We leave the gate **disabled** by default and use per-skill invocations instead.

## Per-skill Codex usage

**Codex is soft by construction.** Missing plugin or unconfigured auth is surfaced as `[codex] skipped: ...`; transient failures (timeouts, auth rejections, network) are surfaced as `[codex] errored: ...`. In both cases the pipeline proceeds with Claude's own reviewer — the user always sees whether Codex contributed, skipped, or errored, but the pipeline never halts and never prompts. `code-reviewer` is authoritative; Codex is supplementary context.

| Where                        | Surface                                                                        | Purpose                                                                                                                                                                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/implement-feature` step 3b | `codex:codex-rescue` subagent                                                  | Plan review — spec + plan + `.agents/` standards files embedded in the prompt. Skill parses `APPROVED` / `NEEDS_REVISION` from stdout.                                                                                          |
| `/fix-bug` step 4b           | `codex:codex-rescue` subagent                                                  | Same pattern as above, on the fix plan.                                                                                                                                                                                         |
| `/fix-bug` step 3b           | `codex:codex-rescue` subagent                                                  | Independent investigation when the debugger returns low/medium confidence.                                                                                                                                                      |
| `/implement-feature` step 5f | `.claude/skills/implement-feature/scripts/codex-review.sh`                     | Code review of the branch diff — script wraps `codex-companion.mjs task` with the setup gate, portable timeout, and stderr capture. Output fed into the `code-reviewer` agent as supplementary context, not a parallel verdict. |
| `/fix-bug` step 5f           | `codex-companion.mjs task` direct (TODO: adopt `codex-review.sh` post-AFE-459) | Same pattern; not yet migrated to the helper script.                                                                                                                                                                            |

## Model selection

We explicitly pass `--model gpt-5.4` on all calls. Why: the `-codex` specialized variants (`gpt-5.2-codex`, `gpt-5.3-codex-spark`, `gpt-5.4-codex`) are blocked on ChatGPT-account auth. `gpt-5.4` is the general model that works on both ChatGPT and OpenAI API key auth.

| Model                 | ChatGPT auth | Notes                                                                       |
| --------------------- | ------------ | --------------------------------------------------------------------------- |
| `gpt-5.4`             | ✅           | our default                                                                 |
| `gpt-5.4-mini`        | ✅           | cheaper, available if ever needed                                           |
| `gpt-5.4-codex`       | ❌           | blocked                                                                     |
| `gpt-5.3-codex-spark` | ❌           | blocked (the plugin's rescue docs mention it, but it won't work on ChatGPT) |
| `gpt-5.2-codex`       | ❌           | plugin default — the reason we override                                     |
| `gpt-5`, `o3`         | ❌           | blocked                                                                     |

## Surface callability (what can invoke what)

| Surface                                      | From user prompt | From skill (Agent tool)               | From subagent (Bash)            | Takes free-form prompt |
| -------------------------------------------- | ---------------- | ------------------------------------- | ------------------------------- | ---------------------- |
| `/codex:review`, `/codex:adversarial-review` | ✅               | ❌ (`disable-model-invocation: true`) | ❌                              | ❌ (git diff only)     |
| `/codex:rescue` slash                        | ✅               | ❌ (slash)                            | ❌ (slash)                      | ✅                     |
| `codex:codex-rescue` subagent                | N/A              | ✅ via `subagent_type`                | ❌ (no Agent tool on subagents) | ✅                     |
| `codex-companion.mjs task` direct            | ✅ (Bash)        | ✅ (Bash)                             | ✅ (Bash)                       | ✅                     |

From within a subagent the only option is `codex-companion.mjs` direct — subagents don't have the `Agent` tool, so they can't launch `codex:codex-rescue`.

## Smoke test

Run `bin/codex-smoke-test.sh` after plugin upgrades, auth changes, or CI environment refreshes. Checks `setup --json` readiness then does a minimal `task --model gpt-5.4` round-trip. Exit codes:

- `0` — Codex ready AND round-trip succeeded (PASS)
- `0` — Codex not ready (SKIP — matches skill silent-skip behavior)
- `1` — Codex ready but the call failed (auth / model / runtime breakage)

## Known upstream issues (as of plugin 1.0.4)

- `review`/`task` server endpoints reject all `-codex` models for ChatGPT-account auth — not filed upstream yet.
- Plugin default review model is still `gpt-5.2-codex`, which combined with the above means `/codex:review` is unusable on ChatGPT accounts out of the box. Workaround for scripted callers: use `task --model gpt-5.4` instead of `review`.
