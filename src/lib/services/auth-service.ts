/**
 * Auth service — account creation and credential verification (MongoDB).
 *
 * Standalone Mongo has no multi-document transactions, so creation is
 * sequential; the unique index on users.email is the source of truth against
 * duplicates (a racing insert throws 11000, mapped to a conflict).
 */
import { randomUUID } from "node:crypto";
import { collections } from "@/db/collections";
import { withMongo } from "@/lib/wrappers/mongo";
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

function isDuplicateKey(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: number }).code === 11000;
}

export async function signup(input: SignupInput): Promise<Identity> {
  const email = input.email.trim().toLowerCase();
  const userId = randomUUID();
  const passwordHash = await hashPassword(input.password);
  const now = new Date();

  try {
    await withMongo("auth.createUser", () =>
      collections.users().insertOne({ _id: userId, email, passwordHash, createdAt: now })
    );
  } catch (e) {
    if (isDuplicateKey(e)) {
      throw new AppError({ category: "conflict", message: "an account with this email already exists" });
    }
    throw e;
  }

  await withMongo("auth.createProfile", () =>
    collections.profiles().insertOne({
      _id: userId,
      role: input.role,
      displayName: input.displayName,
      country: input.country ?? null,
      createdAt: now,
      plan: "free",
    })
  );

  if (input.role === "tester") {
    const t = input.tester;
    await withMongo("auth.createTesterProfile", () =>
      collections.testerProfiles().insertOne({
        _id: userId,
        genres: t?.genres ?? [],
        platforms: t?.platforms ?? [],
        languages: t?.languages ?? [],
        experienceLevel: t?.experienceLevel ?? "new",
        reputationScore: 0,
        testsCompleted: 0,
        isActive: true,
      })
    );
  }

  return { userId, role: input.role, displayName: input.displayName };
}

export async function login(email: string, password: string): Promise<Identity> {
  const normalized = email.trim().toLowerCase();
  const user = await withMongo("auth.findUser", () =>
    collections.users().findOne({ email: normalized })
  );

  // Verify a hash even when the user is missing, to blunt user enumeration.
  const ok = user
    ? await verifyPassword(password, user.passwordHash)
    : await verifyPassword(password, "scrypt$00$00").then(() => false);

  if (!user || !ok) {
    throw new AppError({ category: "unauthorized", message: "invalid email or password" });
  }

  const profile = await withMongo("auth.findProfile", () =>
    collections.profiles().findOne({ _id: user._id })
  );
  if (!profile) {
    throw new AppError({ category: "internal", message: "profile missing for user" });
  }

  return { userId: user._id, role: profile.role, displayName: profile.displayName };
}
