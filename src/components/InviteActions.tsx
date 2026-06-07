"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function InviteActions({ inviteId }: { inviteId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function respond(action: "accept" | "decline") {
    setBusy(true);
    await fetch(`/api/invites/${inviteId}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={() => respond("accept")}
        disabled={busy}
        className="rounded-md bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
      >
        Accept
      </button>
      <button
        onClick={() => respond("decline")}
        disabled={busy}
        className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm disabled:opacity-50"
      >
        Decline
      </button>
    </div>
  );
}
