/**
 * Layer 7 — Prometheus metrics.
 *
 * A single shared registry, pinned to globalThis so every module instance (Next
 * compiles route handlers into separate graphs in dev) shares ONE registry and
 * counter set. Exposed at GET /api/metrics in Prometheus text format. Covers
 * HTTP requests, external dependency calls (latency + outcome), rate-limit
 * decisions, and a usage/spend counter for metered calls (Layer 6).
 */
import {
  Registry,
  Counter,
  Histogram,
  collectDefaultMetrics,
} from "prom-client";

interface MetricsBundle {
  registry: Registry;
  httpRequests: Counter<string>;
  httpDuration: Histogram<string>;
  externalCalls: Counter<string>;
  externalDuration: Histogram<string>;
  rateLimitDecisions: Counter<string>;
  usageUnits: Counter<string>;
}

const g = globalThis as typeof globalThis & { __ptp_metrics?: MetricsBundle };

function build(): MetricsBundle {
  const registry = new Registry();
  collectDefaultMetrics({ register: registry });

  return {
    registry,
    httpRequests: new Counter({
      name: "http_requests_total",
      help: "Total HTTP requests",
      labelNames: ["method", "route", "status"],
      registers: [registry],
    }),
    httpDuration: new Histogram({
      name: "http_request_duration_seconds",
      help: "HTTP request latency",
      labelNames: ["method", "route", "status"],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
      registers: [registry],
    }),
    externalCalls: new Counter({
      name: "external_calls_total",
      help: "External dependency calls by outcome",
      labelNames: ["dependency", "operation", "outcome"],
      registers: [registry],
    }),
    externalDuration: new Histogram({
      name: "external_call_duration_seconds",
      help: "External dependency call latency",
      labelNames: ["dependency", "operation", "outcome"],
      buckets: [0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
      registers: [registry],
    }),
    rateLimitDecisions: new Counter({
      name: "rate_limit_decisions_total",
      help: "Rate limit decisions",
      labelNames: ["scope", "decision"],
      registers: [registry],
    }),
    usageUnits: new Counter({
      name: "usage_units_total",
      help: "Metered usage units consumed per external dependency",
      labelNames: ["dependency", "operation"],
      registers: [registry],
    }),
  };
}

const metrics: MetricsBundle = (g.__ptp_metrics ??= build());

export const registry = metrics.registry;
export const rateLimitDecisions = metrics.rateLimitDecisions;

export function recordExternalCall(
  dependency: string,
  operation: string,
  outcome: "success" | "failure",
  latencyMs: number
): void {
  metrics.externalCalls.inc({ dependency, operation, outcome });
  metrics.externalDuration.observe({ dependency, operation, outcome }, latencyMs / 1000);
}

export function recordHttp(
  method: string,
  route: string,
  status: number,
  latencyMs: number
): void {
  const labels = { method, route, status: String(status) };
  metrics.httpRequests.inc(labels);
  metrics.httpDuration.observe(labels, latencyMs / 1000);
}

export function recordUsage(dependency: string, operation: string, units = 1): void {
  metrics.usageUnits.inc({ dependency, operation }, units);
}
