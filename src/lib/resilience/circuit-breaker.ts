/**
 * Layer 5 — circuit breaker.
 *
 * Per-dependency breaker. After N consecutive failures it OPENS and fast-fails
 * for a cooldown window (avoiding pile-ups on a hung dependency). After the
 * window it goes HALF_OPEN and lets one trial through; success closes it.
 *
 * In-process state is sufficient for the foundation. For multi-instance prod
 * the same shape can be backed by Redis; the call sites don't change.
 */
import { AppError } from "@/lib/errors";
import { log } from "@/lib/observability/logger";

type State = "closed" | "open" | "half_open";

const logger = log("circuit-breaker");

export class CircuitBreaker {
  private state: State = "closed";
  private failures = 0;
  private openedAt = 0;

  constructor(
    private readonly name: string,
    private readonly threshold: number,
    private readonly resetMs: number
  ) {}

  private transition(next: State) {
    if (this.state !== next) {
      logger.warn({ dependency: this.name, from: this.state, to: next }, "circuit state change");
      this.state = next;
    }
  }

  /** Throw fast if the breaker is open and still cooling down. */
  assertClosed(): void {
    if (this.state === "open") {
      if (Date.now() - this.openedAt >= this.resetMs) {
        this.transition("half_open");
      } else {
        throw new AppError({
          category: "upstream_unavailable",
          message: `circuit open for ${this.name}`,
          retryable: false,
          dependency: this.name,
        });
      }
    }
  }

  recordSuccess(): void {
    this.failures = 0;
    if (this.state !== "closed") this.transition("closed");
  }

  recordFailure(): void {
    this.failures += 1;
    if (this.state === "half_open" || this.failures >= this.threshold) {
      this.openedAt = Date.now();
      this.transition("open");
    }
  }

  get status(): State {
    return this.state;
  }
}

const breakers = new Map<string, CircuitBreaker>();

export function getBreaker(name: string, threshold: number, resetMs: number): CircuitBreaker {
  let b = breakers.get(name);
  if (!b) {
    b = new CircuitBreaker(name, threshold, resetMs);
    breakers.set(name, b);
  }
  return b;
}
