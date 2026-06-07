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
import { env, features } from "@/lib/config/env";
import { AppError } from "@/lib/errors";
import { log } from "@/lib/observability/logger";
import { withResilience } from "@/lib/resilience/with-resilience";

const logger = log("supabase");
const DEP = "supabase";

/** Asserts Supabase is configured and returns the (now non-null) settings. */
function requireConfig(): { url: string; anon: string; service: string } {
  if (!features.supabase) {
    throw new AppError({
      category: "config",
      message: "Supabase is not configured (set NEXT_PUBLIC_SUPABASE_URL + keys)",
      dependency: DEP,
    });
  }
  return {
    url: env.NEXT_PUBLIC_SUPABASE_URL!,
    anon: env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    service: env.SUPABASE_SERVICE_ROLE_KEY!,
  };
}

export function browserClient(): SupabaseClient {
  const c = requireConfig();
  return createBrowserClient(c.url, c.anon);
}

export interface CookieAdapter {
  getAll(): { name: string; value: string }[];
  setAll(cookies: { name: string; value: string; options?: Record<string, unknown> }[]): void;
}

/** Request-scoped server client. Pass the framework's cookie adapter. */
export function serverClient(cookies: CookieAdapter): SupabaseClient {
  const c = requireConfig();
  return createServerClient(c.url, c.anon, {
    cookies: {
      getAll: () => cookies.getAll(),
      setAll: (ck: { name: string; value: string; options?: Record<string, unknown> }[]) =>
        cookies.setAll(ck),
    },
  });
}

let admin: SupabaseClient | null = null;
export function adminClient(): SupabaseClient {
  if (admin) return admin;
  const c = requireConfig();
  admin = createClient(c.url, c.service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return admin;
}

export interface SupabaseIdentity {
  userId: string;
  email: string;
}

/** Verify email/password via Supabase Auth (admin/anon client), through the
 *  resilience policy. Returns the verified identity or throws. */
export async function signInWithPassword(
  email: string,
  password: string
): Promise<SupabaseIdentity> {
  return withResilience({ dependency: DEP, operation: "auth.signIn", maxRetries: 1 }, async () => {
    const { data, error } = await adminClient().auth.signInWithPassword({ email, password });
    if (error || !data.user) throw new Error(error?.message ?? "invalid credentials");
    return { userId: data.user.id, email: data.user.email ?? email };
  });
}

/** Create a user via Supabase Auth. */
export async function signUpWithPassword(
  email: string,
  password: string
): Promise<SupabaseIdentity> {
  return withResilience({ dependency: DEP, operation: "auth.signUp", maxRetries: 1 }, async () => {
    const { data, error } = await adminClient().auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error || !data.user) throw new Error(error?.message ?? "signup failed");
    return { userId: data.user.id, email: data.user.email ?? email };
  });
}

/**
 * Health check. Hits Supabase Auth settings (an unauthenticated, always-present
 * endpoint) through the resilience policy. Returns ok/false rather than
 * throwing so the health route can report degraded status (Layer 5).
 */
export async function checkSupabase(): Promise<{ ok: boolean; detail: string }> {
  if (!features.supabase) return { ok: true, detail: "disabled (not configured)" };
  try {
    await withResilience(
      { dependency: DEP, operation: "auth.settings", maxRetries: 1, timeoutMs: 3000 },
      async () => {
        const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
          headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
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
