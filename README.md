# Equilibris — marketing site

Static landing page for **Equilibris** (real-time tax engine for
small-business owners). One page, one CTA: the "Join the waitlist" button
opens a [qualified.at](https://qualified.at) questionnaire widget, which owns
lead capture and email (via Resend) end to end — this site keeps no backend,
no database, and no auth.

> Looking for the previous dynamic version (Supabase-auth admin dashboard,
> Prisma/Postgres waitlist, double-opt-in email)? It lives on the
> **`marketing/dynamic`** branch.

## Stack

- **Next.js 16** (App Router) + **React 19**, run with **bun**, TypeScript.
- Hand-written design system in `app/globals.css` — no Tailwind utilities.
- **consola** for backend logs; **OpenTelemetry** (`@vercel/otel`) →
  **Honeycomb** for traces (optional).
- Deployed on **Vercel** (DNS + SSL already configured).

## Quick start

```bash
cp .env.example .env      # optional — only telemetry + site URL
just setup                # bun install
just dev                  # http://localhost:3000
```

Without `bun`/`just`: `bun install && bun run dev`.

## Project structure

```
app/                 # App Router routes (NOTE: at the repo root, not src/app)
  layout.tsx page.tsx globals.css
public/index.html    # standalone static template — the design source of truth
public/_logo_mark.png  _logo_sm.png   # logo mark (header) + small mark (favicon)
src/lib/             # logger, tracing ("@/*" alias maps to ./src/*)
instrumentation.ts   # OpenTelemetry → Honeycomb (Next.js instrumentation hook)
```

`app/page.tsx` is a 1:1 JSX port of `public/index.html`. If you change the
design, change both (or change the template and re-port).

## The waitlist CTA

The `#get-quote` button opens the qualified.at questionnaire overlay. Two
scripts (in `app/page.tsx` and mirrored in `public/index.html`) power it:

1. the **inquirex-js widget bundle** (`/inquirex-js/<id>`), and
2. the **signed embed loader** (`/embed/<token>?origin=…&sig=…`) with
   `data-trigger="element"`, `data-element="#get-quote"`.

The `sig` is an HMAC over `embed_token:origin`, so the snippet only works on
`https://equilibris.ai` — regenerate it in the qualified.at dashboard if the
origin ever changes.

## Commands (`just`)

| Recipe | Does |
| --- | --- |
| `just setup` | `bun install` |
| `just dev` / `just build` / `just start` | run / build / serve |
| `just check` | lint + test + build (pre-push gate) |
| `just clean` | remove `.next`, `node_modules` |

## Observability

`instrumentation.ts` exports traces to Honeycomb when `HONEYCOMB_API_KEY` is
set (dataset = `OTEL_SERVICE_NAME`, default `equilibris-web`). Without a key,
tracing is a silent no-op.
