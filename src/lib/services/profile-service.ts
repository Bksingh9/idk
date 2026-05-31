/**
 * Profile service (MongoDB). Service-layer authorization: callers pass the
 * authenticated userId; queries never return another user's private data.
 */
import { collections } from "@/db/collections";
import { withMongo } from "@/lib/wrappers/mongo";

export interface FullProfile {
  id: string;
  role: "developer" | "tester";
  displayName: string;
  country: string | null;
  plan: "free" | "indie" | "studio";
  tester?: {
    genres: string[];
    platforms: string[];
    languages: string[];
    experienceLevel: string;
    reputationScore: number;
    testsCompleted: number;
    isActive: boolean;
  };
}

export async function getProfile(userId: string): Promise<FullProfile | null> {
  const p = await withMongo("profile.get", () =>
    collections.profiles().findOne({ _id: userId })
  );
  if (!p) return null;

  const full: FullProfile = {
    id: p._id,
    role: p.role,
    displayName: p.displayName,
    country: p.country,
    plan: p.plan,
  };

  if (p.role === "tester") {
    const t = await withMongo("profile.getTester", () =>
      collections.testerProfiles().findOne({ _id: userId })
    );
    if (t) {
      full.tester = {
        genres: t.genres,
        platforms: t.platforms,
        languages: t.languages,
        experienceLevel: t.experienceLevel,
        reputationScore: t.reputationScore,
        testsCompleted: t.testsCompleted,
        isActive: t.isActive,
      };
    }
  }
  return full;
}
