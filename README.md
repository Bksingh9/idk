# PlaytestPool

A two-sided marketplace matching indie game/app developers with real
playtesters. This repo currently contains the **engineering foundation** (10
proven layers); product features begin after the foundation report is approved.

- **Stack:** Next.js 15 (App Router, TS) · Supabase (auth/db/storage) · Drizzle
  (engine migrations) · Redis (ioredis; Upstash in prod) · Stripe · Resend ·
  Tailwind · deploy target Vercel.
- **Proof of the foundation:** see [`SETUP_REPORT.md`](./SETUP_REPORT.md).

## Quick start

```bash
pnpm install
cp .env.example .env.local        # then fill in real keys as you get them
pnpm infra:up                     # local Postgres + Redis (Docker)
pnpm db:migrate                   # apply migrations
pnpm dev                          # http://localhost:3000
```

Useful endpoints once running:

| Route | Purpose |
|-------|---------|
| `/api/health` | Per-dependency health (real round-trips) |
| `/api/metrics` | Prometheus metrics |
| `/stream` | SSE streaming demo |
| `/api/demo/limited` | Rate-limit demo (429 after 5/min) |
| `/api/demo/session` | Session persistence demo |
| `/api/demo/connector` | Connector registry demo |

## Commands

```bash
pnpm dev            # dev server
pnpm build          # production build
pnpm start          # run production build
pnpm typecheck      # tsc --noEmit
pnpm test           # vitest (unit + integration; needs infra:up)
pnpm check:env      # validate .env.local, exit non-zero if invalid
pnpm infra:up       # docker compose up Postgres + Redis
pnpm infra:down     # stop them
pnpm db:generate    # generate a migration from schema changes
pnpm db:migrate     # apply migrations
```

## Environment variables

Every variable is validated at startup by `src/lib/config/env.ts`; the app
**refuses to boot** if a required one is missing or malformed. See
[`.env.example`](./.env.example) for the authoritative, commented list.

| Variable | Tier | Where to get it |
|----------|------|-----------------|
| `APP_BASE_URL` | core | your URL (e.g. `http://localhost:3000`) |
| `CORS_ALLOWED_ORIGINS` | core | comma-separated allowed origins |
| `LOG_LEVEL` | core | `info` (or trace/debug/warn/error/fatal) |
| `AUTH_JWT_SECRET` | core | `openssl rand -base64 48` (≥32 chars) |
| `AUTH_ACCESS_TTL_SECONDS` / `AUTH_REFRESH_TTL_SECONDS` | core | token lifetimes |
| `DATABASE_URL` | core | local Docker, or Supabase Postgres connection string |
| `REDIS_URL` | core | local Docker, or Upstash `rediss://…` |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | provider | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | provider | Supabase → Settings → API (server-only) |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `STRIPE_PRICE_*` | provider | Stripe → Developers (test mode) |
| `RESEND_API_KEY` / `EMAIL_FROM` | provider | Resend → API Keys (blank → console fallback) |
| `SENTRY_DSN` | provider | Sentry → Project → Client Keys (blank → disabled) |
| `EXTERNAL_CALL_*`, `CIRCUIT_BREAKER_*`, `RATE_LIMIT_*` | tuning | sane defaults in `.env.example` |

## Architecture (the rules)

1. **One wrapper per external dependency** (`src/lib/wrappers/*`). Nothing else
   imports an SDK. Each wrapper owns timeout, retry, normalized errors, logging.
2. **Config validated at startup** — refuse to boot on bad config.
3. **No secret reaches the client** — only `NEXT_PUBLIC_*` is client-visible.
4. **Every external call** runs through `withResilience` (timeout +
   jittered-backoff retry + circuit breaker + metrics).
5. **Every request** carries an `x-request-id` correlation id through all logs.

```
src/
  lib/
    config/env.ts            # Layer 1 — Zod-validated config
    wrappers/                # Layer 2 — supabase, postgres, redis, stripe, resend
    resilience/              # Layer 5 — timeout, retry, circuit breaker
    observability/           # Layer 7 — logger, metrics, sentry, request-context
    ratelimit/ + http/rate-limit.ts   # Layer 6 — sliding window, 429
    session/                 # Layer 8 — Redis sessions + durable history + trimming
    connectors/              # Layer 9 — typed connector registry + injection guard
    auth/                    # Layer 10 — JWT tokens, session cookies, guards (RBAC)
    http/                    # route() wrapper, security headers/CORS
  db/                        # Drizzle schema + migrations + runner
  app/api/                   # health, metrics, stream, auth, demos
  middleware.ts              # request id, security headers, CORS
```

## How each layer was proven

See [`SETUP_REPORT.md`](./SETUP_REPORT.md) for the exact command/route per layer
and the Definition-of-Done checklist.

## Deployment (Vercel)

Set the env vars in the Vercel project, point `DATABASE_URL` at Supabase
Postgres and `REDIS_URL` at Upstash, then deploy. Postgres/Redis are reached
only through their wrappers, so no code changes are needed between local and
prod — only configuration.
