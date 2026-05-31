/**
 * Layer 8 — durable conversation history with a trimming/summarization strategy
 * (now backed by MongoDB).
 *
 * Messages are appended to the conversation_messages collection (system of
 * record; the Redis session is the hot cache). When the number of non-summary
 * messages exceeds TRIM_THRESHOLD we collapse the oldest overflow into a single
 * rolling "summary" message and delete the originals — so context stays bounded
 * while the gist is retained.
 */
import { randomUUID } from "node:crypto";
import { collections } from "@/db/collections";
import { withMongo } from "@/lib/wrappers/mongo";
import { log } from "@/lib/observability/logger";

const logger = log("history");

export const MAX_MESSAGES = 10; // keep the most recent N verbatim
export const TRIM_THRESHOLD = 14; // trim once we exceed this many live messages

export type Role = "user" | "assistant" | "system" | "summary";

export interface Message {
  id: string;
  role: Role;
  content: string;
  createdAt: Date;
}

function summarize(messages: { role: string; content: string }[]): string {
  const parts = messages.map((m) => `${m.role}: ${m.content}`);
  const joined = parts.join(" | ");
  const clipped = joined.length > 500 ? joined.slice(0, 497) + "..." : joined;
  return `Summary of ${messages.length} earlier message(s): ${clipped}`;
}

export const history = {
  async ensureSession(sessionId: string, userId: string): Promise<void> {
    await withMongo("history.ensureSession", async () => {
      const now = new Date();
      await collections.conversationSessions().updateOne(
        { _id: sessionId },
        { $setOnInsert: { userId, createdAt: now }, $set: { updatedAt: now } },
        { upsert: true }
      );
    });
  },

  async append(sessionId: string, role: Role, content: string): Promise<void> {
    await withMongo("history.append", () =>
      collections.conversationMessages().insertOne({
        _id: randomUUID(),
        sessionId,
        role,
        content,
        createdAt: new Date(),
      })
    );
    await this.trimIfNeeded(sessionId);
  },

  async list(sessionId: string): Promise<Message[]> {
    const rows = await withMongo("history.list", () =>
      collections
        .conversationMessages()
        .find({ sessionId })
        .sort({ createdAt: 1 })
        .toArray()
    );
    return rows.map((r) => ({
      id: r._id,
      role: r.role,
      content: r.content,
      createdAt: r.createdAt,
    }));
  },

  /**
   * If live (non-summary) messages exceed TRIM_THRESHOLD, fold all but the most
   * recent MAX_MESSAGES into a single rolling summary message.
   */
  async trimIfNeeded(sessionId: string): Promise<{ trimmed: number } | null> {
    const live = await withMongo("history.live", () =>
      collections
        .conversationMessages()
        .find({ sessionId, role: { $ne: "summary" } })
        .sort({ createdAt: 1 })
        .toArray()
    );

    if (live.length <= TRIM_THRESHOLD) return null;

    const overflow = live.slice(0, live.length - MAX_MESSAGES);
    const summaryText = summarize(overflow);

    await withMongo("history.trim", async () => {
      await collections
        .conversationMessages()
        .deleteMany({ _id: { $in: overflow.map((m) => m._id) } });
      await collections.conversationMessages().insertOne({
        _id: randomUUID(),
        sessionId,
        role: "summary",
        content: summaryText,
        // Place the summary before the retained window.
        createdAt: overflow[overflow.length - 1].createdAt,
      });
    });

    logger.info({ sessionId, trimmed: overflow.length }, "history trimmed + summarized");
    return { trimmed: overflow.length };
  },
};
