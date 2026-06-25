# marketing-site — task runner
# Stack: React + Next.js (run with bun), TailwindCSS, Supabase (PostgreSQL).
# Run `just` or `just --list` to see available recipes.

set dotenv-load := true

# Show available recipes
default:
    @just --list

# Install dependencies and generate the Prisma client
setup:
    bun install
    bunx prisma generate

# Generate the Prisma client and sync the schema (expects DATABASE_URL → Supabase Postgres)
db-setup:
    bunx prisma generate
    bunx prisma migrate dev --name init

# Create and apply a new migration from schema.prisma changes
db-migrate:
    bunx prisma migrate dev

db-reset:
    bunx prisma migrate reset --schema=prisma/schema.prisma -f

# Run the Next.js dev server (http://localhost:3000)
start:
    npx next start

# Build the production bundle
build:
    npx prisma generate && npx next build

# Run the unit test suite
test:
    bun test

# Lint with ESLint
lint:
    bun run lint

# Lint, test, and build — the full pre-push gate
check: lint test build

# Remove build artifacts, caches, generated client, and installed dependencies
clean:
    rm -rf .next node_modules .turbo src/generated


