/**
 * Layer 2/3 proof — health route that does REAL round-trips through the
 * wrappers and reports per-dependency status. Returns 200 when core deps
 * (postgres, redis) are healthy, 503 if a core dep is down. Provider deps
 * (supabase/stripe/resend) report status without failing the core check, so a
 * degraded provider is visible but doesn't take the app down (Layer 5).
 */
import { NextResponse } from "next/server";
import { route } from "@/lib/http/handler";
import { redis } from "@/lib/wrappers/redis";
import { pingMongo } from "@/lib/wrappers/mongo";
import { checkSupabase } from "@/lib/wrappers/supabase";
import { stripeWrapper } from "@/lib/wrappers/stripe";
import { email } from "@/lib/wrappers/resend";

type Check = { ok: boolean; detail: string; latency_ms: number };

async function timed(fn: () => Promise<{ ok: boolean; detail: string }>): Promise<Check> {
  const start = performance.now();
  try {
    const r = await fn();
    return { ...r, latency_ms: Math.round(performance.now() - start) };
  } catch (e) {
    return {
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
      latency_ms: Math.round(performance.now() - start),
    };
  }
}

export const GET = route("/api/health", async () => {
  const [mongo, redisCheck, supabase, stripe, resend] = await Promise.all([
    timed(async () => ({ ok: await pingMongo(), detail: "ping" })),
    timed(async () => ({ ok: (await redis.ping()) === "PONG", detail: "ping" })),
    timed(() => checkSupabase()),
    timed(() => stripeWrapper.healthCheck()),
    timed(() => email.healthCheck()),
  ]);

  const core = { mongo, redis: redisCheck };
  const providers = { supabase, stripe, resend };
  const coreHealthy = mongo.ok && redisCheck.ok;

  return NextResponse.json(
    {
      status: coreHealthy ? "ok" : "degraded",
      time: new Date().toISOString(),
      core,
      providers,
    },
    { status: coreHealthy ? 200 : 503 }
  );
});
