/**
 * Layer 10 — logout. Clears auth cookies.
 */
import { NextResponse } from "next/server";
import { route } from "@/lib/http/handler";

export const dynamic = "force-dynamic";

export const POST = route("/api/auth/logout", async () => {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete("ptp_access");
  res.cookies.delete("ptp_refresh");
  return res;
});
