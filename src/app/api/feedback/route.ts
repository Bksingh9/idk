/**
 * Phase 4 — tester submits structured feedback for an accepted project.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { route } from "@/lib/http/handler";
import { requireRole } from "@/lib/auth/guard";
import { AppError } from "@/lib/errors";
import { submitFeedback } from "@/lib/services/feedback-service";

export const dynamic = "force-dynamic";

const Schema = z.object({
  projectId: z.string().min(1),
  bugsFound: z.string().max(5000).optional(),
  funRating: z.number().int().min(1).max(5),
  whereDidYouDropOff: z.string().max(2000).optional(),
  wouldYouPay: z.boolean().optional(),
  generalComments: z.string().max(5000).optional(),
});

export const POST = route("/api/feedback", async (req: NextRequest) => {
  const tester = await requireRole(req, "tester");
  const parsed = Schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    throw new AppError({
      category: "validation",
      message: parsed.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; "),
    });
  }
  const { id } = await submitFeedback(tester.userId, parsed.data);
  return NextResponse.json({ id }, { status: 201 });
});
