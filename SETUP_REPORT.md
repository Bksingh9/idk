# PlaytestPool — Foundation Setup Report

Production-grade engineering foundation for PlaytestPool. **No product features
yet** — this report proves each of the 10 foundation layers works in isolation.
Approve this report before feature work (Phase 1) begins.

## How to run everything

```bash
pnpm install
cp .env.example .env.local      # already present in this workspace
pnpm infra:up                   # local Postgres + Redis via Docker (proves real round-trips)
pnpm db:migrate                 # apply Drizzle migrations
pnpm test                       # unit + integration proofs (12 tests)
pnpm dev                        # http://localhost:3000
```

> The app boots with **placeholder Supabase keys** (URL-valid) so the engine
> layers are fully exercisable offline. Postgres and Redis are **real** (Docker).
> Supabase/Stripe/Resend/Sentry are provider integrations that degrade
> gracefully until you paste real keys.

---

## Layer-by-layer proof

| # | Layer | What proves it | Result |
|---|-------|----------------|--------|
| 1 | **Config & secrets** | `grep -v '^AUTH_JWT_SECRET' .env.local > /tmp/b.env && pnpm exec tsx --env-file=/tmp/b.env scripts/check-env.ts` | Exits **1** with `✗ AUTH_JWT_SECRET: Required`. With full env, `pnpm check:env` → exit 0. App refuses to boot on bad config. |
| 2 | **External wrappers** | `curl localhost:3000/api/health` | Real round-trips through redis/postgres wrappers (`ok:true`, ~9ms). One wrapper per dep; nothing calls an SDK directly. |
| 3 | **Persistence & cache** | `pnpm db:migrate` then `pnpm test` (`tests/persistence.test.ts`) | Migration applies (4 tables). DB write+read and Redis set/get round-trip **through the wrappers**. |
| 4 | **Streaming (SSE)** | `curl -N "localhost:3000/api/stream?count=5"` and `/stream` page | Chunks arrive ~250ms apart and render progressively. |
| 5 | **Resilience** | `tests/resilience.test.ts`; `/api/health` with bad Supabase | Retry-with-jitter, hard timeout, give-up→normalized error, circuit breaker open/half-open/close. Unreachable Supabase **degrades gracefully** (health stays `ok`, provider shows `false`). |
| 6 | **Rate limit & usage** | `for i in $(seq 7); do curl localhost:3000/api/demo/limited; done` | 5 allowed, then clean **429 + `Retry-After`**. `usage_units_total` + `rate_limit_decisions_total` metrics increment. |
| 7 | **Observability** | `/api/metrics` + dev logs | Structured JSON logs with `request_id` on every request; Prometheus metrics increment (`http_requests_total`, `external_calls_total`). Sentry wrapper active when `SENTRY_DSN` set. |
| 8 | **Memory / state** | `tests/memory.test.ts` + cookie-jar curl to `/api/demo/session` | Redis session persists across requests; durable Postgres history **trims + summarizes** past threshold while keeping the recent window. |
| 9 | **Connector registry** | `curl -X POST localhost:3000/api/demo/connector` | Typed registry; real external round-trip (host pinned); **privileged connector blocked (403) from untrusted input**; invalid input → 400. All logged. |
| 10 | **Auth & security** | dev-login + `/api/me` + `/api/admin/ping` | Unauth → **401**; tester → `/me` 200 but `/admin` **403** (RBAC); developer → 200; refresh rotation → 200. Security headers + locked CORS on every response. |

### Exact commands for the key proofs

**Layer 1 — refuse to boot:**
```bash
grep -v '^AUTH_JWT_SECRET' .env.local > /tmp/broken.env
pnpm exec tsx --env-file=/tmp/broken.env scripts/check-env.ts   # → exit 1, clear message
```

**Layer 6 — clean 429:**
```bash
for i in $(seq 1 7); do curl -s -o /dev/null -w "%{http_code}\n" localhost:3000/api/demo/limited; done
curl -s -D - -o /dev/null localhost:3000/api/demo/limited | grep -i retry-after
```

**Layer 10 — protected route rejected then allowed:**
```bash
curl -s -o /dev/null -w "%{http_code}\n" localhost:3000/api/me                       # 401
curl -s -c j.txt -X POST localhost:3000/api/auth/dev-login -H 'content-type: application/json' -d '{"role":"developer"}'
curl -s -b j.txt -o /dev/null -w "%{http_code}\n" localhost:3000/api/admin/ping       # 200
```

---

## Definition of Done

- [x] App refuses to boot on missing/invalid config (Layer 1).
- [x] Every external dependency is behind a wrapper; nothing calls SDKs directly (Layer 2).
- [x] A forced dependency failure degrades gracefully — proven (Layer 5 / health route).
- [x] Rate limit returns a clean 429 when exceeded — proven (Layer 6).
- [x] Structured logs with request IDs visible for every request (Layer 7).
- [x] Migrations run; DB + cache round-trip both work (Layer 3).
- [x] An unauthenticated request to a protected route is rejected (Layer 10).
- [x] README documents boot, env vars, and how each layer was proven.

## Architectural rules enforced for the life of the project

1. No route/component/service calls an external SDK directly — only the wrapper
   modules in `src/lib/wrappers/*` (and `src/lib/observability/sentry.ts`) import SDKs.
2. App validates all config at startup (`src/lib/config/env.ts`) and refuses to boot.
3. No secret reaches the client — only `NEXT_PUBLIC_*` vars are referenced client-side;
   service-role/JWT secrets are server-only.
4. Every external call has a hard timeout + retry-with-jittered-backoff (`withResilience`).
5. Every request carries a correlation id (`x-request-id`) flowing through all logs.

## Auth reconciliation ("both")

Supabase Auth is the **identity backbone** (verifies credentials, owns users,
backs RLS in Phase 1). On top of it the app issues its **own** short-lived access
+ refresh JWTs (the Better-Auth-style boundary) carrying the role for RBAC, in
httpOnly cookies. One identity source, one app session layer — no two competing
user stores.

## Next step

Awaiting approval of this report. On approval we begin **Phase 1 — Auth +
profiles** (PlaytestPool product), starting by confirming the data model.
