export default function Home() {
  return (
    <main className="mx-auto max-w-2xl p-10">
      <h1 className="text-2xl font-semibold">PlaytestPool</h1>
      <p className="mt-2 text-neutral-600">
        Engineering foundation is up. Product features begin after the foundation
        report is approved.
      </p>
      <ul className="mt-6 space-y-1 text-sm text-neutral-700">
        <li>
          Health: <code className="rounded bg-neutral-100 px-1">/api/health</code>
        </li>
        <li>
          Metrics: <code className="rounded bg-neutral-100 px-1">/api/metrics</code>
        </li>
      </ul>
    </main>
  );
}
