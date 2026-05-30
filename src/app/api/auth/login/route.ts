/**
 * Layer 10 — login. Verifies identity via Supabase Auth, then mints the app's
 * own access + refresh tokens (role comes from the user's profile; defaults to
 * 'tester' until the profiles table exists in Phase 1). Sets httpOnly cookies.
 *
 * Requires real Supabase keys to fully exercise. For proving the protected-route
 * gate without live Supabase, see /api/auth/dev-login (development only).
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { route } from "@/lib/http/handler";
import { enforceCustomLimit } from "@/lib/http/rate-limit";
import { AppError } from "@/lib/errors";
import { signInWithPassword } from "@/lib/wrappers/supabase";
import { issueTokens } from "@/lib/auth/tokens";
import { setAuthCookies } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const POST = route("/api/auth/login", async (req: NextRequest) => {
  // Tight limit on auth endpoints to blunt credential stuffing.
  await enforceCustomLimit(req, "login", 10);

  const parsed = LoginSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    throw new AppError({ category: "validation", message: "email and password (min 8) required" });
  }

  const identity = await signInWithPassword(parsed.data.email, parsed.data.password);
  // Role will be looked up from the profiles table in Phase 1.
  const { accessToken, refreshToken } = await issueTokens(identity.userId, "tester");

  const res = NextResponse.json({ userId: identity.userId, email: identity.email });
  setAuthCookies(res, accessToken, refreshToken);
  return res;
});
