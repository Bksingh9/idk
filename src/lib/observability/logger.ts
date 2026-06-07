/**
 * Layer 7 — structured JSON logging.
 *
 * Pino emits one JSON object per line. Every log automatically carries the
 * current request id / route / method / userId from the async context, so logs
 * are correlatable end-to-end (rule 5). Use `logger` everywhere; do not call
 * console.* in app code.
 */
import pino from "pino";
import { env } from "@/lib/config/env";
import { getContext } from "./request-context";

const isDev = env.NODE_ENV === "development";

const base = pino({
  level: env.LOG_LEVEL,
  // Pretty output only in local dev; JSON lines everywhere else.
  transport: isDev
    ? { target: "pino-pretty", options: { colorize: true, translateTime: "SYS:standard" } }
    : undefined,
  formatters: {
    level: (label) => ({ level: label }),
  },
  // Inject correlation fields into every log line.
  mixin() {
    const ctx = getContext();
    if (!ctx) return {};
    return {
      request_id: ctx.requestId,
      route: ctx.route,
      method: ctx.method,
      user_id: ctx.userId,
    };
  },
  redact: {
    paths: [
      "*.authorization",
      "*.cookie",
      "*.password",
      "*.token",
      "req.headers.authorization",
      "req.headers.cookie",
    ],
    censor: "[redacted]",
  },
});

export const logger = base;

/** Child logger scoped to a subsystem (e.g. a wrapper), e.g. log("redis"). */
export function log(subsystem: string) {
  return base.child({ subsystem });
}
