"use client";

/**
 * Layer 4 proof (client) — consumes /api/stream via EventSource and renders
 * chunks progressively as they arrive.
 */
import { useEffect, useRef, useState } from "react";

export default function StreamDemo() {
  const [chunks, setChunks] = useState<string[]>([]);
  const [status, setStatus] = useState("idle");
  const esRef = useRef<EventSource | null>(null);

  function start() {
    setChunks([]);
    setStatus("streaming");
    const es = new EventSource("/api/stream?count=8");
    esRef.current = es;
    es.addEventListener("chunk", (e) => {
      const data = JSON.parse((e as MessageEvent).data);
      setChunks((prev) => [...prev, data.text]);
    });
    es.addEventListener("done", () => {
      setStatus("done");
      es.close();
    });
    es.onerror = () => {
      setStatus("error");
      es.close();
    };
  }

  useEffect(() => () => esRef.current?.close(), []);

  return (
    <main className="mx-auto max-w-2xl p-10">
      <h1 className="text-xl font-semibold">SSE streaming demo</h1>
      <button
        onClick={start}
        className="mt-4 rounded bg-black px-4 py-2 text-sm text-white"
      >
        Start stream
      </button>
      <p className="mt-2 text-sm text-neutral-500">status: {status}</p>
      <ul className="mt-4 space-y-1 font-mono text-sm">
        {chunks.map((c, i) => (
          <li key={i} className="rounded bg-neutral-100 px-2 py-1">
            {c}
          </li>
        ))}
      </ul>
    </main>
  );
}
