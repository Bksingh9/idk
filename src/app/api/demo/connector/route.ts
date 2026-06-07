/**
 * Layer 9 proof — invoke a connector through the registry.
 *
 *  GET                       → list registered connectors
 *  POST {name, input, trust} → invoke via the registry (default trust=untrusted)
 *
 * Try POSTing the privileged "admin-purge-cache" with untrusted input to see the
 * guard reject it (403); add guard server-side to allow it.
 */
import { NextRequest, NextResponse } from "next/server";
import { route } from "@/lib/http/handler";
import { registry } from "@/lib/connectors/registry";
import { ensureConnectors } from "@/lib/connectors";

export const dynamic = "force-dynamic";

ensureConnectors();

export const GET = route("/api/demo/connector", async () => {
  return NextResponse.json({ connectors: registry.list() });
});

export const POST = route("/api/demo/connector", async (req: NextRequest) => {
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    input?: unknown;
    trust?: "trusted" | "untrusted";
  };
  const result = await registry.invoke(body.name ?? "", body.input, {
    trust: body.trust ?? "untrusted",
  });
  return NextResponse.json({ name: body.name, result });
});
