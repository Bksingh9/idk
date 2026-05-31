"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ProjectStatusToggle({
  projectId,
  status,
}: {
  projectId: string;
  status: "open" | "closed";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const next = status === "open" ? "closed" : "open";

  async function toggle() {
    setBusy(true);
    await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm disabled:opacity-50"
    >
      {busy ? "…" : next === "closed" ? "Close project" : "Reopen project"}
    </button>
  );
}
