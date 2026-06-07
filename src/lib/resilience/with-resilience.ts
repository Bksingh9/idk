/**
 * Layer 5 — centralized resilience policy (rule 4).
 *
 * Wraps a single external call with: hard timeout, retry-with-jittered-backoff
 * on transient errors, a per-dependency circuit breaker, and structured logging
 * of latency + outcome. Every wrapper routes its calls through this so the
 * policy lives in exactly one place.
 */
import { env } from "@/lib/config/env";
import { AppError, classifyTransient, isAppError } from "@/lib/errors";
import { log } from "@/lib/observability/logger";
import { recordExternalCall } from "@/lib/observability/metrics";
import { getBreaker } from "./circuit-breaker";

const logger = log("resilience");

export interface ResilienceOptions {
  dependency: string;
  operation: string;
  timeoutMs?: number;
  maxRetries?: number;
  /** Override transient classification (e.g. inspect provider status codes). */
  isRetryable?: (error: unknown) => boolean;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Full jitter backoff: random between 0 and min(cap, base * 2^attempt). */
function backoffMs(attempt: number, baseMs = 100, capMs = 2000): number {
  const exp = Math.min(capMs, baseMs * 2 ** attempt);
  return Math.floor(Math.random() * exp);
}

async function withTimeout<T>(p: Promise<T>, ms: number, dependency: string, operation: string): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () =>
        reject(
          new AppError({
            category: "timeout",
            message: `${dependency}.${operation} timed out after ${ms}ms`,
            retryable: true,
            dependency,
          })
        ),
      ms
    );
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

export async function withResilience<T>(
  opts: ResilienceOptions,
  fn: () => Promise<T>
): Promise<T> {
  const timeoutMs = opts.timeoutMs ?? env.EXTERNAL_CALL_TIMEOUT_MS;
  const maxRetries = opts.maxRetries ?? env.EXTERNAL_CALL_MAX_RETRIES;
  const isRetryable = opts.isRetryable ?? classifyTransient;
  const breaker = getBreaker(
    opts.dependency,
    env.CIRCUIT_BREAKER_THRESHOLD,
    env.CIRCUIT_BREAKER_RESET_MS
  );

  let attempt = 0;
  // attempts = 1 initial + maxRetries
  for (;;) {
    breaker.assertClosed();
    const start = performance.now();
    try {
      const result = await withTimeout(fn(), timeoutMs, opts.dependency, opts.operation);
      const latency = performance.now() - start;
      breaker.recordSuccess();
      recordExternalCall(opts.dependency, opts.operation, "success", latency);
      logger.debug(
        { dependency: opts.dependency, operation: opts.operation, attempt, latency_ms: Math.round(latency), outcome: "success" },
        "external call ok"
      );
      return result;
    } catch (err) {
      const latency = performance.now() - start;
      breaker.recordFailure();
      const retryable = isRetryable(err);
      recordExternalCall(opts.dependency, opts.operation, "failure", latency);
      logger.warn(
        {
          dependency: opts.dependency,
          operation: opts.operation,
          attempt,
          latency_ms: Math.round(latency),
          outcome: "failure",
          retryable,
          err: err instanceof Error ? err.message : String(err),
        },
        "external call failed"
      );

      if (!retryable || attempt >= maxRetries) {
        // Normalize anything that isn't already an AppError.
        if (isAppError(err)) throw err;
        throw new AppError({
          category: "upstream_unavailable",
          message: `${opts.dependency}.${opts.operation} failed: ${err instanceof Error ? err.message : String(err)}`,
          retryable: false,
          dependency: opts.dependency,
          cause: err,
        });
      }
      await sleep(backoffMs(attempt));
      attempt += 1;
    }
  }
}
