/**
 * Layer 6 proof — a route with a tight custom limit (5/min). The 6th call in a
 * window returns a clean 429 + Retry-After (produced by the normalized error).
 */
import { NextRequest, NextResponse } from "next/server";
import { route } from "@/lib/http/handler";
import { enforceCustomLimit } from "@/lib/http/rate-limit";

export const dynamic = "force-dynamic";

export const GET = route("/api/demo/limited", async (req: NextRequest) => {
  await enforceCustomLimit(req, "demo", 5);
  return NextResponse.json({ ok: true, message: "within limit" });
});
