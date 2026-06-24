---
name: triage-pr-comment
description: >-
  Single source of truth for triaging GitHub PR review comments: fetch BOTH feedback surfaces
  (reviewThreads AND top-level Codex P1/P2 review bodies — querying threads alone silently misses
  every Codex P2), identify the author (CodeRabbitAI, Codex, Aikido, other bots, humans), classify
  severity, decide per the caller-passed mode, and reply+resolve atomically. Use whenever specific
  PR comments need evaluation, a reply, or resolution: a pipeline reaches its comment step,
  comments-watch.sh emits NEW_COMMENTS, or the user asks about particular comments ("is this
  CodeRabbit Major valid?", "reply and resolve this thread"). One invocation = one triage round
  over all current comments. Do NOT use for the full sweep workflow (mode question + follow-up
  wait-loop) — that is /review-pr-comments, which calls this skill each round.
argument-hint: "[manual|auto|auto+major]"
---

# Triage PR Comment

<!-- Step numbers below are deep-linked from review-pr-comments, ci-review,
     implement-feature, fix-bug, and local-coderabbit. Never renumber existing
     steps; insert fractional steps (e.g. 1.5) only. -->

**The single source of truth for "a PR comment needs a verdict — what now."** Five entry points
route here: `/review-pr-comments` (the user-facing sweep shell — each of its rounds is one
invocation of this skill), `/ci-review` Step 3, `implement-feature` 7b-2/7c/7d.7, `fix-bug` 7b/7c,
and `local-coderabbit`'s post-push pointer.

Two failures prompted this skill: agents querying `reviewThreads` alone **silently missed every
Codex P2** (Codex posts findings as top-level review bodies, a different API surface), and the
default "since PR HEAD" cutoff **silently dropped unaddressed Codex reviews** the moment a fix
commit was pushed. Both rules now live here, once.

References from this skill to its consumers are descriptive, never procedural — this skill never
invokes a consumer.

> 🔁 **Asked for a full sweep?** "Process the PR comments" / "address the CodeRabbit review" as a
> workflow — with mode prompt and follow-up wait-loop — is `/review-pr-comments`, which calls this
> skill each round. This skill is one triage round over the comments that exist right now.

---

## Step 0 — Mode contract

The contract is the **decision matrix**; the three modes are named presets over it. Callers pass
exactly one mode token (the skill argument). **Callers MUST NOT override individual cells** — an
inline "auto-accept, but additionally…" override is how the rules drifted apart before this skill
existed. A caller that needs different behavior adds a named preset here, in this table.

| Mode | Minor / P2–P3 / style / other bots | Major / P1 | Aikido / human / security |
|---|---|---|---|
| `manual` | present each | present each | present each |
| `auto` | auto-resolve | **defer** | **defer** |
| `auto+major` | auto-resolve | auto-fix iff all 4 criteria below; else defer | **defer** |

The **Aikido / human / security column is mode-independent**: no preset may relax it, ever.

**Auto-fix criteria for Major/P1 (`auto+major` only)** — ALL must hold:

1. The comment has a concrete code suggestion (diff block in the comment).
2. The suggestion is a clear improvement (not a subjective style change).
3. The change is localized (doesn't require architectural decisions).
4. It doesn't affect test behavior or security.

If uncertain, treat as defer.

**Mode resolution order** (stated once, here — consumers reference, never restate):

1. Caller-passed mode token (the argument).
2. No token, but **session auto-mode is active** (the user said "auto mode" / "fully automatic" /
   equivalent earlier in this session) → `auto`, silently.
3. Neither (standalone invocation) → `manual`.

The skill never asks *which mode* to use — prompting for mode is the shell's job
(`/review-pr-comments` Step 1 is the single prompt site). In `manual`, "present each" is the
per-comment confirmation the matrix prescribes. In `auto` / `auto+major`, "defer" means **append
to the deferred list (Step 4)** — never a blocking inline prompt; pipeline callers must keep their
CI monitoring responsive.

---

## Step 1 — Fetch ALL feedback surfaces

GitHub PR feedback lands in **three surfaces**, and the APIs do not unify them:

| Surface | API | Posted by | Resolvable? |
|---|---|---|---|
| Line-anchored review thread | GraphQL `pullRequest.reviewThreads[]` | CodeRabbit, Aikido, human inline reviewers, Codex when it anchors | Yes (`isResolved`) |
| Top-level review body | GraphQL `pullRequest.reviews[]` (state `COMMENTED`/`CHANGES_REQUESTED`, body > 50 chars) | **Codex P2/P1 findings** (one review per finding), some humans | **No** — no resolve button; new commits don't mark them outdated |
| Issue-level comment | REST `issues/N/comments` | Bots' walkthroughs/summaries (skip), occasional actionable human comments | No (reply only) |

> ⚠️ **Never query `reviewThreads` alone** — it silently misses every Codex P2.

### Inventory fetch

```bash
bash .claude/scripts/pr-feedback.sh <PR> [<SINCE_ISO8601>] [--full]
```

Output: `===THREADS===` (unresolved threads) and `===REVIEWS===` (top-level review bodies) JSON
arrays. Issue-level comments are fetched separately when relevant:
`gh api repos/OWNER/REPO/issues/<PR>/comments --paginate` — skip walkthroughs, summaries, and
pre-merge-check tables.

> ⚠️ **Default helper output is truncated inventory** (bodies capped for context budget). Before
> any decide/fix action, fetch the FULL body — rerun with `--full`, or query the single item — the
> 🟠/🟡 severity markers and the diff blocks the auto-fix criteria depend on can sit past the cap.

For PRs with >100 threads, paginate the underlying query via `pageInfo { hasNextPage endCursor }`.

Keep only threads whose first comment was authored by **someone other than the current user**
(a real review comment, not your own reply).

### Resolution record for review bodies (Codex P2/P1) — dedupe before processing

Review bodies have no `isResolved`. The resolution record is **the PR itself**: when a review body
is addressed, Step 5 posts a PR-level comment quoting `#pullrequestreview-<databaseId>`. So a
review body is already-addressed iff your own PR comments quote its id:

```bash
gh api "repos/OWNER/REPO/issues/<PR>/comments" --paginate \
  --jq '[.[] | select(.body | contains("#pullrequestreview-")) | .body
         | capture("#pullrequestreview-(?<id>[0-9]+)").id]'
```

Drop every review whose id appears in that list. This scan is derivable by any fresh session —
never rely on remembered state, never write a state file.

**`SINCE` is an optional narrowing optimization, not the correctness mechanism.** Safe default:
pass a wide cutoff (the PR's `createdAt`) and let the dedupe scan filter. The helper's no-arg
default (PR HEAD commit time) assumes all pre-HEAD feedback was already addressed — **after a fix
push it drops unaddressed reviews on prior SHAs**; use it only mid-session when the previous round
verifiably processed everything. If you want a tighter cutoff, derive it: the commit time of the
newest SHA referenced in your own "Fixed in `<SHA>`" replies.

### Filter CodeRabbit ack-only follow-ups

CodeRabbit auto-replies to your responses with `@you, thanks for the confirmation!` /
`@you, confirmed —` / `@you, that's exactly the right approach`. Don't re-process them. Drop a
comment when ALL hold:

- Author contains `coderabbitai`, AND
- the thread has more than one comment (a follow-up, not the original review), AND
- body starts with `@<your-handle>` and contains one of: `thanks for the`, `confirmed`,
  `that's exactly`, `Acknowledged —`.

Resolve those threads silently — they are themselves replies, so this is the one
resolve-without-reply exception. **Applies in ALL modes, including `manual`** (acks are not
findings; don't present them).

---

## Step 2 — Identify the source

| Source type | How to identify |
|---|---|
| **Aikido Security** | `user.login` contains `aikido` |
| **CodeRabbitAI** | `user.login` contains `coderabbitai` |
| **Codex** | `user.login` contains `chatgpt-codex` |
| **Other bot** | `user.login` ends with `[bot]` |
| **Human reviewer** | everything else |

Resolution mechanics (Step 5) key off the **surface, not the author**: a Codex finding that
arrived as a line-anchored thread resolves like a thread; a human note posted as a review body
gets record-and-reply like a Codex P2.

---

## Step 3 — Classify severity (per source)

| Source | Major signal | Minor signal |
|---|---|---|
| CodeRabbit | `🟠 Major` marker in body | `🟡 Minor` marker in body |
| Codex | `P1` badge image (rare) | `P2` / `P3` badges (common) |
| Aikido | always Critical/security | n/a |
| Human | infer from text — "must"/"required" → Major | default |

**Codex review-body recognition pattern:**

```text
### 💡 Codex Review
https://github.com/OWNER/REPO/blob/SHA/path/to/file.ts#L65
[![P2 Badge](…/P2-yellow…)] Title of the finding

Explanation paragraph(s).
```

The hyperlink + badge is the signal. Parse out:

- the `…/blob/SHA/path#L<n>` URL → `path` and `line`
- the P-badge image (`P1-red`, `P2-yellow`, `P3-blue`) → severity
- everything after the title → comment body
- the review's `databaseId` → the resolution anchor (Step 5 record-and-reply)

Build a table and present it before processing (always in `manual`; in auto modes as the working
inventory):

```text
| # | Source     | Severity | Surface | File:Line             | Summary                       |
|---|------------|----------|---------|-----------------------|-------------------------------|
| 1 | CodeRabbit | Major    | thread  | hooks/foo.rb:36       | Regex matches archive-e2e-dev |
| 2 | Codex      | P2       | review  | hooks/foo.rb:80       | Bound rest-scan to subcommand |
| 3 | @reviewer  | —        | thread  | services/create.rb:42 | Consider extracting method    |
```

---

## Step 4 — Decision policy (applies the Step 0 matrix)

> ⚠️ **Read the actual code before evaluating any comment** — never decide from comment text (or
> truncated inventory) alone.

### Aikido Security — always-confirm column (every mode)

1. Read the flagged file + trace the data flow.
2. Determine whether user input can reach the path.
3. Present recommendation (**not applicable** with reasoning OR **applicable** with proposed fix).
4. Wait for explicit user confirmation before any reply or change. In auto modes that means:
   add to the deferred list, touch nothing.

### CodeRabbit Major / Codex P1

1. Read flagged file + surrounding context.
2. Evaluate validity for this codebase.
3. `manual`: present **Agree** (with proposed fix) / **Disagree** (with reasoning) / **Skip**.
   `auto`: defer. `auto+major`: auto-fix only if all 4 Step 0 criteria hold, else defer.
4. On agree/auto-fix: apply fix, run relevant validation, then reply `Fixed in <SHA>.`
5. On disagree: post reply with specific technical reasoning (e.g. "table names are not
   schema-qualified in this codebase").

### Human reviewer comments — always-confirm column (every mode)

Same flow as CodeRabbit Major in `manual`; deferred in auto modes. On disagree or skip, let the
user decide whether to reply.

### CodeRabbit Minor / Codex P2–P3 / other bots

Auto-resolve in `auto` / `auto+major`; present each in `manual`. Read the file first to verify the
reply is accurate — if uncertain, escalate to the deferred list.

Standard replies:

| Category | Standard reply |
|---|---|
| Type annotations | "Type enforced at caller level." |
| CLAUDE.md style | "Tracked separately, not in scope for this PR." |
| Already handled | "Already addressed — [brief explanation of what's in place]." |
| Out of scope | "Acknowledged — not in scope for this PR." |
| Valid bug catch | apply fix, then `Fixed in <SHA>. <one-line summary>` |
| Deleted/replaced file | explain the file was replaced (e.g. `.sh` → `.rb`), then resolve |

### Deferred-items contract

Every deferred item (Aikido / human / Major-without-autofix / escalated-uncertain) goes on a
structured list the round returns:

```text
deferred — needs user:
- [Aikido][critical] app/services/foo.rb:42 — SQL string interpolation — recommendation: applicable, fix proposed
- [human][—] app/models/bar.rb:10 — @reviewer asks about naming
```

**Callers MUST surface this list to the user before marking the PR ready.** Deferring twice and
shipping is how security feedback gets silently dropped.

---

## Step 5 — Resolve + reply mechanics

**Every actionable comment gets a reply** — even if dismissed, pre-existing, or out of scope. The
CodeRabbit ack-only filter (Step 1) is the single resolve-without-reply exception.

> ⚠️ **Validate before replying `Fixed in <SHA>`** — run the relevant checks first (rspec/jest for
> code, the smoke matrix for hooks/scripts). A "Fixed." reply pointing at a broken commit is worse
> than no reply.

### Threads: reply + resolve + verify, atomically

```bash
bash .claude/skills/triage-pr-comment/scripts/resolve-thread.sh <PR> <COMMENT_DB_ID> <THREAD_NODE_ID> '<reply text>'
```

One invocation per thread: posts the reply, runs the `resolveReviewThread` mutation, re-queries,
and emits `RESOLVED:<thread_id>` or `STILL_UNRESOLVED:<thread_id>` (exit 1). For a batch (typical:
3–10 threads), loop the script per (comment_id, thread_id, reply) triple.

Addressing a **previously-deferred item** after user confirmation re-uses these same mechanics —
run the script directly with the fix reply. Don't start a fresh `auto` round for it: the round
would just re-defer the item, since it can't see the out-of-band confirmation.

> ⚠️ Never post all replies first and "circle back" to resolve — by then you'll have moved on, and
> unresolved threads make reviewers think you ignored them. Reply-before-resolve is baked into the
> script; don't hand-roll the two calls separately.

- **Resolve** threads for: fixed comments, dismissed-with-reply comments, CodeRabbit ack follow-ups.
- **Don't resolve** threads on the deferred list or marked **Skip** — leave open.

After a batch, re-verify once:

```bash
gh api graphql -f query='{ repository(owner: "OWNER", name: "REPO") { pullRequest(number: N) {
  reviewThreads(first: 100) { nodes { id isResolved comments(first: 1) { nodes { databaseId } } } } } } }' \
  --jq '.data.repository.pullRequest.reviewThreads.nodes | map(select(.isResolved == false))
        | map(.comments.nodes[0].databaseId)'
```

Any overlap with the comment ids you just processed (minus deliberate Skips/deferrals) = a missed
resolve — fix it now.

### Review bodies (Codex P2/P1): record-and-reply

No `resolveReviewThread` applies. Resolution = posting a PR-level comment that quotes the review
URL and links the fix:

```bash
gh pr comment <PR> --body '> [Codex P2 — <title>](https://github.com/OWNER/REPO/pull/<PR>#pullrequestreview-<DATABASE_ID>)

Fixed in <SHA>. <one-line summary of the fix>.'
```

The `#pullrequestreview-<DATABASE_ID>` quote is load-bearing: it is exactly what the Step 1 dedupe
scan matches on. Keep it verbatim in every review-body reply (including dismissals:
`Acknowledged — not in scope…`).

---

## Step 6 — Round semantics & monitoring

**One invocation of this skill = one triage round**: Step 1 fetch → Steps 2–4 verdicts → Step 5
resolution → evidence lines. Looping, round counting, Monitor arming, and summary aggregation are
the **caller's** job (the sweep loop lives in `/review-pr-comments` Step 6; pipelines arm the
watcher alongside their CI monitor).

The watcher is `.claude/scripts/comments-watch.sh` — its emission contract (`NEW_COMMENTS:` token,
quiet-exit, error token) and the re-arm rule for CI-length watches live in **its header comment**;
point there, don't restate. False-positive emissions are cheap by design: this skill's Step 1 on a
quiet PR finds 0 unresolved items and the round ends immediately.

---

## Evidence template — end every round with these lines

Per comment processed (grep-distinct from `triage-ci-failure`'s `triage:` line):

```text
comment-triage: source=<coderabbit|codex|aikido|bot|human> · severity=<critical|major|minor> · surface=<thread|review|issue> · action=<fixed|replied|deferred|skipped> · resolved=<yes|no|n/a>
```

Per round (callers' summaries aggregate from this):

```text
comment-triage-round: processed=N fixed=X replied=Y deferred=Z skipped=W
```
