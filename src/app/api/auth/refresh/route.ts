/**
 * Layer 10 — refresh-token rotation. Exchanges a valid refresh cookie for a new
 * access (and refresh) token pair.
 */
import { NextRequest, NextResponse } from "next/server";
import { route } from "@/lib/http/handler";
import { AppError } from "@/lib/errors";
import { verifyRefresh, issueTokens } from "@/lib/auth/tokens";
import { REFRESH_COOKIE, setAuthCookies } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export const POST = route("/api/auth/refresh", async (req: NextRequest) => {
  const token = req.cookies.get(REFRESH_COOKIE)?.value;
  if (!token) throw new AppError({ category: "unauthorized", message: "no refresh token" });
  const claims = await verifyRefresh(token);
  const { accessToken, refreshToken } = await issueTokens(claims.sub, claims.role);
  const res = NextResponse.json({ refreshed: true });
  setAuthCookies(res, accessToken, refreshToken);
  return res;
});
