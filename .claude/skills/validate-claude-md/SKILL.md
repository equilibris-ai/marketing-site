---
name: validate-claude-md
description: Validate a CLAUDE.md file against best practices (not a linter, progressive disclosure, Why/What/How, line count)
argument-hint: [path-to-claude-md]
paths:
  - "**/CLAUDE.md"
---

# Validate CLAUDE.md Skill

Validates a CLAUDE.md file against the best practices defined in the root CLAUDE.md.

---

## Step 1: Identify Target File

If an argument was provided (e.g., `/validate-claude-md app/CLAUDE.md`), use that path.
Otherwise, look for `CLAUDE.md` in the current working directory.

```bash
# Count lines
wc -l <path-to-file>
```

---

## Step 2: Check Line Count

- **< 300 lines**: Pass
- **> 300 lines**: Needs refactoring - split into subdirectory files

---

## Step 3: Check "Not a Linter" Criterion

Scan for patterns that indicate linter-enforceable rules:

**Red flags to search for:**

- "ALWAYS" / "NEVER" / "MUST" / "FORBIDDEN" followed by code patterns
- "Use X instead of Y" patterns
- "Do not use" lists with specific code/syntax

**Test each flagged rule:** "Could RuboCop/ESLint detect violations?"

If yes → flag as "should be a linter rule"

**Common patterns that SHOULD be linter rules:**

- "Always use X type" → type checking cop
- "Never import from X" → import restriction cop
- "Use X instead of Y" → style cop
- "Must have X annotation" → documentation cop

**Patterns that are OK for CLAUDE.md:**

- Architectural guidance (when to use patterns)
- Context-dependent decisions (requires understanding intent)
- Process/workflow instructions
- Links to external resources

---

## Step 4: Check Progressive Disclosure

Look for references to other documentation:

- `See <path>` references
- Links to subdirectory CLAUDE.md files
- Links to README.md files
- Links to external docs

**If file is > 100 lines with no references:** Flag as "needs progressive disclosure"

---

## Step 5: Check Why/What/How Structure

For each major section (## headings), check for:

- **Why:** Purpose/rationale (look for "Why:", "because", "to prevent", "to ensure")
- **What:** Description of the rule/pattern
- **How:** Implementation details, examples

**Flag sections that jump straight to rules without explaining Why.**

---

## Step 6: Generate Validation Report

Output in this format:

```
## CLAUDE.md Validation: <filename>

| Criterion              | Status | Notes                                      |
|------------------------|--------|--------------------------------------------|
| Not a linter           | ✅/⚠️/❌ | <specific issues or "Pass">              |
| Progressive disclosure | ✅/⚠️/❌ | <refs found or "Needs more refs">        |
| Why/What/How structure | ✅/⚠️/❌ | <sections missing Why>                   |
| < 300 lines            | ✅/❌    | <N> lines                                 |
```

### Issues Found

#### Potential Linter Rules (move to RuboCop/ESLint)
- L<N>: "<rule text>" → could be <cop-type>

#### Sections Missing "Why"
- <Section name>: jumps to rules without rationale

#### Progressive Disclosure
- <suggestions for splitting or adding refs>


---

## Step 7: Suggest Updates

If issues were found, suggest:

1. **For linter rules:** "Add to existing RuboCop TODO (AE-126) or create ESLint rule"
2. **For missing Why:** Provide a template: `**Why:** <one-line rationale>`
3. **For line count:** "Consider splitting <large-section> into <path>/CLAUDE.md"

---

## Status Meanings

- ✅ Pass - meets criterion
- ⚠️ Warning - minor issues, should fix
- ❌ Fail - significant issues, must fix
