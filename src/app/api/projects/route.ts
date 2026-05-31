/**
 * Phase 2 — create a project (developer only).
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { route } from "@/lib/http/handler";
import { requireRole } from "@/lib/auth/guard";
import { AppError } from "@/lib/errors";
import { createProject } from "@/lib/services/project-service";

export const dynamic = "force-dynamic";

const CreateSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().min(1).max(5000),
  platform: z.string().min(1).max(40),
  buildUrl: z.string().url().max(500).optional().or(z.literal("").transform(() => undefined)),
  targetGenres: z.array(z.string().min(1)).max(20).default([]),
  targetPlatforms: z.array(z.string().min(1)).max(20).default([]),
  targetCountries: z.array(z.string().min(1)).max(50).default([]),
  feedbackQuestions: z.array(z.string().min(1).max(200)).max(5).default([]),
});

export const POST = route("/api/projects", async (req: NextRequest) => {
  const dev = await requireRole(req, "developer");

  const parsed = CreateSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    throw new AppError({
      category: "validation",
      message: parsed.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; "),
    });
  }

  const { id } = await createProject(dev.userId, parsed.data);
  return NextResponse.json({ id }, { status: 201 });
});
