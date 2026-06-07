/**
 * Layer 2/3 — MongoDB wrapper (the ONLY module that imports the mongodb driver;
 * rule 1).
 *
 * Owns the client lifecycle and routes operations through the resilience policy
 * (timeout/retry/breaker/metrics). Application code gets typed collections via
 * `collections.*` and wraps calls with `withMongo` so every round-trip is
 * timed, retried on transient errors, and logged.
 */
import { MongoClient, type Db, type Collection, type Document } from "mongodb";
import { env } from "@/lib/config/env";
import { log } from "@/lib/observability/logger";
import { withResilience } from "@/lib/resilience/with-resilience";

const logger = log("mongo");
const DEP = "mongodb";

// Pin the client to globalThis so Next's dev module reloads reuse one pool.
const g = globalThis as typeof globalThis & {
  __ptp_mongo?: { client: MongoClient; db: Db };
};

function connect(): { client: MongoClient; db: Db } {
  if (g.__ptp_mongo) return g.__ptp_mongo;
  const client = new MongoClient(env.MONGODB_URI, {
    serverSelectionTimeoutMS: env.EXTERNAL_CALL_TIMEOUT_MS,
    connectTimeoutMS: env.EXTERNAL_CALL_TIMEOUT_MS,
    maxPoolSize: 10,
    retryWrites: true,
  });
  client.on("serverHeartbeatFailed", (e) =>
    logger.warn({ err: e.failure?.message }, "mongo heartbeat failed")
  );
  g.__ptp_mongo = { client, db: client.db(env.MONGODB_DB) };
  return g.__ptp_mongo;
}

export function getDb(): Db {
  return connect().db;
}

export function collection<T extends Document>(name: string): Collection<T> {
  return getDb().collection<T>(name);
}

/** Run a Mongo operation through the resilience policy. */
export async function withMongo<T>(operation: string, fn: () => Promise<T>): Promise<T> {
  return withResilience({ dependency: DEP, operation }, fn);
}

/** Liveness check used by the health route. */
export async function pingMongo(): Promise<boolean> {
  return withResilience({ dependency: DEP, operation: "ping", maxRetries: 1 }, async () => {
    const res = await getDb().command({ ping: 1 });
    return res.ok === 1;
  });
}

export async function disconnectMongo(): Promise<void> {
  if (g.__ptp_mongo) {
    await g.__ptp_mongo.client.close().catch(() => {});
    g.__ptp_mongo = undefined;
  }
}
