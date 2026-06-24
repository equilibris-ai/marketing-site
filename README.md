# Equilibris — marketing site

Marketing site + waitlist for **Equilibris** (AI-assisted tax strategy for people
with complex returns). Captures leads with double-opt-in email verification.

## Stack

- **Next.js 16** (App Router) + **React 19**, run with **bun**, TypeScript.
- **TailwindCSS v4** is installed, but the site is styled with a hand-written
  design system in `app/globals.css` (semantic classes: `.hero`, `.cta`,
  `.form`, `.feature`, …), not utility classes.
- **Prisma 7** (`@prisma/adapter-pg`) → **Supabase Postgres**.
- **Resend** for transactional email.
- **consola** for colorful backend logs; **OpenTelemetry** (`@vercel/otel`) →
  **Honeycomb** for traces.
- Animated hero background via **Vanta HALO** (`three@0.134` + `vanta`).

## Quick start

```bash
cp .env.example .env      # then fill in the values
just setup                # bun install + prisma generate
bunx prisma db push       # create tables in Supabase (uses DATABASE_DIRECT_DSN, :5432)
just dev                  # http://localhost:3000
```

Without `bun`/`just`: `bun install && bunx prisma generate && bun run dev`.

## Project structure

```
app/                 # App Router routes (NOTE: at the repo root, not src/app)
  layout.tsx page.tsx globals.css
  api/waitlist/route.ts   # POST: capture lead, issue token, send email
  api/verify/route.ts     # GET:  confirm email via token
src/                 # shared code — the "@/*" import alias maps here (@/* → ./src/*)
  components/        # VantaHalo, WaitlistForm
  lib/               # prisma, email, verification, logger, tracing
prisma/schema.prisma # Lead + VerificationToken models
instrumentation.ts   # OpenTelemetry → Honeycomb (Next.js instrumentation hook)
otelconfig.yaml      # OTel declarative config (standalone/Collector use only)
```

> Routes live in **root `app/`**; shared code in **`src/`** (alias `@/*`). Don't
> create `src/app/` or a root `components/` — both shadow the canonical paths.

## How the waitlist works

1. `WaitlistForm` POSTs `{name, email}` to `POST /api/waitlist`.
2. The route upserts a `Lead`, creates a `VerificationToken` (a SHA-256 **hash**
   of the emailed token — the raw value is never stored), and sends a
   verification email via Resend.
3. The email link hits `GET /api/verify?token=…`, which validates + expires the
   token, sets `Lead.verifiedAt`, and redirects to `/?verify=success`.

## Environment

See [`.env.example`](.env.example). Two database URLs matter:

- `DATABASE_DSN` — Supabase **transaction pooler** (`:6543`), used by the app at runtime.
- `DATABASE_DIRECT_DSN` — Supabase **session pooler** (`:5432`), used by the Prisma
  CLI for migrations / `db push` (the transaction pooler can't migrate).

Email won't actually send until `RESEND_API_KEY` is set **and** the sending
domain is verified in Resend; otherwise the verification link is logged to the
server console.

## Commands (`just`)

| Recipe | Does |
| --- | --- |
| `just setup` | `bun install` + `prisma generate` |
| `just db-setup` | generate client + push schema (see Supabase note) |
| `just db-migrate` | apply schema changes |
| `just dev` / `just build` | run / build the app |
| `just clean` | remove `.next`, `node_modules`, generated client |

> Supabase note: `prisma migrate dev` needs a shadow DB Supabase doesn't allow,
> so use `bunx prisma db push` against `DATABASE_DIRECT_DSN` for schema changes.

## Observability

`instrumentation.ts` exports traces to Honeycomb (team/env from your ingest key,
dataset = `OTEL_SERVICE_NAME`). Custom spans cover the lead/email/verify
operations. Querying traces via API needs a Honeycomb key with `queries: true`;
the ingest key is events-only (the UI still shows everything).
