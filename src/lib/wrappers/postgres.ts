/**
 * Layer 2/3 — Postgres wrapper (the ONLY module that imports the postgres
 * driver / Drizzle client; rule 1).
 *
 * Exposes a typed Drizzle `db` plus a `query` helper that routes raw round-trips
 * through withResilience (timeout/retry/breaker/metrics). Application code uses
 * `db` for typed queries; both share one pooled connection.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import { env } from "@/lib/config/env";
import { log } from "@/lib/observability/logger";
import { withResilience } from "@/lib/resilience/with-resilience";
import * as schema from "@/db/schema";

const logger = log("postgres");
const DEP = "postgres";

// Connection-limited pool (free managed Postgres caps connections low).
const queryClient = postgres(env.DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: Math.ceil(env.EXTERNAL_CALL_TIMEOUT_MS / 1000),
  onnotice: () => {},
});

export const db = drizzle(queryClient, { schema });

/** Liveness check used by the health route. */
export async function pingDb(): Promise<number> {
  return withResilience({ dependency: DEP, operation: "ping" }, async () => {
    const rows = await queryClient`select 1 as ok`;
    return Number(rows[0]?.ok ?? 0);
  });
}

/** Run a typed Drizzle operation through the resilience policy. */
export async function withDb<T>(operation: string, fn: () => Promise<T>): Promise<T> {
  return withResilience({ dependency: DEP, operation }, fn);
}

export async function disconnectDb(): Promise<void> {
  await queryClient.end({ timeout: 5 }).catch((e) => logger.warn({ err: String(e) }, "pg end error"));
}

export { sql };
