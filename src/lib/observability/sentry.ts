/**
 * Layer 7 — error reporting wrapper (Sentry).
 *
 * The ONLY place that touches the Sentry SDK (rule 1). If SENTRY_DSN is unset,
 * this degrades to local logging — the app still runs, errors still appear in
 * structured logs.
 */
import * as Sentry from "@sentry/nextjs";
import { env, features } from "@/lib/config/env";
import { log } from "./logger";
import { getContext } from "./request-context";

const logger = log("sentry");
let initialized = false;

export function initSentry(): void {
  if (initialized) return;
  initialized = true;
  if (!features.sentry) {
    logger.info({ enabled: false }, "Sentry disabled (no SENTRY_DSN) — errors go to logs only");
    return;
  }
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    tracesSampleRate: env.NODE_ENV === "production" ? 0.1 : 1.0,
  });
  logger.info({ enabled: true }, "Sentry initialized");
}

/** Report an error to Sentry (if enabled) and always to structured logs. */
export function captureError(error: unknown, extra?: Record<string, unknown>): void {
  const ctx = getContext();
  logger.error({ err: error, request_id: ctx?.requestId, ...extra }, "captured error");
  if (features.sentry) {
    Sentry.withScope((scope) => {
      if (ctx?.requestId) scope.setTag("request_id", ctx.requestId);
      if (ctx?.userId) scope.setUser({ id: ctx.userId });
      if (extra) scope.setExtras(extra);
      Sentry.captureException(error);
    });
  }
}
