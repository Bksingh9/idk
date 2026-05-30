/**
 * Layer 10 proof — a protected route. Unauthenticated → 401; authenticated →
 * returns the principal.
 */
import { NextRequest, NextResponse } from "next/server";
import { route } from "@/lib/http/handler";
import { requireAuth } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

export const GET = route("/api/me", async (req: NextRequest) => {
  const principal = await requireAuth(req);
  return NextResponse.json({ authenticated: true, ...principal });
});
