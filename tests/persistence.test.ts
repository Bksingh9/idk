/**
 * Layer 3 proof — durable Postgres write+read and Redis cache set/get round-trip
 * through the wrappers (never the raw SDK).
 */
import { afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, withDb, disconnectDb } from "@/lib/wrappers/postgres";
import { healthChecks } from "@/db/schema";
import { redis } from "@/lib/wrappers/redis";

afterAll(async () => {
  await disconnectDb();
  await redis.disconnect();
});

describe("Layer 3 — Postgres (Drizzle wrapper)", () => {
  it("writes and reads back a row", async () => {
    const note = `health-${Date.now()}`;
    const [inserted] = await withDb("insert.health", () =>
      db.insert(healthChecks).values({ note }).returning()
    );
    expect(inserted.id).toBeTruthy();

    const rows = await withDb("select.health", () =>
      db.select().from(healthChecks).where(eq(healthChecks.id, inserted.id))
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].note).toBe(note);
  });
});

describe("Layer 3 — Redis (ioredis wrapper)", () => {
  it("set/get/del round-trips with TTL", async () => {
    const key = `test:cache:${Date.now()}`;
    await redis.set(key, "hello", 60);
    expect(await redis.get(key)).toBe("hello");
    await redis.del(key);
    expect(await redis.get(key)).toBeNull();
  });
});
