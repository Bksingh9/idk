/**
 * Layer 7 — Prometheus metrics endpoint. Scrape-friendly text exposition.
 */
import { NextResponse } from "next/server";
import { route } from "@/lib/http/handler";
import { registry } from "@/lib/observability/metrics";

export const dynamic = "force-dynamic";

export const GET = route("/api/metrics", async () => {
  const body = await registry.metrics();
  return new NextResponse(body, {
    status: 200,
    headers: { "Content-Type": registry.contentType },
  });
});
