/**
 * Layer 10 — auth cookies + request authentication.
 *
 * Access/refresh tokens live in httpOnly, sameSite=lax, secure-in-prod cookies.
 * `getAuth` reads + verifies the access token from the cookie (or an
 * Authorization: Bearer header) and returns the authenticated principal.
 */
import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/config/env";
import { setContextUser } from "@/lib/observability/request-context";
import { verifyAccess, type Role } from "./tokens";

export const ACCESS_COOKIE = "ptp_access";
export const REFRESH_COOKIE = "ptp_refresh";

export interface Principal {
  userId: string;
  role: Role;
}

const secure = env.NODE_ENV === "production";

export function setAuthCookies(res: NextResponse, accessToken: string, refreshToken: string): void {
  res.cookies.set(ACCESS_COOKIE, accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: env.AUTH_ACCESS_TTL_SECONDS,
  });
  res.cookies.set(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: env.AUTH_REFRESH_TTL_SECONDS,
  });
}

export function clearAuthCookies(res: NextResponse): void {
  res.cookies.delete(ACCESS_COOKIE);
  res.cookies.delete(REFRESH_COOKIE);
}

/** Returns the authenticated principal, or null if unauthenticated. */
export async function getAuth(req: NextRequest): Promise<Principal | null> {
  const bearer = req.headers.get("authorization");
  const token =
    req.cookies.get(ACCESS_COOKIE)?.value ??
    (bearer?.startsWith("Bearer ") ? bearer.slice(7) : undefined);
  if (!token) return null;
  try {
    const claims = await verifyAccess(token);
    setContextUser(claims.sub);
    return { userId: claims.sub, role: claims.role };
  } catch {
    return null;
  }
}
