<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Equilibris marketing site — agent guide

Static landing page with a qualified.at waitlist widget. See `README.md` for
the full overview.

**There is no backend here.** No database, no auth, no email, no API routes.
Lead capture happens inside the qualified.at questionnaire widget attached to
the `#get-quote` button. The previous dynamic version (Supabase admin,
Prisma waitlist) is preserved on the **`marketing/dynamic`** branch — do not
reintroduce those pieces on `main`.

## Stack & tooling

- **Next.js 16 (App Router) + React 19, run with bun.** TypeScript.
- Package manager / runner is **bun** (`bun install`, `bun run dev`, `bunx`), not npm/pnpm.
- Task runner: **just** (`just dev`, `just build`, …). See `justfile`.
- **consola** logging, **OpenTelemetry** (`@vercel/otel`) → Honeycomb (optional).
- Deployed on **Vercel**.

## File layout rules (important)

- Routes live in **root `app/`** — there is **no `src/app/`**. Do not create one;
  it shadows `app/` and causes duplicate-route confusion.
- Shared code lives in **`src/`**; the import alias is **`@/*` → `./src/*`**.
- **`public/index.html` is the design source of truth.** `app/page.tsx` is its
  1:1 JSX port; keep them in sync when the design changes.
- Styling lives in **`app/globals.css`** (semantic classes like `.hero`,
  `.sub`, `.cta-btn`). There is no Tailwind — utility classes are no-ops.

## Conventions

- **Backend logging:** `import { createLogger } from "@/lib/logger"` → tagged
  consola logger (`log.info/success/warn/error`). Don't use `console.*`.
- **Tracing:** `import { withSpan, annotate } from "@/lib/tracing"` for custom
  spans / attributes (namespaced `app.*`). Honeycomb config is in
  `instrumentation.ts`; `otelconfig.yaml` is for standalone Node/Collector only.
- **Secrets:** never commit `.env` (gitignored). Add new env vars to
  `.env.example` (names + placeholders only).

## Before you finish

Run `bun run build` (type-checks + builds) and `bun run lint`. Both must pass.
