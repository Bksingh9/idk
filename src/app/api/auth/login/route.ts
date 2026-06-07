/**
 * Phase 1 — login. Verifies credentials against our users table, then mints app
 * access + refresh tokens carrying the role for RBAC. Sets httpOnly cookies.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { route } from "@/lib/http/handler";
import { enforceCustomLimit } from "@/lib/http/rate-limit";
import { AppError } from "@/lib/errors";
import { login } from "@/lib/services/auth-service";
import { issueTokens } from "@/lib/auth/tokens";
import { setAuthCookies } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const POST = route("/api/auth/login", async (req: NextRequest) => {
  await enforceCustomLimit(req, "login", 10);

  const parsed = LoginSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    throw new AppError({ category: "validation", message: "email and password (min 8) required" });
  }

  const identity = await login(parsed.data.email, parsed.data.password);
  const { accessToken, refreshToken } = await issueTokens(identity.userId, identity.role);

  const res = NextResponse.json({
    userId: identity.userId,
    role: identity.role,
    displayName: identity.displayName,
  });
  setAuthCookies(res, accessToken, refreshToken);
  return res;
});
