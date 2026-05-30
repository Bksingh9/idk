/**
 * Layer 2/3 — Redis wrapper (the ONLY module that imports ioredis; rule 1).
 *
 * Owns connection lifecycle, timeouts, retries (via withResilience), normalized
 * errors and structured logging. Works with local Docker Redis (redis://) and
 * Upstash (rediss://). Backs cache, sessions (Layer 8) and rate limits (Layer 6).
 */
import Redis from "ioredis";
import { env } from "@/lib/config/env";
import { log } from "@/lib/observability/logger";
import { withResilience } from "@/lib/resilience/with-resilience";

const logger = log("redis");
const DEP = "redis";

let client: Redis | null = null;

function getClient(): Redis {
  if (client) return client;
  client = new Redis(env.REDIS_URL, {
    // We own retry/timeout policy at the call layer; keep ioredis lean and
    // fail fast so withResilience controls backoff.
    maxRetriesPerRequest: 1,
    connectTimeout: env.EXTERNAL_CALL_TIMEOUT_MS,
    lazyConnect: false,
    enableReadyCheck: true,
    retryStrategy: (times) => (times > 3 ? null : Math.min(times * 200, 1000)),
  });
  client.on("error", (err) => logger.warn({ err: err.message }, "redis client error"));
  client.on("connect", () => logger.info("redis connected"));
  return client;
}

export const redis = {
  async ping(): Promise<string> {
    return withResilience({ dependency: DEP, operation: "ping" }, () => getClient().ping());
  },

  async get(key: string): Promise<string | null> {
    return withResilience({ dependency: DEP, operation: "get" }, () => getClient().get(key));
  },

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    await withResilience({ dependency: DEP, operation: "set" }, () =>
      ttlSeconds
        ? getClient().set(key, value, "EX", ttlSeconds)
        : getClient().set(key, value)
    );
  },

  async del(key: string): Promise<void> {
    await withResilience({ dependency: DEP, operation: "del" }, () => getClient().del(key));
  },

  /** Atomic INCR returning the new counter value (used by rate limiter). */
  async incr(key: string): Promise<number> {
    return withResilience({ dependency: DEP, operation: "incr" }, () => getClient().incr(key));
  },

  async expire(key: string, ttlSeconds: number): Promise<void> {
    await withResilience({ dependency: DEP, operation: "expire" }, () =>
      getClient().expire(key, ttlSeconds)
    );
  },

  /** Run a Lua script atomically (used by the sliding-window limiter). */
  async eval(script: string, keys: string[], args: (string | number)[]): Promise<unknown> {
    return withResilience({ dependency: DEP, operation: "eval" }, () =>
      getClient().eval(script, keys.length, ...keys, ...args)
    );
  },

  /** For graceful shutdown / tests. */
  async disconnect(): Promise<void> {
    if (client) {
      await client.quit().catch(() => client?.disconnect());
      client = null;
    }
  },
};
