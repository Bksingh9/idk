/**
 * Phase 3 — matching. When a project is posted we find eligible testers by
 * overlapping genre/platform/country tags and create invites (capped). New
 * invitees are notified via the email wrapper (console fallback when no key).
 *
 * Privileged, server-initiated fan-out: this is driven by the project owner's
 * action, not by untrusted tester input.
 */
import { randomUUID } from "node:crypto";
import { collections, type ProjectDoc } from "@/db/collections";
import { withMongo } from "@/lib/wrappers/mongo";
import { email } from "@/lib/wrappers/resend";
import { env } from "@/lib/config/env";
import { log } from "@/lib/observability/logger";

const logger = log("match");
const INVITE_CAP = 20;

/** Find up to `cap` active testers whose tags overlap the project's targets. */
export async function findEligibleTesters(
  project: Pick<ProjectDoc, "targetGenres" | "targetPlatforms" | "targetCountries">,
  cap = INVITE_CAP
): Promise<string[]> {
  const tagMatch: Record<string, unknown> = { isActive: true };
  if (project.targetGenres.length) tagMatch.genres = { $in: project.targetGenres };
  if (project.targetPlatforms.length) tagMatch.platforms = { $in: project.targetPlatforms };

  const pipeline: object[] = [
    { $match: tagMatch },
    { $lookup: { from: "profiles", localField: "_id", foreignField: "_id", as: "profile" } },
    { $unwind: "$profile" },
    { $match: { "profile.role": "tester" } },
  ];
  if (project.targetCountries.length) {
    pipeline.push({ $match: { "profile.country": { $in: project.targetCountries } } });
  }
  pipeline.push({ $limit: cap }, { $project: { _id: 1 } });

  const rows = await withMongo("match.findTesters", () =>
    collections.testerProfiles().aggregate<{ _id: string }>(pipeline).toArray()
  );
  return rows.map((r) => r._id);
}

/**
 * Create 'invited' invites for eligible testers (idempotent via unique index;
 * existing invites are left untouched). Returns the number of NEW invites and
 * notifies those testers.
 */
export async function createInvitesForProject(projectId: string): Promise<{ invited: number }> {
  const project = await withMongo("match.getProject", () =>
    collections.projects().findOne({ _id: projectId })
  );
  if (!project) return { invited: 0 };

  const testerIds = await findEligibleTesters(project);
  if (testerIds.length === 0) return { invited: 0 };

  // Which already have invites? Only notify/insert the new ones.
  const existing = await withMongo("match.existingInvites", () =>
    collections
      .testInvites()
      .find({ projectId, testerId: { $in: testerIds } })
      .project<{ testerId: string }>({ testerId: 1 })
      .toArray()
  );
  const have = new Set(existing.map((e) => e.testerId));
  const fresh = testerIds.filter((id) => !have.has(id));
  if (fresh.length === 0) return { invited: 0 };

  const now = new Date();
  await withMongo("match.insertInvites", () =>
    collections.testInvites().insertMany(
      fresh.map((testerId) => ({
        _id: randomUUID(),
        projectId,
        testerId,
        status: "invited" as const,
        createdAt: now,
      })),
      { ordered: false }
    )
  );

  await notifyInvitees(fresh, project.title, projectId);
  logger.info({ projectId, invited: fresh.length }, "invites created");
  return { invited: fresh.length };
}

async function notifyInvitees(testerIds: string[], projectTitle: string, projectId: string) {
  const users = await withMongo("match.inviteeEmails", () =>
    collections
      .users()
      .find({ _id: { $in: testerIds } })
      .project<{ email: string }>({ email: 1 })
      .toArray()
  );
  const link = `${env.APP_BASE_URL}/dashboard/tester`;
  await Promise.all(
    users.map((u) =>
      email
        .send({
          to: u.email,
          subject: `You're invited to playtest "${projectTitle}"`,
          html: `<p>You've been matched to a new playtest: <strong>${projectTitle}</strong>.</p><p>Open your <a href="${link}">tester dashboard</a> to accept or decline.</p>`,
          text: `You've been matched to a new playtest: ${projectTitle}. Visit ${link} to accept or decline.`,
        })
        .catch((e) => logger.warn({ err: String(e), projectId }, "invite email failed"))
    )
  );
}
