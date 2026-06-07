/**
 * Layer 6 — Redis-backed sliding-window rate limiter.
 *
 * Atomic sliding-window-log via a Lua script (one round-trip, no races): prune
 * entries older than the window, add the current timestamp, count, set TTL.
 * Enforces BOTH a per-user limit and a global limit; the stricter decision wins.
 * Decisions are recorded as metrics. Returns a clean 429 + Retry-After upstream.
 */
import { env } from "@/lib/config/env";
import { redis } from "@/lib/wrappers/redis";
import { rateLimitDecisions } from "@/lib/observability/metrics";
import { log } from "@/lib/observability/logger";

const logger = log("ratelimit");

const SLIDING_WINDOW = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
local count = redis.call('ZCARD', key)
if count < limit then
  redis.call('ZADD', key, now, now .. '-' .. math.random())
  redis.call('PEXPIRE', key, window)
  return {1, limit - count - 1}
end
local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
local resetMs = window
if oldest[2] then resetMs = (tonumber(oldest[2]) + window) - now end
return {0, resetMs}
`;

export interface RateLimitResult {
  allowed: boolean;
  scope: "user" | "global";
  remaining: number;
  retryAfterSeconds: number;
}

const WINDOW_MS = 60_000;

export async function consume(
  scope: "user" | "global",
  key: string,
  limit: number
): Promise<{ allowed: boolean; retryAfterSeconds: number; remaining: number }> {
  const r = await check(scope, key, limit);
  return {
    allowed: r.allowed,
    remaining: r.allowed ? r.second : 0,
    retryAfterSeconds: r.allowed ? 0 : Math.max(1, Math.ceil(r.second / 1000)),
  };
}

async function check(scope: "user" | "global", key: string, limit: number) {
  const res = (await redis.eval(SLIDING_WINDOW, [key], [Date.now(), WINDOW_MS, limit])) as [
    number,
    number,
  ];
  const allowed = res[0] === 1;
  rateLimitDecisions.inc({ scope, decision: allowed ? "allow" : "deny" });
  return { allowed, second: res[1] };
}

/**
 * Returns the limiting decision. Checks the global bucket first, then the
 * per-user bucket; the first denial wins.
 */
export async function rateLimit(userKey: string): Promise<RateLimitResult> {
  // Global guard.
  const global = await check("global", "rl:global", env.RATE_LIMIT_GLOBAL_PER_MIN);
  if (!global.allowed) {
    const retryAfterSeconds = Math.max(1, Math.ceil(global.second / 1000));
    logger.warn({ scope: "global", retryAfterSeconds }, "rate limit exceeded");
    return { allowed: false, scope: "global", remaining: 0, retryAfterSeconds };
  }
  // Per-user guard.
  const user = await check("user", `rl:user:${userKey}`, env.RATE_LIMIT_PER_USER_PER_MIN);
  if (!user.allowed) {
    const retryAfterSeconds = Math.max(1, Math.ceil(user.second / 1000));
    logger.warn({ scope: "user", userKey, retryAfterSeconds }, "rate limit exceeded");
    return { allowed: false, scope: "user", remaining: 0, retryAfterSeconds };
  }
  return { allowed: true, scope: "user", remaining: user.second, retryAfterSeconds: 0 };
}
