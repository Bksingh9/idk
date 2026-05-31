/**
 * Layer 8 proof — durable history trims + summarizes past the threshold while
 * keeping the recent window intact; Redis session persists and can be re-read.
 */
import { afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { history, MAX_MESSAGES, TRIM_THRESHOLD } from "@/lib/session/history";
import { sessionStore } from "@/lib/session/session-store";
import { disconnectMongo } from "@/lib/wrappers/mongo";
import { redis } from "@/lib/wrappers/redis";

afterAll(async () => {
  await disconnectMongo();
  await redis.disconnect();
});

describe("Layer 8 — Redis session store", () => {
  it("persists and re-reads a session, then destroys it", async () => {
    const s = await sessionStore.create("user-42", { plan: "indie" });
    const again = await sessionStore.get(s.id);
    expect(again?.userId).toBe("user-42");
    expect(again?.plan).toBe("indie");
    await sessionStore.destroy(s.id);
    expect(await sessionStore.get(s.id)).toBeNull();
  });
});

describe("Layer 8 — durable history trimming/summarization", () => {
  it("collapses overflow into a summary and bounds the live window", async () => {
    const sessionId = randomUUID();
    await history.ensureSession(sessionId, "user-42");

    const total = TRIM_THRESHOLD + 5;
    for (let i = 0; i < total; i++) {
      await history.append(sessionId, "user", `message number ${i}`);
    }

    const all = await history.list(sessionId);
    const summaries = all.filter((m) => m.role === "summary");
    const live = all.filter((m) => m.role !== "summary");

    // A rolling summary exists, and the live window never exceeds the trim
    // threshold (it is folded back to MAX_MESSAGES each time it is crossed).
    expect(summaries.length).toBeGreaterThanOrEqual(1);
    expect(live.length).toBeLessThanOrEqual(TRIM_THRESHOLD);
    expect(live.length).toBeGreaterThanOrEqual(MAX_MESSAGES);
    // The most recent message is preserved verbatim.
    expect(live.some((m) => m.content === `message number ${total - 1}`)).toBe(true);
  });
});
