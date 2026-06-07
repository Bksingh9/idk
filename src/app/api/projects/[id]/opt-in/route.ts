/**
 * Phase 3 — tester opts into an open, eligible project.
 */
import { NextRequest, NextResponse } from "next/server";
import { route } from "@/lib/http/handler";
import { requireRole } from "@/lib/auth/guard";
import { optIn } from "@/lib/services/tester-service";

export const dynamic = "force-dynamic";

export const POST = route("/api/projects/[id]/opt-in", async (req: NextRequest, ctx) => {
  const tester = await requireRole(req, "tester");
  const { id } = await ctx.params;
  const projectId = Array.isArray(id) ? id[0] : id;
  await optIn(tester.userId, projectId);
  return NextResponse.json({ projectId, status: "accepted" }, { status: 201 });
});
