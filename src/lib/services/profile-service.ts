/**
 * Profile service — read helpers for the current user's profile data.
 * Service-layer authorization: callers pass the authenticated userId; queries
 * never return another user's private data.
 */
import { eq } from "drizzle-orm";
import { db, withDb } from "@/lib/wrappers/postgres";
import { profiles, testerProfiles } from "@/db/schema";

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
  const rows = await withDb("profile.get", () =>
    db.select().from(profiles).where(eq(profiles.id, userId)).limit(1)
  );
  const p = rows[0];
  if (!p) return null;

  const full: FullProfile = {
    id: p.id,
    role: p.role as "developer" | "tester",
    displayName: p.displayName,
    country: p.country,
    plan: p.plan as "free" | "indie" | "studio",
  };

  if (p.role === "tester") {
    const t = (
      await withDb("profile.getTester", () =>
        db.select().from(testerProfiles).where(eq(testerProfiles.userId, userId)).limit(1)
      )
    )[0];
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
