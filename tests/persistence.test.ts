/**
 * Layer 3 proof — durable MongoDB write+read and Redis cache set/get round-trip
 * through the wrappers (never the raw driver).
 */
import { afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { collections } from "@/db/collections";
import { withMongo, disconnectMongo } from "@/lib/wrappers/mongo";
import { redis } from "@/lib/wrappers/redis";

afterAll(async () => {
  await disconnectMongo();
  await redis.disconnect();
});

describe("Layer 3 — MongoDB (wrapper)", () => {
  it("writes and reads back a document", async () => {
    const id = randomUUID();
    const note = `health-${Date.now()}`;
    await withMongo("test.insert", () =>
      collections.healthChecks().insertOne({ _id: id, note, createdAt: new Date() })
    );
    const found = await withMongo("test.find", () =>
      collections.healthChecks().findOne({ _id: id })
    );
    expect(found?.note).toBe(note);
    await withMongo("test.cleanup", () => collections.healthChecks().deleteOne({ _id: id }));
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
