/**
 * Auth service — account creation and credential verification.
 *
 * Owns the transactional creation of users + profiles (+ tester_profiles for
 * testers). Authorization elsewhere is enforced in the service layer, so these
 * functions are the single entry point for identity.
 */
import { eq } from "drizzle-orm";
import { db, withDb } from "@/lib/wrappers/postgres";
import { users, profiles, testerProfiles } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { AppError } from "@/lib/errors";

export type SignupRole = "developer" | "tester";

export interface TesterDetails {
  genres: string[];
  platforms: string[];
  languages: string[];
  experienceLevel: "new" | "casual" | "experienced" | "pro";
}

export interface SignupInput {
  email: string;
  password: string;
  role: SignupRole;
  displayName: string;
  country?: string;
  tester?: TesterDetails;
}

export interface Identity {
  userId: string;
  role: SignupRole;
  displayName: string;
}

export async function signup(input: SignupInput): Promise<Identity> {
  const email = input.email.trim().toLowerCase();

  const existing = await withDb("auth.findUser", () =>
    db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1)
  );
  if (existing.length > 0) {
    throw new AppError({ category: "conflict", message: "an account with this email already exists" });
  }

  const passwordHash = await hashPassword(input.password);

  const identity = await withDb("auth.signup", () =>
    db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({ email, passwordHash })
        .returning({ id: users.id });

      await tx.insert(profiles).values({
        id: user.id,
        role: input.role,
        displayName: input.displayName,
        country: input.country ?? null,
      });

      if (input.role === "tester") {
        const t = input.tester;
        await tx.insert(testerProfiles).values({
          userId: user.id,
          genres: t?.genres ?? [],
          platforms: t?.platforms ?? [],
          languages: t?.languages ?? [],
          experienceLevel: t?.experienceLevel ?? "new",
        });
      }

      return { userId: user.id, role: input.role, displayName: input.displayName };
    })
  );

  return identity;
}

export async function login(email: string, password: string): Promise<Identity> {
  const normalized = email.trim().toLowerCase();
  const rows = await withDb("auth.login", () =>
    db
      .select({
        id: users.id,
        passwordHash: users.passwordHash,
        role: profiles.role,
        displayName: profiles.displayName,
      })
      .from(users)
      .innerJoin(profiles, eq(profiles.id, users.id))
      .where(eq(users.email, normalized))
      .limit(1)
  );

  const row = rows[0];
  // Verify a hash even when the user is missing, to avoid timing/user enumeration.
  const ok = row
    ? await verifyPassword(password, row.passwordHash)
    : await verifyPassword(password, "scrypt$00$00").then(() => false);

  if (!row || !ok) {
    throw new AppError({ category: "unauthorized", message: "invalid email or password" });
  }
  return { userId: row.id, role: row.role as SignupRole, displayName: row.displayName };
}
