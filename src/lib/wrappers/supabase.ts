/**
 * Layer 2 — Supabase wrapper (the ONLY module that imports the Supabase SDK;
 * rule 1). Owns three client shapes plus a health check:
 *
 *  - browserClient(): anon client for client components (public keys only).
 *  - serverClient():  request-scoped client bound to the user's cookies, used
 *                     for RLS-enforced reads/writes on the server.
 *  - adminClient():   service-role client (server-only, bypasses RLS) for
 *                     privileged operations like matching/invite fan-out.
 *
 * Service-role key never leaves the server (rule 3). Round-trips that can hang
 * are wrapped with the resilience policy.
 */
import { createBrowserClient, createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/config/env";
import { log } from "@/lib/observability/logger";
import { withResilience } from "@/lib/resilience/with-resilience";

const logger = log("supabase");
const DEP = "supabase";

export function browserClient(): SupabaseClient {
  return createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export interface CookieAdapter {
  getAll(): { name: string; value: string }[];
  setAll(cookies: { name: string; value: string; options?: Record<string, unknown> }[]): void;
}

/** Request-scoped server client. Pass the framework's cookie adapter. */
export function serverClient(cookies: CookieAdapter): SupabaseClient {
  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookies.getAll(),
      setAll: (c: { name: string; value: string; options?: Record<string, unknown> }[]) =>
        cookies.setAll(c),
    },
  });
}

let admin: SupabaseClient | null = null;
export function adminClient(): SupabaseClient {
  if (admin) return admin;
  admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return admin;
}

/**
 * Health check. Hits Supabase Auth settings (an unauthenticated, always-present
 * endpoint) through the resilience policy. Returns ok/false rather than
 * throwing so the health route can report degraded status (Layer 5).
 */
export async function checkSupabase(): Promise<{ ok: boolean; detail: string }> {
  try {
    await withResilience(
      { dependency: DEP, operation: "auth.settings", maxRetries: 1, timeoutMs: 3000 },
      async () => {
        const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
          headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY },
        });
        if (!res.ok && res.status >= 500) {
          throw new Error(`supabase auth settings returned ${res.status}`);
        }
        return res.status;
      }
    );
    return { ok: true, detail: "reachable" };
  } catch (e) {
    logger.warn({ err: e instanceof Error ? e.message : String(e) }, "supabase health check failed");
    return { ok: false, detail: e instanceof Error ? e.message : String(e) };
  }
}
