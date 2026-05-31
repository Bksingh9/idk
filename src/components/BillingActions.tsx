"use client";

import { useState } from "react";

export default function BillingActions({
  enabled,
  plan,
}: {
  enabled: boolean;
  plan: "free" | "indie" | "studio";
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go(path: string, body?: object) {
    setBusy(true);
    setError(null);
    const res = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok && data.url) {
      window.location.href = data.url;
    } else {
      setError(data.message ?? "billing action failed");
    }
  }

  if (!enabled) {
    return (
      <p className="mt-4 rounded-lg border border-dashed border-neutral-300 p-4 text-sm text-neutral-500">
        Billing is not configured in this environment (no Stripe key). Plan gating
        still applies — everyone is on the free plan.
      </p>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => go("/api/billing/checkout", { plan: "indie" })}
          disabled={busy || plan === "indie"}
          className="rounded-md bg-black px-4 py-2 text-sm text-white disabled:opacity-40"
        >
          {plan === "indie" ? "Current: Indie" : "Upgrade to Indie — $39/mo"}
        </button>
        <button
          onClick={() => go("/api/billing/checkout", { plan: "studio" })}
          disabled={busy || plan === "studio"}
          className="rounded-md bg-black px-4 py-2 text-sm text-white disabled:opacity-40"
        >
          {plan === "studio" ? "Current: Studio" : "Upgrade to Studio — $99/mo"}
        </button>
      </div>
      {plan !== "free" && (
        <button
          onClick={() => go("/api/billing/portal")}
          disabled={busy}
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm disabled:opacity-50"
        >
          Manage subscription
        </button>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
