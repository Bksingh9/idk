/**
 * Layer 10 — app session tokens (the Better-Auth-style half of "both").
 *
 * After identity is verified via Supabase Auth, the app mints its OWN tokens:
 *  - a short-lived access JWT (carries userId + role for RBAC)
 *  - a longer-lived refresh JWT (used to rotate access tokens)
 * Both are signed with AUTH_JWT_SECRET (server-only). jose is the only JWT lib
 * touched here (rule 1). Secrets never reach the client (rule 3) — tokens live
 * in httpOnly cookies.
 */
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { env } from "@/lib/config/env";
import { AppError } from "@/lib/errors";

export type Role = "developer" | "tester" | "admin";

export interface AccessClaims {
  sub: string; // userId
  role: Role;
  typ: "access";
}
export interface RefreshClaims {
  sub: string;
  role: Role;
  typ: "refresh";
}

const secret = new TextEncoder().encode(env.AUTH_JWT_SECRET);
const ISSUER = "playtestpool";

async function sign(payload: JWTPayload, ttlSeconds: number): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(secret);
}

export async function issueTokens(
  userId: string,
  role: Role
): Promise<{ accessToken: string; refreshToken: string }> {
  const accessToken = await sign({ sub: userId, role, typ: "access" }, env.AUTH_ACCESS_TTL_SECONDS);
  const refreshToken = await sign(
    { sub: userId, role, typ: "refresh" },
    env.AUTH_REFRESH_TTL_SECONDS
  );
  return { accessToken, refreshToken };
}

async function verify(token: string): Promise<JWTPayload> {
  try {
    const { payload } = await jwtVerify(token, secret, { issuer: ISSUER });
    return payload;
  } catch {
    throw new AppError({ category: "unauthorized", message: "invalid or expired token" });
  }
}

export async function verifyAccess(token: string): Promise<AccessClaims> {
  const p = await verify(token);
  if (p.typ !== "access") throw new AppError({ category: "unauthorized", message: "not an access token" });
  return { sub: p.sub as string, role: p.role as Role, typ: "access" };
}

export async function verifyRefresh(token: string): Promise<RefreshClaims> {
  const p = await verify(token);
  if (p.typ !== "refresh")
    throw new AppError({ category: "unauthorized", message: "not a refresh token" });
  return { sub: p.sub as string, role: p.role as Role, typ: "refresh" };
}
