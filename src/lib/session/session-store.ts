/**
 * Layer 8 — session store (hot state in Redis).
 *
 * Sessions live in Redis with a sliding TTL (the durable system of record is
 * Postgres, see history.ts). Used for ephemeral per-session state and as the
 * fast path for "is this session alive across requests".
 */
import { randomUUID } from "node:crypto";
import { env } from "@/lib/config/env";
import { redis } from "@/lib/wrappers/redis";

const PREFIX = "sess:";
const TTL = env.AUTH_REFRESH_TTL_SECONDS;

export interface SessionData {
  id: string;
  userId: string;
  createdAt: string;
  [k: string]: unknown;
}

export const sessionStore = {
  async create(userId: string, initial: Record<string, unknown> = {}): Promise<SessionData> {
    const id = randomUUID();
    const data: SessionData = { id, userId, createdAt: new Date().toISOString(), ...initial };
    await redis.set(PREFIX + id, JSON.stringify(data), TTL);
    return data;
  },

  async get(id: string): Promise<SessionData | null> {
    const raw = await redis.get(PREFIX + id);
    return raw ? (JSON.parse(raw) as SessionData) : null;
  },

  /** Refresh TTL on access (sliding expiration). */
  async touch(id: string): Promise<void> {
    await redis.expire(PREFIX + id, TTL);
  },

  async patch(id: string, patch: Record<string, unknown>): Promise<SessionData | null> {
    const current = await this.get(id);
    if (!current) return null;
    const next = { ...current, ...patch };
    await redis.set(PREFIX + id, JSON.stringify(next), TTL);
    return next;
  },

  async destroy(id: string): Promise<void> {
    await redis.del(PREFIX + id);
  },
};
