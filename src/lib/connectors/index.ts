/**
 * Layer 9 — connector definitions + one-time registration.
 *
 * Import `ensureConnectors()` (idempotent) before using the registry. Two
 * examples are registered:
 *   - "web-fetch"   (non-privileged): a real outbound HTTP round-trip whose host
 *                    is PINNED — untrusted input only supplies a query string,
 *                    never the target host (SSRF / injection guard).
 *   - "admin-purge-cache" (privileged): a consequential action that untrusted
 *                    input cannot trigger without operator approval.
 */
import { z } from "zod";
import { registry, type Connector } from "./registry";
import { redis } from "@/lib/wrappers/redis";

// Fixed, allow-listed host. Untrusted query text can never redirect this.
const PINNED_HOST = "https://registry.npmjs.org";

const webFetch: Connector<{ query: string }, { ok: boolean; status: number; host: string }> = {
  name: "web-fetch",
  description: "Fetch a fixed, allow-listed endpoint (host pinned; query is a safe param).",
  privileged: false,
  timeoutMs: 4000,
  inputSchema: z.object({ query: z.string().min(1).max(200) }),
  async handle({ query }) {
    // Host is pinned; the untrusted query is URL-encoded into a query param only.
    const url = `${PINNED_HOST}/-/v1/search?text=${encodeURIComponent(query)}&size=1`;
    const res = await fetch(url);
    return { ok: res.ok, status: res.status, host: new URL(PINNED_HOST).host };
  },
};

const adminPurgeCache: Connector<{ prefix: string }, { purged: boolean }> = {
  name: "admin-purge-cache",
  description: "Privileged: purge cache keys under a prefix. Operator-approved only.",
  privileged: true,
  inputSchema: z.object({ prefix: z.string().min(1).max(64) }),
  async handle({ prefix }) {
    // Demonstration: a guarded, consequential action.
    await redis.del(`cache:${prefix}:_marker`);
    return { purged: true };
  },
};

let registered = false;
export function ensureConnectors(): void {
  if (registered) return;
  registered = true;
  registry.register(webFetch);
  registry.register(adminPurgeCache);
}
