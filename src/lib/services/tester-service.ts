/**
 * Phase 3 — tester side. All reads/writes scoped to the authenticated testerId.
 */
import { randomUUID } from "node:crypto";
import { collections, type InviteStatus } from "@/db/collections";
import { withMongo } from "@/lib/wrappers/mongo";
import { AppError } from "@/lib/errors";

export interface InviteView {
  inviteId: string;
  projectId: string;
  title: string;
  platform: string;
  status: InviteStatus;
}

export interface AcceptedProjectView extends InviteView {
  feedbackSubmitted: boolean;
}

async function withProjects<T extends { projectId: string }>(
  rows: T[]
): Promise<(T & { title: string; platform: string })[]> {
  if (rows.length === 0) return [];
  const ids = [...new Set(rows.map((r) => r.projectId))];
  const projects = await withMongo("tester.projects", () =>
    collections
      .projects()
      .find({ _id: { $in: ids } })
      .project<{ _id: string; title: string; platform: string }>({ title: 1, platform: 1 })
      .toArray()
  );
  const byId = new Map(projects.map((p) => [p._id, p]));
  return rows.map((r) => ({
    ...r,
    title: byId.get(r.projectId)?.title ?? "(removed project)",
    platform: byId.get(r.projectId)?.platform ?? "—",
  }));
}

/** Pending invitations (status 'invited'). */
export async function listInvites(testerId: string): Promise<InviteView[]> {
  const invites = await withMongo("tester.listInvites", () =>
    collections.testInvites().find({ testerId, status: "invited" }).sort({ createdAt: -1 }).toArray()
  );
  const enriched = await withProjects(
    invites.map((i) => ({ inviteId: i._id, projectId: i.projectId, status: i.status }))
  );
  return enriched.map((e) => ({
    inviteId: e.inviteId,
    projectId: e.projectId,
    status: e.status,
    title: e.title,
    platform: e.platform,
  }));
}

/** Projects the tester accepted (status 'accepted'|'completed'), with whether
 *  they've already submitted feedback. */
export async function listAccepted(testerId: string): Promise<AcceptedProjectView[]> {
  const invites = await withMongo("tester.listAccepted", () =>
    collections
      .testInvites()
      .find({ testerId, status: { $in: ["accepted", "completed"] } })
      .sort({ createdAt: -1 })
      .toArray()
  );
  const enriched = await withProjects(
    invites.map((i) => ({ inviteId: i._id, projectId: i.projectId, status: i.status }))
  );
  const submitted = await withMongo("tester.submittedSet", () =>
    collections
      .feedback()
      .find({ testerId, projectId: { $in: enriched.map((e) => e.projectId) } })
      .project<{ projectId: string }>({ projectId: 1 })
      .toArray()
  );
  const submittedSet = new Set(submitted.map((s) => s.projectId));
  return enriched.map((e) => ({
    inviteId: e.inviteId,
    projectId: e.projectId,
    status: e.status,
    title: e.title,
    platform: e.platform,
    feedbackSubmitted: submittedSet.has(e.projectId),
  }));
}

export async function respondToInvite(
  testerId: string,
  inviteId: string,
  action: "accept" | "decline"
): Promise<void> {
  const status = action === "accept" ? "accepted" : "declined";
  const res = await withMongo("tester.respondInvite", () =>
    collections
      .testInvites()
      .updateOne({ _id: inviteId, testerId, status: "invited" }, { $set: { status } })
  );
  if (res.matchedCount === 0) {
    throw new AppError({ category: "not_found", message: "invite not found or already responded" });
  }
}

interface TesterTags {
  genres: string[];
  platforms: string[];
  country: string | null;
}

async function getTesterTags(testerId: string): Promise<TesterTags> {
  const [tp, profile] = await Promise.all([
    withMongo("tester.tags", () => collections.testerProfiles().findOne({ _id: testerId })),
    withMongo("tester.profile", () => collections.profiles().findOne({ _id: testerId })),
  ]);
  return {
    genres: tp?.genres ?? [],
    platforms: tp?.platforms ?? [],
    country: profile?.country ?? null,
  };
}

export interface BrowseableProject {
  id: string;
  title: string;
  platform: string;
  targetGenres: string[];
  targetPlatforms: string[];
}

/** Open projects matching the tester's tags that they have no invite for yet. */
export async function listBrowseable(testerId: string): Promise<BrowseableProject[]> {
  const tags = await getTesterTags(testerId);

  const overlap = (field: string, values: string[]) => ({
    $or: [{ [field]: { $size: 0 } }, { [field]: { $in: values } }],
  });
  const filter: Record<string, unknown> = {
    status: "open",
    $and: [
      overlap("targetGenres", tags.genres),
      overlap("targetPlatforms", tags.platforms),
      {
        $or: [
          { targetCountries: { $size: 0 } },
          ...(tags.country ? [{ targetCountries: tags.country }] : []),
        ],
      },
    ],
  };

  const existing = await withMongo("tester.existingInvites", () =>
    collections.testInvites().find({ testerId }).project<{ projectId: string }>({ projectId: 1 }).toArray()
  );
  const excluded = existing.map((e) => e.projectId);
  if (excluded.length) filter._id = { $nin: excluded };

  const projects = await withMongo("tester.browse", () =>
    collections.projects().find(filter).sort({ createdAt: -1 }).limit(50).toArray()
  );
  return projects.map((p) => ({
    id: p._id,
    title: p.title,
    platform: p.platform,
    targetGenres: p.targetGenres,
    targetPlatforms: p.targetPlatforms,
  }));
}

/** Tester opts into an open project (creates an 'accepted' invite). */
export async function optIn(testerId: string, projectId: string): Promise<void> {
  const project = await withMongo("tester.optInProject", () =>
    collections.projects().findOne({ _id: projectId, status: "open" })
  );
  if (!project) throw new AppError({ category: "not_found", message: "open project not found" });

  try {
    await withMongo("tester.optIn", () =>
      collections.testInvites().insertOne({
        _id: randomUUID(),
        projectId,
        testerId,
        status: "accepted",
        createdAt: new Date(),
      })
    );
  } catch (e) {
    if ((e as { code?: number }).code === 11000) {
      throw new AppError({ category: "conflict", message: "you already have an invite for this project" });
    }
    throw e;
  }
}
