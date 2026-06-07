/**
 * Phase 3 — tester responds to an invite (accept/decline). Tester only, own
 * invites only.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { route } from "@/lib/http/handler";
import { requireRole } from "@/lib/auth/guard";
import { AppError } from "@/lib/errors";
import { respondToInvite } from "@/lib/services/tester-service";

export const dynamic = "force-dynamic";

const Schema = z.object({ action: z.enum(["accept", "decline"]) });

export const POST = route("/api/invites/[id]", async (req: NextRequest, ctx) => {
  const tester = await requireRole(req, "tester");
  const { id } = await ctx.params;
  const inviteId = Array.isArray(id) ? id[0] : id;

  const parsed = Schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    throw new AppError({ category: "validation", message: "action must be accept or decline" });
  }

  await respondToInvite(tester.userId, inviteId, parsed.data.action);
  return NextResponse.json({ inviteId, action: parsed.data.action });
});
