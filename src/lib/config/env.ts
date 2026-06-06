/**
 * Layer 1 — Config & secrets.
 *
 * Single source of truth for configuration. The schema is validated ONCE at
 * module load. If any required variable is missing or malformed, this throws
 * with a precise, human-readable report and the app refuses to boot (rule 2).
 *
 * Nothing else in the app reads process.env directly — they import `env` here.
 * Secrets here are server-only; only NEXT_PUBLIC_* values may reach the client
 * bundle (rule 3), and those are the only ones referenced from client code.
 */
import { z } from "zod";

const booleanish = (def: boolean) =>
  z
    .enum(["true", "false", "1", "0"])
    .optional()
    .transform((v) => (v === undefined ? def : v === "true" || v === "1"));

const intFromString = (def: number) =>
  z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (v === undefined || v === "") return def;
      const n = Number(v);
      if (!Number.isFinite(n) || !Number.isInteger(n)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "must be an integer" });
        return z.NEVER;
      }
      return n;
    });

// Optional provider key: when omitted the feature is disabled; when present it
// must be non-empty (catches "set but blank-with-spaces" mistakes).
const optionalSecret = z
  .string()
  .trim()
  .min(1)
  .optional()
  .or(z.literal("").transform(() => undefined));

const EnvSchema = z.object({
  // --- App (CORE) ---
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_BASE_URL: z.string().url(),
  CORS_ALLOWED_ORIGINS: z
    .string()
    .default("")
    .transform((s) =>
      s
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean)
    ),
  LOG_LEVEL: z
    .enum(["trace", "debug", "info", "warn", "error", "fatal"])
    .default("info"),

  // --- Auth (CORE) ---
  AUTH_JWT_SECRET: z
    .string()
    .min(32, "AUTH_JWT_SECRET must be at least 32 characters (use `openssl rand -base64 48`)"),
  AUTH_ACCESS_TTL_SECONDS: intFromString(900),
  AUTH_REFRESH_TTL_SECONDS: intFromString(60 * 60 * 24 * 14),

  // --- MongoDB (CORE) ---
  MONGODB_URI: z.string().refine((u) => u.startsWith("mongodb"), {
    message: "MONGODB_URI must be a mongodb:// or mongodb+srv:// connection string",
  }),
  MONGODB_DB: z.string().min(1).default("playtestpool"),

  // --- Redis (CORE) ---
  REDIS_URL: z.string().url().refine((u) => u.startsWith("redis"), {
    message: "REDIS_URL must be a redis:// or rediss:// URL",
  }),

  // --- Supabase (PROVIDER, optional) ---
  // Not used by the product path (we use built-in JWT auth + MongoDB). Kept as
  // an optional provider integration; only validated if present.
  NEXT_PUBLIC_SUPABASE_URL: z.preprocess(
    (v) => (typeof v === "string" && v.trim() !== "" ? v : undefined),
    z.string().url().optional()
  ),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: optionalSecret,
  SUPABASE_SERVICE_ROLE_KEY: optionalSecret,

  // --- Stripe (PROVIDER, optional until Phase 5) ---
  STRIPE_SECRET_KEY: optionalSecret.refine(
    (v) => v === undefined || v.startsWith("sk_"),
    { message: "STRIPE_SECRET_KEY must start with sk_" }
  ),
  STRIPE_WEBHOOK_SECRET: optionalSecret,
  STRIPE_PRICE_INDIE: optionalSecret,
  STRIPE_PRICE_STUDIO: optionalSecret,

  // --- Resend (PROVIDER, optional → console fallback) ---
  RESEND_API_KEY: optionalSecret.refine(
    (v) => v === undefined || v.startsWith("re_"),
    { message: "RESEND_API_KEY must start with re_" }
  ),
  EMAIL_FROM: z.string().default("PlaytestPool <onboarding@resend.dev>"),

  // --- Sentry (PROVIDER, optional) ---
  SENTRY_DSN: optionalSecret,

  // --- Resilience (Layer 5) ---
  EXTERNAL_CALL_TIMEOUT_MS: intFromString(5000),
  EXTERNAL_CALL_MAX_RETRIES: intFromString(3),
  CIRCUIT_BREAKER_THRESHOLD: intFromString(5),
  CIRCUIT_BREAKER_RESET_MS: intFromString(15000),

  // --- Rate limiting (Layer 6) ---
  RATE_LIMIT_PER_USER_PER_MIN: intFromString(60),
  RATE_LIMIT_GLOBAL_PER_MIN: intFromString(1000),
  // Signups per window per IP. Default protects production; tests/CI raise it
  // since the whole suite signs up many users from one IP in one window.
  SIGNUP_RATE_LIMIT: intFromString(10),

  // --- Admin (Phase 6) — emails allowed into the admin view ---
  ADMIN_EMAILS: z
    .string()
    .default("")
    .transform((s) =>
      s
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean)
    ),
});

export type Env = z.infer<typeof EnvSchema>;

function format(error: z.ZodError): string {
  const lines = error.issues.map((i) => {
    const path = i.path.join(".") || "(root)";
    return `  ✗ ${path}: ${i.message}`;
  });
  return [
    "",
    "════════════════════════════════════════════════════════════════",
    " FATAL: invalid or missing environment configuration",
    "════════════════════════════════════════════════════════════════",
    ...lines,
    "",
    " Fix these in your .env.local (see .env.example). The app cannot boot",
    " with invalid configuration.",
    "════════════════════════════════════════════════════════════════",
    "",
  ].join("\n");
}

let cached: Env | null = null;

/**
 * Parse + validate the environment. Throws a formatted error on failure.
 * Cached after first success so the cost is paid once.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const message = format(parsed.error);
    // Loud, unmissable failure.
    // eslint-disable-next-line no-console
    console.error(message);
    throw new Error("Environment validation failed");
  }
  cached = parsed.data;
  return cached;
}

/** Convenience accessor — validated env, evaluated lazily on first import. */
export const env: Env = loadEnv();

/** Feature flags derived from presence of optional provider keys. */
export const features = {
  stripe: !!env.STRIPE_SECRET_KEY,
  resend: !!env.RESEND_API_KEY,
  sentry: !!env.SENTRY_DSN,
  supabase: !!(
    env.NEXT_PUBLIC_SUPABASE_URL &&
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    env.SUPABASE_SERVICE_ROLE_KEY
  ),
} as const;
