/**
 * Normalized error taxonomy. Wrappers translate provider-specific failures into
 * these so the rest of the app reasons about a small, stable set of categories
 * (rule 1: error normalization lives in the wrapper boundary).
 */

export type ErrorCategory =
  | "config"
  | "timeout"
  | "rate_limited"
  | "upstream_unavailable" // 5xx / network / circuit open
  | "not_found"
  | "unauthorized"
  | "forbidden"
  | "validation"
  | "conflict"
  | "internal";

export interface AppErrorOptions {
  category: ErrorCategory;
  message: string;
  /** Whether a retry could plausibly succeed. */
  retryable?: boolean;
  /** HTTP status to surface to clients. */
  httpStatus?: number;
  /** Seconds the client should wait before retrying (sets Retry-After). */
  retryAfterSeconds?: number;
  cause?: unknown;
  /** Which external dependency produced this, if any. */
  dependency?: string;
}

const DEFAULT_STATUS: Record<ErrorCategory, number> = {
  config: 500,
  timeout: 504,
  rate_limited: 429,
  upstream_unavailable: 503,
  not_found: 404,
  unauthorized: 401,
  forbidden: 403,
  validation: 400,
  conflict: 409,
  internal: 500,
};

export class AppError extends Error {
  readonly category: ErrorCategory;
  readonly retryable: boolean;
  readonly httpStatus: number;
  readonly retryAfterSeconds?: number;
  readonly dependency?: string;

  constructor(opts: AppErrorOptions) {
    super(opts.message, { cause: opts.cause });
    this.name = "AppError";
    this.category = opts.category;
    this.retryable = opts.retryable ?? false;
    this.httpStatus = opts.httpStatus ?? DEFAULT_STATUS[opts.category];
    this.retryAfterSeconds = opts.retryAfterSeconds;
    this.dependency = opts.dependency;
  }

  toJSON() {
    return {
      error: this.category,
      message: this.message,
      retryable: this.retryable,
      dependency: this.dependency,
    };
  }
}

export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}

/** Best-effort classification of an unknown thrown value into a category. */
export function classifyTransient(e: unknown): boolean {
  if (isAppError(e)) return e.retryable;
  const msg = (e instanceof Error ? e.message : String(e)).toLowerCase();
  // Network-ish errors are transient.
  return (
    msg.includes("econnrefused") ||
    msg.includes("econnreset") ||
    msg.includes("etimedout") ||
    msg.includes("enotfound") ||
    msg.includes("socket hang up") ||
    msg.includes("network")
  );
}
