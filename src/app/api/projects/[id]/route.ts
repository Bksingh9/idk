/**
 * Phase 2 — update a project's status (open/closed). Developer only, own
 * projects only.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { route } from "@/lib/http/handler";
import { requireRole } from "@/lib/auth/guard";
import { AppError } from "@/lib/errors";
import { setProjectStatus } from "@/lib/services/project-service";

export const dynamic = "force-dynamic";

const PatchSchema = z.object({ status: z.enum(["open", "closed"]) });

export const PATCH = route("/api/projects/[id]", async (req: NextRequest, ctx) => {
  const dev = await requireRole(req, "developer");
  const { id } = await ctx.params;
  const projectId = Array.isArray(id) ? id[0] : id;

  const parsed = PatchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    throw new AppError({ category: "validation", message: "status must be open or closed" });
  }

  await setProjectStatus(dev.userId, projectId, parsed.data.status);
  return NextResponse.json({ id: projectId, status: parsed.data.status });
});
