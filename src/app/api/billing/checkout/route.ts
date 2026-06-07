/**
 * Phase 5 — start a Stripe Checkout session for a plan upgrade (developer only).
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { route } from "@/lib/http/handler";
import { requireRole } from "@/lib/auth/guard";
import { AppError } from "@/lib/errors";
import { startCheckout } from "@/lib/services/billing-service";

export const dynamic = "force-dynamic";

const Schema = z.object({ plan: z.enum(["indie", "studio"]) });

export const POST = route("/api/billing/checkout", async (req: NextRequest) => {
  const dev = await requireRole(req, "developer");
  const parsed = Schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) throw new AppError({ category: "validation", message: "plan must be indie or studio" });
  const url = await startCheckout(dev.userId, parsed.data.plan);
  return NextResponse.json({ url });
});
