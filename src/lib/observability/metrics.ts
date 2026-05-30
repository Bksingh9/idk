/**
 * Layer 7 — Prometheus metrics.
 *
 * A single shared registry. Exposed at GET /api/metrics in Prometheus text
 * format. Covers HTTP requests, external dependency calls (latency + outcome),
 * rate-limit decisions, and a usage/spend counter for metered calls (Layer 6).
 */
import {
  Registry,
  Counter,
  Histogram,
  collectDefaultMetrics,
} from "prom-client";

export const registry = new Registry();
collectDefaultMetrics({ register: registry });

export const httpRequests = new Counter({
  name: "http_requests_total",
  help: "Total HTTP requests",
  labelNames: ["method", "route", "status"] as const,
  registers: [registry],
});

export const httpDuration = new Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request latency",
  labelNames: ["method", "route", "status"] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  registers: [registry],
});

export const externalCalls = new Counter({
  name: "external_calls_total",
  help: "External dependency calls by outcome",
  labelNames: ["dependency", "operation", "outcome"] as const,
  registers: [registry],
});

export const externalDuration = new Histogram({
  name: "external_call_duration_seconds",
  help: "External dependency call latency",
  labelNames: ["dependency", "operation", "outcome"] as const,
  buckets: [0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [registry],
});

export const rateLimitDecisions = new Counter({
  name: "rate_limit_decisions_total",
  help: "Rate limit decisions",
  labelNames: ["scope", "decision"] as const,
  registers: [registry],
});

// Layer 6 — usage/spend guard: count metered units consumed per dependency.
export const usageUnits = new Counter({
  name: "usage_units_total",
  help: "Metered usage units consumed per external dependency",
  labelNames: ["dependency", "operation"] as const,
  registers: [registry],
});

export function recordExternalCall(
  dependency: string,
  operation: string,
  outcome: "success" | "failure",
  latencyMs: number
): void {
  externalCalls.inc({ dependency, operation, outcome });
  externalDuration.observe({ dependency, operation, outcome }, latencyMs / 1000);
}

export function recordHttp(
  method: string,
  route: string,
  status: number,
  latencyMs: number
): void {
  const labels = { method, route, status: String(status) };
  httpRequests.inc(labels);
  httpDuration.observe(labels, latencyMs / 1000);
}

export function recordUsage(dependency: string, operation: string, units = 1): void {
  usageUnits.inc({ dependency, operation }, units);
}
