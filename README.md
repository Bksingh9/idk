# PlaytestPool

A two-sided marketplace matching indie game/app developers with real
playtesters. Built on a production-grade foundation (10 proven layers — see
[`SETUP_REPORT.md`](./SETUP_REPORT.md)) with the full MVP loop on top.

- **Stack:** Next.js 15 (App Router, TS) · **MongoDB** (durable data) · Redis
  (cache/sessions/rate-limit) · built-in JWT/RBAC auth · Stripe (subscriptions,
  test mode) · Resend (email; console fallback) · Tailwind · deploy target Vercel.
- **Auth/DB note:** the product runs on MongoDB + our own JWT auth. Supabase is
  optional and off the product path. Authorization is enforced in the service
  layer (every query is scoped to the authenticated user).

## Quick start

```bash
pnpm install
cp .env.example .env.local        # fill in values (works out of the box for local)
pnpm infra:up                     # local MongoDB + Redis (Docker)
pnpm db:indexes                   # create Mongo indexes (idempotent)
pnpm dev                          # http://localhost:3000
```

## Features (Phases 1–6)

1. **Auth + profiles** — email/password (scrypt), role chosen at signup
   (developer/tester), role-gated dashboards.
2. **Developer side** — post a project (title, description, platform, build URL,
   target genre/platform/country tags, up to 5 custom questions), project list
   with status + feedback count, project detail with aggregated feedback.
3. **Matching + tester side** — on post, eligible testers (overlapping tags) are
   invited (capped; Studio gets a larger fan-out); testers accept/decline, browse
   open projects and opt in; invite emails via Resend (console fallback).
4. **Feedback loop** — testers submit structured feedback (fun rating, would-pay,
   bugs, drop-off, comments); submitting bumps reputation + tests-completed; the
   developer rates feedback quality (1–5), which feeds the tester's reputation.
5. **Subscriptions** — Indie ($39/mo, 5 active projects) and Studio ($99/mo,
   unlimited + priority matching); free devs get 1 active project. Stripe
   Checkout + customer portal + webhook sync. Testers are always free.
6. **Polish** — landing page explaining both sides, tester reputation visible to
   developers, an operator-only `/admin` view to deactivate flaky testers.

## Commands

```bash
pnpm dev            # dev server
pnpm build          # production build
pnpm start          # run production build
pnpm typecheck      # tsc --noEmit
pnpm test           # vitest (unit + integration; needs infra:up)
pnpm test:e2e       # Playwright E2E (drives the real app; needs infra:up)
pnpm check:env      # validate .env.local, exit non-zero if invalid
pnpm infra:up       # docker compose up MongoDB + Redis
pnpm infra:down     # stop them
pnpm db:indexes     # ensure Mongo indexes
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
| `MONGODB_URI` | core | local Docker, or MongoDB Atlas `mongodb+srv://…` |
| `MONGODB_DB` | core | database name (default `playtestpool`) |
| `REDIS_URL` | core | local Docker, or Upstash `rediss://…` |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | provider | Stripe → Developers (test mode) |
| `STRIPE_PRICE_INDIE` / `STRIPE_PRICE_STUDIO` | provider | Stripe → Products → price IDs |
| `RESEND_API_KEY` / `EMAIL_FROM` | provider | Resend → API Keys (blank → console fallback) |
| `SENTRY_DSN` | provider | Sentry → Project → Client Keys (blank → disabled) |
| `ADMIN_EMAILS` | provider | comma-separated emails allowed into `/admin` |
| `NEXT_PUBLIC_SUPABASE_*` | optional | unused by the product path |
| `EXTERNAL_CALL_*`, `CIRCUIT_BREAKER_*`, `RATE_LIMIT_*` | tuning | sane defaults in `.env.example` |

## Stripe (test mode) setup

1. Create two recurring Products in the Stripe test dashboard (Indie $39/mo,
   Studio $99/mo); copy their **price IDs** into `STRIPE_PRICE_INDIE/STUDIO`.
2. Set `STRIPE_SECRET_KEY` (test `sk_test_…`).
3. For webhooks locally: `stripe listen --forward-to localhost:3000/api/stripe/webhook`
   and put the signing secret in `STRIPE_WEBHOOK_SECRET`.
4. Without these, billing is disabled gracefully — plan gating still applies
   (everyone is on the free plan).

## Architecture (the rules)

1. **One wrapper per external dependency** (`src/lib/wrappers/*`: mongo, redis,
   stripe, resend, supabase). Nothing else imports an SDK.
2. **Config validated at startup** — refuse to boot on bad config.
3. **No secret reaches the client** — only `NEXT_PUBLIC_*` is client-visible.
4. **Every external call** runs through `withResilience` (timeout + jittered
   retry + circuit breaker + metrics).
5. **Every request** carries an `x-request-id` correlation id through all logs.

```
src/
  lib/
    config/env.ts            # Zod-validated config
    wrappers/                # mongo, redis, stripe, resend, supabase
    resilience/              # timeout, retry, circuit breaker
    observability/           # logger, metrics, sentry, request-context
    ratelimit/ + http/       # sliding-window limiter, route() wrapper, security
    session/                 # Redis sessions + durable history + trimming
    connectors/              # typed connector registry + injection guard
    auth/                    # JWT tokens, cookies, guards (RBAC + admin)
    services/                # auth, profile, project, match, tester, feedback,
                             #   billing, admin (all authorization-scoped)
  db/                        # Mongo collections/types + index setup
  app/                       # pages + API routes
  middleware.ts              # request id, security headers, CORS
tests/
  *.test.ts                  # vitest unit/integration
  e2e/*.spec.ts              # Playwright end-to-end
```

## Deployment (Vercel)

Set the env vars in Vercel, point `MONGODB_URI` at MongoDB Atlas and `REDIS_URL`
at Upstash, then deploy. All external access goes through the wrappers, so no
code changes are needed between local and prod — only configuration. Run
`pnpm db:indexes` against the production database once.
