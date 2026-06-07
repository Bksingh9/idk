/**
 * Layer 10 — route protection + RBAC.
 *
 * `requireAuth` rejects unauthenticated requests (401). `requireRole` enforces
 * role-based access (403). Both throw normalized AppErrors that the route
 * handler renders as clean JSON responses.
 */
import { NextRequest } from "next/server";
import { AppError } from "@/lib/errors";
import { getAuth, type Principal } from "./session";
import type { Role } from "./tokens";

export async function requireAuth(req: NextRequest): Promise<Principal> {
  const principal = await getAuth(req);
  if (!principal) {
    throw new AppError({ category: "unauthorized", message: "authentication required" });
  }
  return principal;
}

export async function requireRole(req: NextRequest, ...roles: Role[]): Promise<Principal> {
  const principal = await requireAuth(req);
  // 'admin' is a superuser for RBAC purposes.
  if (principal.role !== "admin" && !roles.includes(principal.role)) {
    throw new AppError({
      category: "forbidden",
      message: `requires role: ${roles.join(" or ")}`,
    });
  }
  return principal;
}

/** Operator-only: gated by the ADMIN_EMAILS allowlist (see admin-service). */
export async function requireAdmin(req: NextRequest): Promise<Principal> {
  const principal = await requireAuth(req);
  const { isAdmin } = await import("@/lib/services/admin-service");
  if (!(await isAdmin(principal.userId))) {
    throw new AppError({ category: "forbidden", message: "admin access required" });
  }
  return principal;
}
