/**
 * Product schema — PlaytestPool domain tables (Phase 1+).
 *
 * Authorization is enforced in the service layer (see src/lib/services/*), not
 * via database RLS, since we own auth (JWT/RBAC) and the Postgres connection.
 * Every query that returns user-scoped data filters by the caller's id/role.
 */
import { sql } from "drizzle-orm";
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";

// --- Enums -------------------------------------------------------------------
export const userRole = pgEnum("user_role", ["developer", "tester"]);
export const experienceLevel = pgEnum("experience_level", [
  "new",
  "casual",
  "experienced",
  "pro",
]);
export const projectStatus = pgEnum("project_status", ["open", "closed"]);
export const inviteStatus = pgEnum("invite_status", [
  "invited",
  "accepted",
  "declined",
  "completed",
]);
export const planTier = pgEnum("plan_tier", ["free", "indie", "studio"]);

// --- Auth: users (we own identity) ------------------------------------------
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// --- profiles (1:1 with users) ----------------------------------------------
export const profiles = pgTable("profiles", {
  id: uuid("id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  role: userRole("role").notNull(),
  displayName: text("display_name").notNull(),
  country: text("country"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  // Billing (synced from Stripe in Phase 5; developers only).
  plan: planTier("plan").notNull().default("free"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  subscriptionStatus: text("subscription_status"),
  planCurrentPeriodEnd: timestamp("plan_current_period_end", { withTimezone: true }),
});

// --- tester_profiles (supply-side details) ----------------------------------
export const testerProfiles = pgTable("tester_profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => profiles.id, { onDelete: "cascade" }),
  genres: text("genres").array().notNull().default(sql`'{}'::text[]`),
  platforms: text("platforms").array().notNull().default(sql`'{}'::text[]`),
  languages: text("languages").array().notNull().default(sql`'{}'::text[]`),
  experienceLevel: experienceLevel("experience_level").notNull().default("new"),
  reputationScore: integer("reputation_score").notNull().default(0),
  testsCompleted: integer("tests_completed").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
});

// --- projects (a build a dev wants tested) ----------------------------------
export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    developerId: uuid("developer_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull(),
    platform: text("platform").notNull(),
    buildUrl: text("build_url"),
    buildFilePath: text("build_file_path"),
    targetGenres: text("target_genres").array().notNull().default(sql`'{}'::text[]`),
    targetPlatforms: text("target_platforms").array().notNull().default(sql`'{}'::text[]`),
    targetCountries: text("target_countries").array().notNull().default(sql`'{}'::text[]`),
    feedbackQuestions: jsonb("feedback_questions")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    status: projectStatus("status").notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byDeveloper: index("idx_projects_developer").on(t.developerId, t.createdAt),
    byStatus: index("idx_projects_status").on(t.status),
  })
);

// --- test_invites ------------------------------------------------------------
export const testInvites = pgTable(
  "test_invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    testerId: uuid("tester_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    status: inviteStatus("status").notNull().default("invited"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqInvite: uniqueIndex("uniq_invite_project_tester").on(t.projectId, t.testerId),
    byTester: index("idx_invites_tester").on(t.testerId, t.status),
  })
);

// --- feedback (structured tester response) ----------------------------------
export const feedback = pgTable(
  "feedback",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    testerId: uuid("tester_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    bugsFound: text("bugs_found"),
    funRating: integer("fun_rating").notNull(),
    whereDidYouDropOff: text("where_did_you_drop_off"),
    wouldYouPay: boolean("would_you_pay"),
    generalComments: text("general_comments"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqFeedback: uniqueIndex("uniq_feedback_project_tester").on(t.projectId, t.testerId),
    byProject: index("idx_feedback_project").on(t.projectId),
    funRange: check("feedback_fun_rating_range", sql`${t.funRating} between 1 and 5`),
  })
);

// --- ratings (dev rates the tester's feedback quality) ----------------------
export const ratings = pgTable(
  "ratings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    feedbackId: uuid("feedback_id")
      .notNull()
      .unique()
      .references(() => feedback.id, { onDelete: "cascade" }),
    developerId: uuid("developer_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    stars: integer("stars").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    starsRange: check("ratings_stars_range", sql`${t.stars} between 1 and 5`),
  })
);
