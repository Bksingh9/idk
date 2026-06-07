# Deploying PlaytestPool to Vercel

The app is deploy-ready. It needs three things in production: a **MongoDB**, a
**Redis**, and the **Vercel** project wired to this repo. Free tiers cover all
three. Total time ~15 minutes.

> The app validates its configuration at startup **and** during `next build`,
> so the environment variables below must be set in Vercel **before** the first
> deploy or the build will fail fast with a clear message.

---

## 1. Provision MongoDB (Atlas free tier)

1. Create an account at <https://www.mongodb.com/cloud/atlas/register>.
2. Create a free **M0** cluster.
3. **Database Access** → add a database user (username + password).
4. **Network Access** → add IP `0.0.0.0/0` (allow from anywhere — Vercel's build
   and serverless IPs are dynamic).
5. **Connect → Drivers** → copy the connection string. It looks like:
   ```
   mongodb+srv://<user>:<password>@<cluster>.xxxx.mongodb.net/?retryWrites=true&w=majority
   ```
   This is your `MONGODB_URI`.

## 2. Provision Redis (Upstash free tier)

1. Create an account at <https://upstash.com>.
2. Create a **Redis** database (pick a region near your Vercel region).
3. Copy the **TLS** connection URL (starts with `rediss://`):
   ```
   rediss://default:<token>@<host>.upstash.io:6379
   ```
   This is your `REDIS_URL`.

## 3. Connect the repo to Vercel

1. Go to <https://vercel.com/new> and import **`bksingh9/idk`**
   (team: *Trends-NPS*).
2. Framework preset: **Next.js** (auto-detected). Build settings come from
   `vercel.json` — leave them as-is.
3. **Production branch:** set to the branch you merge to (`main`).
4. Add the environment variables below (Settings → Environment Variables), then
   **Deploy**.

---

## 4. Environment variables

Set these for the **Production** (and Preview, if you want PR deploys)
environments. `[CORE]` are required — the app won't boot without them.

| Variable | Tier | Value |
|----------|------|-------|
| `NODE_ENV` | core | `production` |
| `APP_BASE_URL` | core | your deploy URL, e.g. `https://playtestpool.vercel.app` |
| `CORS_ALLOWED_ORIGINS` | core | same as `APP_BASE_URL` |
| `LOG_LEVEL` | core | `info` |
| `AUTH_JWT_SECRET` | core | output of `openssl rand -base64 48` (≥32 chars) |
| `AUTH_ACCESS_TTL_SECONDS` | core | `900` |
| `AUTH_REFRESH_TTL_SECONDS` | core | `1209600` |
| `MONGODB_URI` | core | from step 1 |
| `MONGODB_DB` | core | `playtestpool` |
| `REDIS_URL` | core | from step 2 |
| `SIGNUP_RATE_LIMIT` | core | `10` |
| `RATE_LIMIT_PER_USER_PER_MIN` | core | `60` |
| `RATE_LIMIT_GLOBAL_PER_MIN` | core | `1000` |
| `ADMIN_EMAILS` | optional | comma-separated emails allowed into `/admin` |
| `STRIPE_SECRET_KEY` | optional | `sk_test_…` (blank → billing disabled, gating still works) |
| `STRIPE_WEBHOOK_SECRET` | optional | from the Stripe webhook (step 6) |
| `STRIPE_PRICE_INDIE` / `STRIPE_PRICE_STUDIO` | optional | Stripe price IDs |
| `RESEND_API_KEY` | optional | `re_…` (blank → emails logged, not sent) |
| `EMAIL_FROM` | optional | `PlaytestPool <onboarding@resend.dev>` |
| `SENTRY_DSN` | optional | blank → error reporting disabled |

> **Chicken-and-egg with `APP_BASE_URL`:** you don't know the final URL until
> the project exists. Either (a) deploy once with a guess, then update
> `APP_BASE_URL` + `CORS_ALLOWED_ORIGINS` to the real URL and redeploy, or
> (b) set a custom domain first and use that.

## 5. First-run: create indexes (one time)

The app ensures indexes at startup automatically (non-fatal). To create them
explicitly against the production DB, run locally once with the prod URI:

```bash
MONGODB_URI='<your atlas uri>' MONGODB_DB=playtestpool pnpm db:indexes
```

## 6. (Optional) Stripe webhook

If you enabled Stripe, add a webhook endpoint in the Stripe dashboard:

- URL: `https://<your-domain>/api/stripe/webhook`
- Events: `customer.subscription.created`, `.updated`, `.deleted`
- Copy the signing secret into `STRIPE_WEBHOOK_SECRET` and redeploy.

---

## After deploy — smoke test

- `GET /api/health` → `{ ok: true }` with `mongo` and `redis` both healthy.
- Visit `/` → sign up as a developer → post a project → sign up as a tester →
  accept the invite → submit feedback. That exercises the full loop end to end.

Once the Vercel git integration is connected, every push to the production
branch redeploys automatically, and each PR gets a preview deployment.
