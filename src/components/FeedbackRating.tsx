"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function FeedbackRating({
  feedbackId,
  current,
}: {
  feedbackId: string;
  current: number | null;
}) {
  const router = useRouter();
  const [stars, setStars] = useState<number | null>(current);
  const [busy, setBusy] = useState(false);

  async function rate(n: number) {
    setBusy(true);
    setStars(n);
    await fetch(`/api/feedback/${feedbackId}/rating`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ stars: n }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-1" aria-label="Rate feedback quality">
      <span className="mr-1 text-xs text-neutral-500">Quality:</span>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={busy}
          onClick={() => rate(n)}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          className={`text-lg leading-none ${
            stars && n <= stars ? "text-amber-500" : "text-neutral-300"
          }`}
        >
          ★
        </button>
      ))}
    </div>
  );
}
