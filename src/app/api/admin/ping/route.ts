/**
 * Layer 10 proof — RBAC. Only 'developer' (or 'admin' superuser) may access.
 * A 'tester' token → 403; a 'developer'/'admin' token → 200.
 */
import { NextRequest, NextResponse } from "next/server";
import { route } from "@/lib/http/handler";
import { requireRole } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

export const GET = route("/api/admin/ping", async (req: NextRequest) => {
  const principal = await requireRole(req, "developer");
  return NextResponse.json({ ok: true, role: principal.role });
});
