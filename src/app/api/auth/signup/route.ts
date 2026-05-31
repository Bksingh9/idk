/**
 * Phase 1 — signup. Role is chosen first; testers supply genres/platforms/
 * languages/experience, developers just need a display name + country. Creates
 * the account, issues tokens, sets cookies.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { route } from "@/lib/http/handler";
import { enforceCustomLimit } from "@/lib/http/rate-limit";
import { AppError } from "@/lib/errors";
import { signup } from "@/lib/services/auth-service";
import { issueTokens } from "@/lib/auth/tokens";
import { setAuthCookies } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const TesterDetails = z.object({
  genres: z.array(z.string().min(1)).max(20).default([]),
  platforms: z.array(z.string().min(1)).max(20).default([]),
  languages: z.array(z.string().min(1)).max(20).default([]),
  experienceLevel: z.enum(["new", "casual", "experienced", "pro"]).default("new"),
});

const SignupSchema = z.discriminatedUnion("role", [
  z.object({
    role: z.literal("developer"),
    email: z.string().email(),
    password: z.string().min(8, "password must be at least 8 characters"),
    displayName: z.string().min(1).max(80),
    country: z.string().max(80).optional(),
  }),
  z.object({
    role: z.literal("tester"),
    email: z.string().email(),
    password: z.string().min(8, "password must be at least 8 characters"),
    displayName: z.string().min(1).max(80),
    country: z.string().max(80).optional(),
    tester: TesterDetails,
  }),
]);

export const POST = route("/api/auth/signup", async (req: NextRequest) => {
  await enforceCustomLimit(req, "signup", 10);

  const parsed = SignupSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    throw new AppError({
      category: "validation",
      message: parsed.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; "),
    });
  }

  const data = parsed.data;
  const identity = await signup({
    email: data.email,
    password: data.password,
    role: data.role,
    displayName: data.displayName,
    country: data.country,
    tester: data.role === "tester" ? data.tester : undefined,
  });

  const { accessToken, refreshToken } = await issueTokens(identity.userId, identity.role);
  const res = NextResponse.json({ userId: identity.userId, role: identity.role });
  setAuthCookies(res, accessToken, refreshToken);
  return res;
});
