/**
 * Layer 10 — DEVELOPMENT-ONLY login. Issues app tokens for a chosen role
 * WITHOUT Supabase, so the protected-route gate can be proven end-to-end before
 * real Supabase keys are configured. Hard-disabled when NODE_ENV=production.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { route } from "@/lib/http/handler";
import { env } from "@/lib/config/env";
import { AppError } from "@/lib/errors";
import { issueTokens, type Role } from "@/lib/auth/tokens";
import { setAuthCookies } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const Schema = z.object({
  userId: z.string().min(1).default("dev-user"),
  role: z.enum(["developer", "tester", "admin"]).default("tester"),
});

export const POST = route("/api/auth/dev-login", async (req: NextRequest) => {
  if (env.NODE_ENV === "production") {
    throw new AppError({ category: "not_found", message: "not available" });
  }
  const parsed = Schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) throw new AppError({ category: "validation", message: "invalid body" });

  const { accessToken, refreshToken } = await issueTokens(
    parsed.data.userId,
    parsed.data.role as Role
  );
  const res = NextResponse.json({ userId: parsed.data.userId, role: parsed.data.role });
  setAuthCookies(res, accessToken, refreshToken);
  return res;
});
