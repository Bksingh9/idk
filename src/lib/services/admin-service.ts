/**
 * Phase 6 — admin (operator-only). Access is gated by the ADMIN_EMAILS
 * allowlist, independent of role. Lets the operator see tester reputation and
 * deactivate flaky testers (soft remove: isActive=false excludes them from
 * matching and browse).
 */
import { collections } from "@/db/collections";
import { withMongo } from "@/lib/wrappers/mongo";
import { env } from "@/lib/config/env";

export async function isAdmin(userId: string): Promise<boolean> {
  if (env.ADMIN_EMAILS.length === 0) return false;
  const user = await withMongo("admin.user", () => collections.users().findOne({ _id: userId }));
  return !!user && env.ADMIN_EMAILS.includes(user.email.toLowerCase());
}

export interface AdminTesterRow {
  id: string;
  displayName: string;
  email: string;
  reputationScore: number;
  testsCompleted: number;
  isActive: boolean;
}

export async function listTesters(): Promise<AdminTesterRow[]> {
  const rows = await withMongo("admin.listTesters", () =>
    collections
      .testerProfiles()
      .aggregate<AdminTesterRow>([
        { $sort: { reputationScore: -1 } },
        { $lookup: { from: "profiles", localField: "_id", foreignField: "_id", as: "p" } },
        { $unwind: "$p" },
        { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "u" } },
        { $unwind: "$u" },
        {
          $project: {
            _id: 0,
            id: "$_id",
            displayName: "$p.displayName",
            email: "$u.email",
            reputationScore: 1,
            testsCompleted: 1,
            isActive: 1,
          },
        },
      ])
      .toArray()
  );
  return rows;
}

export async function setTesterActive(testerId: string, active: boolean): Promise<void> {
  await withMongo("admin.setActive", () =>
    collections.testerProfiles().updateOne({ _id: testerId }, { $set: { isActive: active } })
  );
}
