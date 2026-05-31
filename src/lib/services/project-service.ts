/**
 * Project service — developer-side reads/writes.
 *
 * Authorization is service-layer: every function takes the authenticated
 * developerId and scopes queries to it, so a developer can only ever touch
 * their own projects and the feedback on them.
 */
import { and, desc, eq, sql } from "drizzle-orm";
import { db, withDb } from "@/lib/wrappers/postgres";
import { projects, feedback } from "@/db/schema";
import { AppError } from "@/lib/errors";

export interface CreateProjectInput {
  title: string;
  description: string;
  platform: string;
  buildUrl?: string;
  targetGenres: string[];
  targetPlatforms: string[];
  targetCountries: string[];
  feedbackQuestions: string[];
}

export interface ProjectListItem {
  id: string;
  title: string;
  status: "open" | "closed";
  createdAt: Date;
  feedbackCount: number;
}

export async function createProject(
  developerId: string,
  input: CreateProjectInput
): Promise<{ id: string }> {
  const [row] = await withDb("project.create", () =>
    db
      .insert(projects)
      .values({
        developerId,
        title: input.title,
        description: input.description,
        platform: input.platform,
        buildUrl: input.buildUrl ?? null,
        targetGenres: input.targetGenres,
        targetPlatforms: input.targetPlatforms,
        targetCountries: input.targetCountries,
        feedbackQuestions: input.feedbackQuestions,
      })
      .returning({ id: projects.id })
  );
  return { id: row.id };
}

export async function listProjectsForDeveloper(
  developerId: string
): Promise<ProjectListItem[]> {
  const rows = await withDb("project.list", () =>
    db
      .select({
        id: projects.id,
        title: projects.title,
        status: projects.status,
        createdAt: projects.createdAt,
        feedbackCount: sql<number>`count(${feedback.id})::int`,
      })
      .from(projects)
      .leftJoin(feedback, eq(feedback.projectId, projects.id))
      .where(eq(projects.developerId, developerId))
      .groupBy(projects.id)
      .orderBy(desc(projects.createdAt))
  );
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    status: r.status as "open" | "closed",
    createdAt: r.createdAt,
    feedbackCount: Number(r.feedbackCount),
  }));
}

export interface FeedbackResponse {
  id: string;
  bugsFound: string | null;
  funRating: number;
  whereDidYouDropOff: string | null;
  wouldYouPay: boolean | null;
  generalComments: string | null;
  createdAt: Date;
}

export interface ProjectDetail {
  id: string;
  title: string;
  description: string;
  platform: string;
  buildUrl: string | null;
  status: "open" | "closed";
  targetGenres: string[];
  targetPlatforms: string[];
  targetCountries: string[];
  feedbackQuestions: string[];
  createdAt: Date;
  aggregate: {
    count: number;
    avgFunRating: number | null;
    wouldPayPct: number | null;
    dropOffPoints: string[];
    responses: FeedbackResponse[];
  };
}

/** Project detail + aggregated feedback. Throws not_found if not owned. */
export async function getProjectDetail(
  developerId: string,
  projectId: string
): Promise<ProjectDetail> {
  const [p] = await withDb("project.get", () =>
    db
      .select()
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.developerId, developerId)))
      .limit(1)
  );
  if (!p) throw new AppError({ category: "not_found", message: "project not found" });

  const responses = await withDb("project.feedback", () =>
    db
      .select()
      .from(feedback)
      .where(eq(feedback.projectId, projectId))
      .orderBy(desc(feedback.createdAt))
  );

  const count = responses.length;
  const avgFunRating =
    count > 0 ? responses.reduce((s, r) => s + r.funRating, 0) / count : null;
  const payVotes = responses.filter((r) => r.wouldYouPay !== null);
  const wouldPayPct =
    payVotes.length > 0
      ? (payVotes.filter((r) => r.wouldYouPay).length / payVotes.length) * 100
      : null;
  const dropOffPoints = responses
    .map((r) => r.whereDidYouDropOff?.trim())
    .filter((v): v is string => !!v);

  return {
    id: p.id,
    title: p.title,
    description: p.description,
    platform: p.platform,
    buildUrl: p.buildUrl,
    status: p.status as "open" | "closed",
    targetGenres: p.targetGenres,
    targetPlatforms: p.targetPlatforms,
    targetCountries: p.targetCountries,
    feedbackQuestions: p.feedbackQuestions,
    createdAt: p.createdAt,
    aggregate: {
      count,
      avgFunRating,
      wouldPayPct,
      dropOffPoints,
      responses: responses.map((r) => ({
        id: r.id,
        bugsFound: r.bugsFound,
        funRating: r.funRating,
        whereDidYouDropOff: r.whereDidYouDropOff,
        wouldYouPay: r.wouldYouPay,
        generalComments: r.generalComments,
        createdAt: r.createdAt,
      })),
    },
  };
}

export async function setProjectStatus(
  developerId: string,
  projectId: string,
  status: "open" | "closed"
): Promise<void> {
  const res = await withDb("project.setStatus", () =>
    db
      .update(projects)
      .set({ status })
      .where(and(eq(projects.id, projectId), eq(projects.developerId, developerId)))
      .returning({ id: projects.id })
  );
  if (res.length === 0) throw new AppError({ category: "not_found", message: "project not found" });
}
