<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Equilibris marketing site — agent guide

Marketing site + email-verified waitlist. See `README.md` for the full overview.

## Stack & tooling

- **Next.js 16 (App Router) + React 19, run with bun.** TypeScript.
- Package manager / runner is **bun** (`bun install`, `bun run dev`, `bunx`), not npm/pnpm.
- Task runner: **just** (`just dev`, `just build`, …). See `justfile`.
- **Prisma 7** + `@prisma/adapter-pg` → Supabase Postgres. **Resend** email.
- **consola** logging, **OpenTelemetry** (`@vercel/otel`) → Honeycomb.

## File layout rules (important)

- Routes live in **root `app/`** — there is **no `src/app/`**. Do not create one;
  it shadows `app/` and causes duplicate-route confusion.
- Shared code lives in **`src/`**; the import alias is **`@/*` → `./src/*`**.
- Components go in **`src/components/`**. Do **not** create a root `components/`
  dir — `@/components/*` resolves to `src/components/*`, so a root copy is dead code.
- Styling: edit the design system in **`app/globals.css`** (semantic classes like
  `.hero`, `.cta`, `.form`). **Tailwind utility classes do not apply** here — the
  stylesheet does not `@import "tailwindcss"`, so utilities are no-ops.

## Conventions

- **Backend logging:** `import { createLogger } from "@/lib/logger"` → tagged
  consola logger (`log.info/success/warn/error`). Don't use `console.*`.
- **Tracing:** `import { withSpan, annotate } from "@/lib/tracing"` to add custom
  spans / attributes (namespaced `app.*`, `db.*`). Honeycomb config is in
  `instrumentation.ts`; `otelconfig.yaml` is for standalone Node/Collector only.
- **DB access:** the singleton `import { prisma } from "@/lib/prisma"` (Prisma 7
  driver-adapter on the transaction pooler). Never instantiate `PrismaClient`
  directly.
- **Prisma 7 specifics:** the datasource `url` lives in `prisma.config.ts` (NOT
  `schema.prisma`). Generated client is at `src/generated/prisma` (gitignored).
- **Migrations against Supabase:** use `bunx prisma db push` (against
  `DATABASE_DIRECT_DSN`, the `:5432` session pooler). `prisma migrate dev` needs a
  shadow DB Supabase forbids.
- **Secrets:** never commit `.env` (gitignored) or `dot-claude.7z`. Add new env
  vars to `.env.example` (names + placeholders only).

## Before you finish

Run `bun run build` (type-checks + builds) and `bun run lint`. Both must pass.
