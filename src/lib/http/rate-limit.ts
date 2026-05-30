/**
 * Layer 6 — route-level rate-limit enforcement.
 *
 * Throws a normalized AppError(rate_limited) which the route handler turns into
 * a clean 429 with a Retry-After header. Identifies the caller by userId (from
 * auth context) when present, else by client IP.
 */
import { NextRequest } from "next/server";
import { AppError } from "@/lib/errors";
import { getContext } from "@/lib/observability/request-context";
import { rateLimit, consume } from "@/lib/ratelimit/rate-limiter";

function callerKey(req: NextRequest): string {
  const userId = getContext()?.userId;
  if (userId) return `u:${userId}`;
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  return `ip:${ip}`;
}

/** Enforce the default per-user + global limits. */
export async function enforceRateLimit(req: NextRequest): Promise<void> {
  const decision = await rateLimit(callerKey(req));
  if (!decision.allowed) {
    throw new AppError({
      category: "rate_limited",
      message: `rate limit exceeded (${decision.scope})`,
      retryAfterSeconds: decision.retryAfterSeconds,
    });
  }
}

/** Enforce a custom per-key limit (e.g. a tight limit on an expensive route). */
export async function enforceCustomLimit(
  req: NextRequest,
  bucket: string,
  limit: number
): Promise<void> {
  const key = `rl:custom:${bucket}:${callerKey(req)}`;
  const decision = await consume("user", key, limit);
  if (!decision.allowed) {
    throw new AppError({
      category: "rate_limited",
      message: `rate limit exceeded for ${bucket}`,
      retryAfterSeconds: decision.retryAfterSeconds,
    });
  }
}
