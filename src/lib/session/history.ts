/**
 * Layer 8 — durable conversation history with a trimming/summarization strategy.
 *
 * Messages are appended to Postgres (system of record). To keep a long history
 * within a bounded window, when the number of non-summary messages exceeds
 * MAX_MESSAGES we collapse the oldest overflow into a single rolling "summary"
 * message and delete the originals — so context stays bounded while nothing is
 * silently lost (the gist is retained in the summary).
 *
 * The summarizer here is deterministic (no LLM wired yet); swap `summarize` for
 * a model-backed implementation later without changing callers.
 */
import { and, asc, eq, ne } from "drizzle-orm";
import { db, withDb } from "@/lib/wrappers/postgres";
import { conversationMessages, conversationSessions } from "@/db/schema";
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
  // Deterministic placeholder strategy: a compact digest of what was said.
  const parts = messages.map((m) => `${m.role}: ${m.content}`);
  const joined = parts.join(" | ");
  const clipped = joined.length > 500 ? joined.slice(0, 497) + "..." : joined;
  return `Summary of ${messages.length} earlier message(s): ${clipped}`;
}

export const history = {
  async ensureSession(sessionId: string, userId: string): Promise<void> {
    await withDb("history.ensureSession", () =>
      db
        .insert(conversationSessions)
        .values({ id: sessionId, userId })
        .onConflictDoNothing()
    );
  },

  async append(sessionId: string, role: Role, content: string): Promise<void> {
    await withDb("history.append", () =>
      db.insert(conversationMessages).values({ sessionId, role, content })
    );
    await this.trimIfNeeded(sessionId);
  },

  async list(sessionId: string): Promise<Message[]> {
    const rows = await withDb("history.list", () =>
      db
        .select()
        .from(conversationMessages)
        .where(eq(conversationMessages.sessionId, sessionId))
        .orderBy(asc(conversationMessages.createdAt))
    );
    return rows.map((r) => ({
      id: r.id,
      role: r.role as Role,
      content: r.content,
      createdAt: r.createdAt,
    }));
  },

  /**
   * If live (non-summary) messages exceed TRIM_THRESHOLD, fold all but the most
   * recent MAX_MESSAGES into a single rolling summary message.
   */
  async trimIfNeeded(sessionId: string): Promise<{ trimmed: number } | null> {
    const live = await withDb("history.live", () =>
      db
        .select()
        .from(conversationMessages)
        .where(
          and(
            eq(conversationMessages.sessionId, sessionId),
            ne(conversationMessages.role, "summary")
          )
        )
        .orderBy(asc(conversationMessages.createdAt))
    );

    if (live.length <= TRIM_THRESHOLD) return null;

    const overflow = live.slice(0, live.length - MAX_MESSAGES);
    const summaryText = summarize(overflow);

    await withDb("history.trim", async () => {
      await db.transaction(async (tx) => {
        for (const m of overflow) {
          await tx.delete(conversationMessages).where(eq(conversationMessages.id, m.id));
        }
        await tx
          .insert(conversationMessages)
          .values({ sessionId, role: "summary", content: summaryText });
      });
    });

    logger.info({ sessionId, trimmed: overflow.length }, "history trimmed + summarized");
    return { trimmed: overflow.length };
  },
};
