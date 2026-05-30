/**
 * Drizzle schema — FOUNDATION tables only.
 *
 * These exist to prove the persistence layer (migrations + round-trip) and to
 * back Layer 6 (durable usage log) and Layer 8 (durable conversation history).
 * Product tables (profiles, projects, …) arrive in Phase 1 as Supabase SQL
 * migrations with RLS — kept separate from this engine-level schema.
 */
import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

export const healthChecks = pgTable("health_checks", {
  id: uuid("id").primaryKey().defaultRandom(),
  note: text("note").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Layer 8 — durable conversation/session history (the Redis copy is the hot
// cache; this is the system of record).
export const conversationSessions = pgTable("conversation_sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const conversationMessages = pgTable(
  "conversation_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: text("session_id").notNull(),
    role: text("role").notNull(), // 'user' | 'assistant' | 'system' | 'summary'
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    bySession: index("idx_messages_session").on(t.sessionId, t.createdAt),
  })
);

// Layer 6 — durable per-request usage/spend log for metered external calls.
export const usageEvents = pgTable(
  "usage_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: text("request_id"),
    userId: text("user_id"),
    dependency: text("dependency").notNull(),
    operation: text("operation").notNull(),
    units: integer("units").notNull().default(1),
    meta: jsonb("meta").$type<Record<string, unknown>>().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byDep: index("idx_usage_dependency").on(t.dependency, t.createdAt),
  })
);
