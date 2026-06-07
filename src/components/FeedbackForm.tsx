"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const inputCls = "w-full rounded-md border border-neutral-300 px-3 py-2 text-sm";

export default function FeedbackForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [funRating, setFunRating] = useState(3);
  const [wouldYouPay, setWouldYouPay] = useState<"yes" | "no" | "">("");
  const [bugsFound, setBugsFound] = useState("");
  const [whereDidYouDropOff, setWhereDidYouDropOff] = useState("");
  const [generalComments, setGeneralComments] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId,
        funRating,
        wouldYouPay: wouldYouPay === "" ? undefined : wouldYouPay === "yes",
        bugsFound: bugsFound || undefined,
        whereDidYouDropOff: whereDidYouDropOff || undefined,
        generalComments: generalComments || undefined,
      }),
    });
    setBusy(false);
    if (res.ok) {
      router.push("/dashboard/tester");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.message ?? "could not submit feedback");
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-5">
      <div>
        <span className="mb-1 block text-sm font-medium text-neutral-700">Fun rating</span>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              type="button"
              key={n}
              onClick={() => setFunRating(n)}
              aria-pressed={funRating === n}
              className={`h-9 w-9 rounded-md border text-sm ${
                funRating === n ? "border-black bg-black text-white" : "border-neutral-300"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="mb-1 block text-sm font-medium text-neutral-700">Would you pay for this?</span>
        <div className="flex gap-4 text-sm">
          {(["yes", "no"] as const).map((v) => (
            <label key={v} className="flex items-center gap-1">
              <input
                type="radio"
                name="pay"
                checked={wouldYouPay === v}
                onChange={() => setWouldYouPay(v)}
              />
              {v}
            </label>
          ))}
        </div>
      </div>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-neutral-700">Bugs found</span>
        <textarea rows={2} value={bugsFound} onChange={(e) => setBugsFound(e.target.value)} className={inputCls} />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-neutral-700">Where did you drop off?</span>
        <input value={whereDidYouDropOff} onChange={(e) => setWhereDidYouDropOff(e.target.value)} className={inputCls} />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-neutral-700">General comments</span>
        <textarea rows={3} value={generalComments} onChange={(e) => setGeneralComments(e.target.value)} className={inputCls} />
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button disabled={busy} className="rounded-md bg-black px-4 py-2 text-sm text-white disabled:opacity-50">
        {busy ? "Submitting…" : "Submit feedback"}
      </button>
    </form>
  );
}
