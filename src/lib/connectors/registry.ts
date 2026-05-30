/**
 * Layer 9 — typed connector/tool registry.
 *
 * Every external capability (web fetch, internal API, future MCP server) is
 * declared once here with its own input schema, privilege level, timeout and
 * handler. Invocation is centralized so every call gets: input validation at
 * the boundary, the resilience policy, usage metering, and structured logging.
 *
 * Security (rule from the brief): input that originates from an untrusted source
 * (e.g. user/tester-supplied text that could carry a prompt injection) is NEVER
 * allowed to drive a `privileged` connector unless the caller passes an explicit
 * `guard: "operator-approved"` token. Non-privileged connectors additionally
 * must not let untrusted input choose hosts/targets (enforced inside the
 * connector, e.g. web-fetch pins the host).
 */
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { log } from "@/lib/observability/logger";
import { recordUsage } from "@/lib/observability/metrics";
import { withResilience } from "@/lib/resilience/with-resilience";

const logger = log("connectors");

export type TrustLevel = "trusted" | "untrusted";

export interface Connector<I, O> {
  name: string;
  description: string;
  /** Privileged connectors can take consequential/destructive actions. */
  privileged: boolean;
  inputSchema: z.ZodType<I>;
  timeoutMs?: number;
  handle: (input: I) => Promise<O>;
}

export interface InvokeOptions {
  /** Where the input came from. Defaults to untrusted (safe by default). */
  trust?: TrustLevel;
  /** Explicit operator approval required to run a privileged connector with
   *  untrusted input. */
  guard?: "operator-approved";
}

class ConnectorRegistry {
  private connectors = new Map<string, Connector<unknown, unknown>>();

  register<I, O>(connector: Connector<I, O>): void {
    if (this.connectors.has(connector.name)) {
      throw new Error(`connector already registered: ${connector.name}`);
    }
    this.connectors.set(connector.name, connector as Connector<unknown, unknown>);
    logger.info(
      { connector: connector.name, privileged: connector.privileged },
      "connector registered"
    );
  }

  list(): { name: string; description: string; privileged: boolean }[] {
    return [...this.connectors.values()].map((c) => ({
      name: c.name,
      description: c.description,
      privileged: c.privileged,
    }));
  }

  async invoke<O = unknown>(
    name: string,
    rawInput: unknown,
    opts: InvokeOptions = {}
  ): Promise<O> {
    const connector = this.connectors.get(name);
    if (!connector) {
      throw new AppError({ category: "not_found", message: `unknown connector: ${name}` });
    }
    const trust = opts.trust ?? "untrusted";

    // Prompt-injection / privilege guard.
    if (connector.privileged && trust === "untrusted" && opts.guard !== "operator-approved") {
      logger.warn(
        { connector: name, trust },
        "blocked privileged connector invocation from untrusted input"
      );
      throw new AppError({
        category: "forbidden",
        message: `connector '${name}' is privileged and cannot be triggered by untrusted input without explicit operator approval`,
      });
    }

    // Input validation at the boundary.
    const parsed = connector.inputSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new AppError({
        category: "validation",
        message: `invalid input for connector '${name}': ${parsed.error.issues
          .map((i) => i.message)
          .join("; ")}`,
      });
    }

    logger.info({ connector: name, trust, privileged: connector.privileged }, "connector invoke");
    const result = await withResilience(
      { dependency: `connector:${name}`, operation: "invoke", timeoutMs: connector.timeoutMs },
      () => connector.handle(parsed.data)
    );
    recordUsage(`connector:${name}`, "invoke");
    return result as O;
  }
}

// Pinned to globalThis so registration survives module re-evaluation in dev.
const g = globalThis as typeof globalThis & { __ptp_registry?: ConnectorRegistry };
export const registry = (g.__ptp_registry ??= new ConnectorRegistry());
