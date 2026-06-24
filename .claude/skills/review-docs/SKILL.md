---
name: review-docs
description: Review docs for staleness at end of PRs. Proposes edits, asks about new docs, checks for skill opportunities. (project)
---

# Review Documentation Skill

This skill reviews documentation affected by PR changes, proposes specific edits for stale content, asks about missing docs, and checks for skill opportunities.

**Run this at the end of PRs before creating the PR.**

---

## Step 1: Get Changed Files

Run this command to find all files changed in the current branch:

```bash
git diff master --name-only
```

Group the files by domain/layer for doc mapping in the next step.

---

## Step 2: Map Changed Files to Documentation

For each changed file, identify which documentation might be affected:

| Change Location                               | Docs to Check                                                        |
| --------------------------------------------- | -------------------------------------------------------------------- |
| `app/domains/{domain}/**`                     | `app/domains/{domain}/README.md`, `app/domains/{domain}/CLAUDE.md`   |
| `app/javascript/domains/{domain}/**`          | `app/javascript/domains/{domain}/README.md`                          |
| `app/javascript/shared/**`                    | `app/javascript/shared/README.md`, `app/javascript/shared/CLAUDE.md` |
| `app/javascript/**` (root-level configs)      | `app/javascript/CLAUDE.md`, `app/javascript/README.md`               |
| `.claude/skills/**`                           | Root `CLAUDE.md` (skill list section)                                |
| Root config files (`*.yml`, `*.json`)         | Root `CLAUDE.md`, `README.md`                                        |
| `db/migrate/**`                               | Affected domain's `README.md` if schema changes                      |
| `app/services/base_worker.rb`, `*_worker.rb`  | `app/OBSERVABILITY.md`                                               |
| `app/services/concerns/structured_logging.rb` | `app/OBSERVABILITY.md`                                               |
| `app/services/**` (base classes)              | `app/OBSERVABILITY.md`                                               |
| `**/errors.rb`, `**/errors/**`                | `app/OBSERVABILITY.md`                                               |

Build a list of unique documentation paths to analyze.

---

## Step 3: Read & Analyze Each Affected Doc

For each doc that exists:

1. **Read the full content** of the doc
2. **Search for references to changed files:**
   - File paths mentioned in the doc
   - Class/module names from changed files
   - Method names that were modified or deleted
3. **Check for outdated patterns:**
   - Compare documented patterns with actual code changes
   - Look for "use X instead of Y" guidance that may be stale
4. **Identify missing documentation:**
   - New features/services without docs
   - New patterns that should be documented

---

## Step 4: Propose Specific Edits

For each staleness issue found, present it in this format:

```
📝 Suggested Edit: `<file-path>:<line-number>`

Current:
> [quoted text from the doc]

Suggested:
> [proposed replacement text]

Reason: [why this needs updating - reference the code change]

Apply this edit? [y/n]
```

**Common staleness patterns to detect:**

- References to deleted files/classes/methods
- Outdated service names (e.g., `FooService` renamed to `Foo::Bar::Create`)
- Incorrect file paths in examples
- Deprecated patterns still listed as recommended
- Version numbers or command examples that changed

If user approves, apply the edit using the Edit tool.

---

## Step 5: Check for Missing Documentation

For each domain touched by the PR, check if documentation exists:

### README.md Check

```bash
# For backend domains
ls app/domains/<domain>/README.md 2>/dev/null || echo "MISSING"

# For frontend domains
ls app/javascript/domains/<domain>/README.md 2>/dev/null || echo "MISSING"
```

**If missing, ask:**

```
📄 Missing Documentation: `app/domains/<domain>/`

This domain has <N> files but no README.md.
Would you like me to create one with:
- Domain purpose/overview
- Key models/services
- Usage examples

Create README.md? [y/n]
```

### CLAUDE.md Check

For complex domains with custom rules:

```
📋 Suggestion: `app/domains/<domain>/CLAUDE.md`

This domain has domain-specific patterns that could benefit from a CLAUDE.md.
Should I create one with guidelines for this domain?

Create CLAUDE.md? [y/n]
```

### AGENTS.md Symlink Check

```bash
# Check if CLAUDE.md exists but AGENTS.md doesn't
if [ -f "app/domains/<domain>/CLAUDE.md" ] && [ ! -e "app/domains/<domain>/AGENTS.md" ]; then
  echo "MISSING_SYMLINK"
fi
```

**If symlink is missing, ask:**

```
🔗 Missing Symlink: `app/domains/<domain>/AGENTS.md`

CLAUDE.md exists but AGENTS.md symlink is missing.
Create symlink for AI agent compatibility?

Run: ln -s CLAUDE.md AGENTS.md ? [y/n]
```

---

## Step 6: Analyze for Skill Opportunities

Review the PR changes for patterns that could become skills:

**Signals to look for:**

1. **Multi-step workflows** - Same sequence of commands/checks repeated
2. **Domain-specific verification** - Custom checks for a domain
3. **Code generation patterns** - Boilerplate that follows templates
4. **Pre-commit/pre-PR workflows** - Steps that should run before commits/PRs

**Confidence levels:**

- **High** - Pattern appears 3+ times in PR or matches existing skill patterns
- **Medium** - Pattern appears 2 times or is a clear workflow
- **Low** - Potential pattern, may be one-off

**Only suggest when confidence is Medium or High:**

```
💡 Skill Suggestion:
- Name: /<suggested-skill-name>
- Purpose: [what it would automate]
- Pattern detected: [what triggered this - reference specific files/changes]
- Confidence: [High/Medium]

Want me to draft this skill? [y/n]
```

---

## Step 7: Generate Summary Report

Present the final summary:

```
## 📚 Documentation Review Complete

### Docs Analyzed
✓ <doc-path> - up to date
✓ <doc-path> - N edits proposed
✗ <doc-path> - not found (domain missing README)

### Proposed Edits
- <N> edits proposed, <M> applied

### Missing Documentation
- [list of missing docs with user decisions]

### Skill Opportunities
- [any suggested skills, or "None identified"]
```

---

## Important Notes

- Always compare against local `master`, not `origin/staging`
- Only propose edits with high confidence - avoid false positives
- When in doubt, ask the user rather than making assumptions
- Skill suggestions should be conservative - only suggest when genuinely useful
- The goal is to prevent stale docs, not create documentation burden
