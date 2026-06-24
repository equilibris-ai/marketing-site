---
name: write-migration
description: Generate a safe Rails migration with production table size awareness. Enforces concurrent indexes, lock-free drops, idempotency, and proper thresholds based on actual table sizes.
paths:
  - "db/migrate/*.rb"
---

# Write Safe Migration

This skill generates Rails migrations that are safe for production. It enforces all rules from `db/CLAUDE.md` and uses actual table sizes from `db/table_sizes.md`.

---

## Step 1: Read Table Sizes

**Before writing ANY migration code**, read `db/table_sizes.md` to determine the size of every table involved.

Record the row counts — they determine which safety measures are required.

---

## Step 2: Determine Safety Tier

| Tier         | Row Count | Requirements                                                                             |
| ------------ | --------- | ---------------------------------------------------------------------------------------- |
| **Critical** | 500M+     | `algorithm: :concurrently` for indexes, batched data updates only, `if_not_exists: true` |
| **Large**    | 50M–500M  | `algorithm: :concurrently` for indexes, test timing, `if_not_exists: true`               |
| **Medium**   | 1M–50M    | `algorithm: :concurrently` for indexes, `if_not_exists: true`                            |
| **Small**    | <1M       | `algorithm: :concurrently` for indexes, `if_not_exists: true`                            |

**Note:** `if_not_exists: true` is ALWAYS required regardless of table size. `algorithm: :concurrently` + `disable_ddl_transaction!` are required for ALL index operations (add/remove). For non-index DDL (`add_column`, `remove_column`), running inside a transaction is preferred for rollback safety — do NOT add `disable_ddl_transaction!` unless the migration also contains concurrent index operations.

---

## Step 3: Apply Rules

### Method and transaction decision tree

| Has index operations? | Use `disable_ddl_transaction!`?       | Method style          |
| --------------------- | ------------------------------------- | --------------------- |
| **No** (columns only) | **No** — keep the transaction         | `def change`          |
| **Yes**               | **Yes** — required for `CONCURRENTLY` | `def up` / `def down` |

- **Column-only migrations** use `def change`. They run inside a transaction (rollback safety) and are auto-reversible. Do NOT add `disable_ddl_transaction!` or `def up`/`def down` — it's unnecessary complexity.
- **Migrations with indexes** need `algorithm: :concurrently`, which requires `disable_ddl_transaction!`, which requires explicit `def up`/`def down` with idempotent guards (`if_not_exists`, `if_exists`). Enforced by `Migrations/RequireUpDownWithDdlTransaction` cop.

### Always

- `algorithm: :concurrently` for ALL index operations (add/remove)
- `if_not_exists: true` for `add_column`, `add_index`, `add_foreign_key`
- Reversible migrations when using `execute`

### `safety_assured`

**Avoid religiously.** Using `algorithm: :concurrently` on `add_index` and `remove_index` passes strong_migrations checks without needing `safety_assured`.
If strong_migrations blocks an operation, first look for a safe alternative (e.g., concurrent algorithm) rather than reaching for `safety_assured`.
Only use it as a last resort, scoped to a single statement, with a comment explaining why.

### Dropping Indexes

**ALWAYS use `remove_index` with `algorithm: :concurrently`:**

```ruby
remove_index :table, name: 'index_name', algorithm: :concurrently, if_exists: true
```

Without `algorithm: :concurrently`, `remove_index` takes an ACCESS EXCLUSIVE lock that blocks all queries and causes timeouts under load.

### Dropping Constraints

`remove_unique_constraint` / `remove_check_constraint` are OK — they only modify catalog metadata and are fast. But always guard with existence checks.

### Data Migrations

- **Tables ≥100K rows:** NEVER write data migrations in Rails migrations. Data backfills must be implemented as separate Sidekiq workers, planned individually.
- **Tables <100K rows:** Data migrations in Rails migrations are acceptable. Wrap in `reversible` block.
- Rails migrations should primarily contain schema changes (add/remove columns, indexes, constraints).

### Schema-Qualified Tables

If the table uses a non-public schema (e.g., `crm.custom_attribute_schemas`), use the fully qualified name in all operations.

---

## Step 4: Write Migration

Generate the migration using `bin/rails generate migration <name>` and then edit the generated file.

### Template: Column-only migration (no indexes)

```ruby
# frozen_string_literal: true

class MigrationName < ActiveRecord::Migration[7.2]
  def change
    add_column :table, :column, :type, null: true, if_not_exists: true
  end
end
```

### Template: Migration with indexes

```ruby
# frozen_string_literal: true

class MigrationName < ActiveRecord::Migration[7.2]
  disable_ddl_transaction!  # Required for algorithm: :concurrently

  def up
    add_column :table, :column, :type, if_not_exists: true

    add_index :table, :column,
      algorithm: :concurrently,
      if_not_exists: true,
      name: 'index_name'
  end

  def down
    remove_index :table, name: 'index_name', algorithm: :concurrently, if_exists: true

    remove_column :table, :column, if_exists: true
  end
end
```

---

## Step 5: Verify

Run through this checklist before presenting the migration:

```
[ ] Read db/table_sizes.md — know exact row count for target table(s)
[ ] disable_ddl_transaction! present ONLY IF migration has concurrent index operations
[ ] All indexes use algorithm: :concurrently
[ ] All add_column/add_index/add_foreign_key use if_not_exists: true
[ ] All remove_index use algorithm: :concurrently
[ ] No safety_assured (use concurrent algorithms instead)
[ ] No data migrations in Rails migrations for tables ≥100K rows (use separate workers)
[ ] Data migrations (<100K rows only) wrapped in reversible block
[ ] No cross-domain foreign keys (except core)
[ ] Migration is idempotent (safe to re-run if CI restarts)
```

---

## Step 6: Post-Migration

Remind the user to run:

```bash
bundle exec rails db:migrate && bin/reset_structure_sql
```
