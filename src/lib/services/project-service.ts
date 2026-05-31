/**
 * Project service — developer-side reads/writes (MongoDB).
 *
 * Authorization is service-layer: every function takes the authenticated
 * developerId and scopes queries to it.
 */
import { randomUUID } from "node:crypto";
import { collections } from "@/db/collections";
import { withMongo } from "@/lib/wrappers/mongo";
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
  const id = randomUUID();
  await withMongo("project.create", () =>
    collections.projects().insertOne({
      _id: id,
      developerId,
      title: input.title,
      description: input.description,
      platform: input.platform,
      buildUrl: input.buildUrl ?? null,
      buildFilePath: null,
      targetGenres: input.targetGenres,
      targetPlatforms: input.targetPlatforms,
      targetCountries: input.targetCountries,
      feedbackQuestions: input.feedbackQuestions,
      status: "open",
      createdAt: new Date(),
    })
  );
  return { id };
}

export async function listProjectsForDeveloper(
  developerId: string
): Promise<ProjectListItem[]> {
  const rows = await withMongo("project.list", () =>
    collections
      .projects()
      .aggregate<{
        _id: string;
        title: string;
        status: "open" | "closed";
        createdAt: Date;
        feedbackCount: number;
      }>([
        { $match: { developerId } },
        { $sort: { createdAt: -1 } },
        {
          $lookup: {
            from: "feedback",
            localField: "_id",
            foreignField: "projectId",
            as: "fb",
          },
        },
        {
          $project: {
            title: 1,
            status: 1,
            createdAt: 1,
            feedbackCount: { $size: "$fb" },
          },
        },
      ])
      .toArray()
  );
  return rows.map((r) => ({
    id: r._id,
    title: r.title,
    status: r.status,
    createdAt: r.createdAt,
    feedbackCount: r.feedbackCount,
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
  const p = await withMongo("project.get", () =>
    collections.projects().findOne({ _id: projectId, developerId })
  );
  if (!p) throw new AppError({ category: "not_found", message: "project not found" });

  const responses = await withMongo("project.feedback", () =>
    collections.feedback().find({ projectId }).sort({ createdAt: -1 }).toArray()
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
    id: p._id,
    title: p.title,
    description: p.description,
    platform: p.platform,
    buildUrl: p.buildUrl,
    status: p.status,
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
        id: r._id,
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
  const res = await withMongo("project.setStatus", () =>
    collections.projects().updateOne({ _id: projectId, developerId }, { $set: { status } })
  );
  if (res.matchedCount === 0) {
    throw new AppError({ category: "not_found", message: "project not found" });
  }
}
