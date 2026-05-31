/**
 * Phase 4 — feedback loop.
 *
 * Tester submits structured feedback for a project they accepted; on submit we
 * increment tests_completed and bump reputation. The developer rates the
 * feedback's quality (1-5), which adjusts the tester's reputation. Standalone
 * Mongo has no transactions, so writes are sequential and ordered so a failure
 * can't double-count (feedback insert is guarded by a unique index).
 */
import { randomUUID } from "node:crypto";
import { collections } from "@/db/collections";
import { withMongo } from "@/lib/wrappers/mongo";
import { AppError } from "@/lib/errors";

const SUBMIT_REPUTATION = 5; // participation bonus per submitted feedback
const ratingBonus = (stars: number) => (stars - 3) * 2; // -4..+4

export interface SubmitFeedbackInput {
  projectId: string;
  bugsFound?: string;
  funRating: number;
  whereDidYouDropOff?: string;
  wouldYouPay?: boolean;
  generalComments?: string;
}

export async function submitFeedback(
  testerId: string,
  input: SubmitFeedbackInput
): Promise<{ id: string }> {
  // Must have accepted (or already-completed) invite for this project.
  const invite = await withMongo("feedback.invite", () =>
    collections.testInvites().findOne({
      projectId: input.projectId,
      testerId,
      status: { $in: ["accepted", "completed"] },
    })
  );
  if (!invite) {
    throw new AppError({
      category: "forbidden",
      message: "you can only submit feedback for a project you've accepted",
    });
  }

  const id = randomUUID();
  try {
    await withMongo("feedback.insert", () =>
      collections.feedback().insertOne({
        _id: id,
        projectId: input.projectId,
        testerId,
        bugsFound: input.bugsFound ?? null,
        funRating: input.funRating,
        whereDidYouDropOff: input.whereDidYouDropOff ?? null,
        wouldYouPay: input.wouldYouPay ?? null,
        generalComments: input.generalComments ?? null,
        createdAt: new Date(),
      })
    );
  } catch (e) {
    if ((e as { code?: number }).code === 11000) {
      throw new AppError({ category: "conflict", message: "you already submitted feedback for this project" });
    }
    throw e;
  }

  // Reward participation and mark the invite completed.
  await withMongo("feedback.reward", () =>
    collections
      .testerProfiles()
      .updateOne({ _id: testerId }, { $inc: { testsCompleted: 1, reputationScore: SUBMIT_REPUTATION } })
  );
  await withMongo("feedback.completeInvite", () =>
    collections.testInvites().updateOne({ _id: invite._id }, { $set: { status: "completed" } })
  );

  return { id };
}

export async function rateFeedback(
  developerId: string,
  feedbackId: string,
  stars: number
): Promise<void> {
  const fb = await withMongo("rating.feedback", () =>
    collections.feedback().findOne({ _id: feedbackId })
  );
  if (!fb) throw new AppError({ category: "not_found", message: "feedback not found" });

  const project = await withMongo("rating.project", () =>
    collections.projects().findOne({ _id: fb.projectId, developerId })
  );
  if (!project) {
    throw new AppError({ category: "forbidden", message: "you can only rate feedback on your own projects" });
  }

  const existing = await withMongo("rating.existing", () =>
    collections.ratings().findOne({ feedbackId })
  );
  const delta = ratingBonus(stars) - (existing ? ratingBonus(existing.stars) : 0);

  await withMongo("rating.upsert", () =>
    collections.ratings().updateOne(
      { feedbackId },
      {
        $set: { stars },
        $setOnInsert: { _id: randomUUID(), developerId, createdAt: new Date() },
      },
      { upsert: true }
    )
  );

  if (delta !== 0) {
    await withMongo("rating.adjustReputation", () =>
      collections.testerProfiles().updateOne({ _id: fb.testerId }, { $inc: { reputationScore: delta } })
    );
  }
}

/** Project + custom questions for the tester's feedback form (must be accepted). */
export async function getFeedbackContext(
  testerId: string,
  projectId: string
): Promise<{ title: string; description: string; questions: string[]; alreadySubmitted: boolean }> {
  const invite = await withMongo("feedback.ctxInvite", () =>
    collections.testInvites().findOne({ projectId, testerId, status: { $in: ["accepted", "completed"] } })
  );
  if (!invite) throw new AppError({ category: "forbidden", message: "not an accepted project" });

  const project = await withMongo("feedback.ctxProject", () =>
    collections.projects().findOne({ _id: projectId })
  );
  if (!project) throw new AppError({ category: "not_found", message: "project not found" });

  const existing = await withMongo("feedback.ctxExisting", () =>
    collections.feedback().findOne({ projectId, testerId })
  );

  return {
    title: project.title,
    description: project.description,
    questions: project.feedbackQuestions,
    alreadySubmitted: !!existing,
  };
}
