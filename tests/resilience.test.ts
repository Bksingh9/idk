/**
 * Layer 5 proof — retry/backoff and circuit-breaker behavior, deterministic and
 * dependency-free.
 */
import { describe, expect, it } from "vitest";
import { withResilience } from "@/lib/resilience/with-resilience";
import { CircuitBreaker } from "@/lib/resilience/circuit-breaker";
import { AppError, isAppError } from "@/lib/errors";

describe("Layer 5 — withResilience retries", () => {
  it("retries a transient failure then succeeds", async () => {
    let calls = 0;
    const result = await withResilience(
      { dependency: "test", operation: "flaky", maxRetries: 3 },
      async () => {
        calls += 1;
        if (calls < 3) throw new Error("ECONNRESET transient");
        return "ok";
      }
    );
    expect(result).toBe("ok");
    expect(calls).toBe(3);
  });

  it("does not retry a non-transient error", async () => {
    let calls = 0;
    await expect(
      withResilience({ dependency: "test", operation: "fatal", maxRetries: 3 }, async () => {
        calls += 1;
        throw new AppError({ category: "validation", message: "bad input", retryable: false });
      })
    ).rejects.toThrow();
    expect(calls).toBe(1);
  });

  it("gives up after maxRetries and normalizes the error", async () => {
    let calls = 0;
    try {
      await withResilience(
        { dependency: "test", operation: "always-fails", maxRetries: 2 },
        async () => {
          calls += 1;
          throw new Error("network unreachable");
        }
      );
      throw new Error("should have thrown");
    } catch (e) {
      expect(isAppError(e)).toBe(true);
      expect((e as AppError).category).toBe("upstream_unavailable");
    }
    expect(calls).toBe(3); // 1 initial + 2 retries
  });

  it("enforces a hard timeout", async () => {
    await expect(
      withResilience(
        { dependency: "test", operation: "slow", timeoutMs: 50, maxRetries: 0 },
        () => new Promise((r) => setTimeout(() => r("late"), 500))
      )
    ).rejects.toMatchObject({ category: "timeout" });
  });
});

describe("Layer 5 — CircuitBreaker", () => {
  it("opens after threshold and fast-fails, then half-opens after reset", async () => {
    const cb = new CircuitBreaker("unit", 3, 100);
    for (let i = 0; i < 3; i++) cb.recordFailure();
    expect(cb.status).toBe("open");
    expect(() => cb.assertClosed()).toThrow(); // fast-fail while open

    await new Promise((r) => setTimeout(r, 120));
    cb.assertClosed(); // moves to half_open, does not throw
    expect(cb.status).toBe("half_open");

    cb.recordSuccess();
    expect(cb.status).toBe("closed");
  });
});
