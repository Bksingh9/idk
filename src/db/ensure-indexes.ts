/**
 * Index setup — the Mongo equivalent of migrations for this app. Idempotent;
 * safe to run repeatedly. Enforces the integrity rules the relational schema
 * used to (unique email, one invite/feedback per tester+project, one rating per
 * feedback) plus the indexes the queries rely on.
 *
 *   pnpm db:indexes
 */
import { collections } from "@/db/collections";
import { withMongo } from "@/lib/wrappers/mongo";
import { log } from "@/lib/observability/logger";

const logger = log("mongo");

export async function ensureIndexes(): Promise<void> {
  await withMongo("ensureIndexes", async () => {
    await collections.users().createIndex({ email: 1 }, { unique: true });

    await collections.projects().createIndex({ developerId: 1, createdAt: -1 });
    await collections.projects().createIndex({ status: 1 });
    // Array fields for matching (multikey indexes).
    await collections.projects().createIndex({ targetGenres: 1 });
    await collections.projects().createIndex({ targetPlatforms: 1 });

    await collections
      .testInvites()
      .createIndex({ projectId: 1, testerId: 1 }, { unique: true });
    await collections.testInvites().createIndex({ testerId: 1, status: 1 });

    await collections
      .feedback()
      .createIndex({ projectId: 1, testerId: 1 }, { unique: true });
    await collections.feedback().createIndex({ projectId: 1 });

    await collections.ratings().createIndex({ feedbackId: 1 }, { unique: true });

    await collections.testerProfiles().createIndex({ isActive: 1 });
    await collections.testerProfiles().createIndex({ genres: 1 });

    await collections.conversationMessages().createIndex({ sessionId: 1, createdAt: 1 });
    await collections.usageEvents().createIndex({ dependency: 1, createdAt: -1 });
  });
  logger.info("indexes ensured");
}

// Allow running as a script.
if (process.argv[1] && process.argv[1].endsWith("ensure-indexes.ts")) {
  ensureIndexes()
    .then(async () => {
      const { disconnectMongo } = await import("@/lib/wrappers/mongo");
      await disconnectMongo();
      // eslint-disable-next-line no-console
      console.log("✓ indexes ensured");
      process.exit(0);
    })
    .catch((e) => {
      // eslint-disable-next-line no-console
      console.error("index setup failed:", e);
      process.exit(1);
    });
}
