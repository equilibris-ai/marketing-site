# marketing-site — task runner
# Stack: static landing page rendered by Next.js (run with bun).
# Run `just` or `just --list` to see available recipes.

set dotenv-load := true

# Show available recipes
default:
    @just --list

# Install dependencies
setup:
    bun install

# Run the Next.js dev server (http://localhost:3000)
dev:
    bun run dev

# Serve the production build
start:
    bun run start

# Build the production bundle (type-checks along the way)
build:
    bun run build

# Run the unit test suite
test:
    bun test

# Lint with ESLint
lint:
    bun run lint

# Lint, test, and build — the full pre-push gate
check: lint test build

# Remove build artifacts, caches, and installed dependencies
clean:
    rm -rf .next node_modules .turbo
