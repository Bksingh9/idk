/**
 * Server-component auth helper. Reads + verifies the access token from cookies
 * (Next 15 `cookies()` is async). Returns the principal or null. Use in server
 * components / layouts to gate pages and redirect by role.
 */
import { cookies } from "next/headers";
import { verifyAccess, type Role } from "./tokens";
import { ACCESS_COOKIE } from "./session";

export interface ServerSession {
  userId: string;
  role: Role;
}

export async function getSession(): Promise<ServerSession | null> {
  const store = await cookies();
  const token = store.get(ACCESS_COOKIE)?.value;
  if (!token) return null;
  try {
    const claims = await verifyAccess(token);
    return { userId: claims.sub, role: claims.role };
  } catch {
    return null;
  }
}
