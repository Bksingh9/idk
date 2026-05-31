/**
 * Phase 4 — developer rates a feedback's quality (1-5). Adjusts the tester's
 * reputation. Developer only, own projects' feedback only.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { route } from "@/lib/http/handler";
import { requireRole } from "@/lib/auth/guard";
import { AppError } from "@/lib/errors";
import { rateFeedback } from "@/lib/services/feedback-service";

export const dynamic = "force-dynamic";

const Schema = z.object({ stars: z.number().int().min(1).max(5) });

export const POST = route("/api/feedback/[id]/rating", async (req: NextRequest, ctx) => {
  const dev = await requireRole(req, "developer");
  const { id } = await ctx.params;
  const feedbackId = Array.isArray(id) ? id[0] : id;

  const parsed = Schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    throw new AppError({ category: "validation", message: "stars must be an integer 1-5" });
  }
  await rateFeedback(dev.userId, feedbackId, parsed.data.stars);
  return NextResponse.json({ feedbackId, stars: parsed.data.stars });
});
