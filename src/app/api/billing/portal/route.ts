/**
 * Phase 5 — open the Stripe customer portal (developer only).
 */
import { NextRequest, NextResponse } from "next/server";
import { route } from "@/lib/http/handler";
import { requireRole } from "@/lib/auth/guard";
import { startPortal } from "@/lib/services/billing-service";

export const dynamic = "force-dynamic";

export const POST = route("/api/billing/portal", async (req: NextRequest) => {
  const dev = await requireRole(req, "developer");
  const url = await startPortal(dev.userId);
  return NextResponse.json({ url });
});
