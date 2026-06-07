/**
 * Phase 6 — admin toggles a tester's active state (soft remove).
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { route } from "@/lib/http/handler";
import { requireAdmin } from "@/lib/auth/guard";
import { AppError } from "@/lib/errors";
import { setTesterActive } from "@/lib/services/admin-service";

export const dynamic = "force-dynamic";

const Schema = z.object({ active: z.boolean() });

export const POST = route("/api/admin/testers/[id]", async (req: NextRequest, ctx) => {
  await requireAdmin(req);
  const { id } = await ctx.params;
  const testerId = Array.isArray(id) ? id[0] : id;
  const parsed = Schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) throw new AppError({ category: "validation", message: "active must be boolean" });
  await setTesterActive(testerId, parsed.data.active);
  return NextResponse.json({ id: testerId, active: parsed.data.active });
});
