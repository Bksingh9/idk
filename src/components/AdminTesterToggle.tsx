"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AdminTesterToggle({
  testerId,
  active,
}: {
  testerId: string;
  active: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    await fetch(`/api/admin/testers/${testerId}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ active: !active }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={`rounded-md px-3 py-1.5 text-sm disabled:opacity-50 ${
        active ? "border border-red-300 text-red-700" : "bg-black text-white"
      }`}
    >
      {busy ? "…" : active ? "Deactivate" : "Reactivate"}
    </button>
  );
}
