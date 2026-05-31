"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function OptInButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function optIn() {
    setBusy(true);
    await fetch(`/api/projects/${projectId}/opt-in`, { method: "POST" });
    setBusy(false);
    router.refresh();
  }

  return (
    <button
      onClick={optIn}
      disabled={busy}
      className="rounded-md bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
    >
      {busy ? "…" : "Opt in"}
    </button>
  );
}
