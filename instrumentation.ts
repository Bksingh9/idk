/**
 * Next.js startup hook. Runs once when the server process boots (Node runtime).
 *
 * Layer 1: validate configuration here so the app refuses to boot on bad config
 * before serving a single request.
 * Layer 7: initialize Sentry + metrics registry at startup.
 */
export async function register() {
  // Only run on the Node.js server runtime (not edge/middleware).
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { env } = await import("@/lib/config/env");
  const { logger } = await import("@/lib/observability/logger");
  const { initSentry } = await import("@/lib/observability/sentry");

  initSentry();

  logger.info(
    {
      event: "boot",
      node_env: env.NODE_ENV,
      base_url: env.APP_BASE_URL,
      features: {
        stripe: !!env.STRIPE_SECRET_KEY,
        resend: !!env.RESEND_API_KEY,
        sentry: !!env.SENTRY_DSN,
      },
    },
    "configuration validated — booting"
  );
}
