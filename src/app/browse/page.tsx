import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/server";
import { listBrowseable } from "@/lib/services/tester-service";
import OptInButton from "@/components/OptInButton";

export const dynamic = "force-dynamic";

export default async function BrowsePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "tester") redirect("/dashboard/developer");

  const projects = await listBrowseable(session.userId);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/dashboard/tester" className="text-sm text-neutral-500 underline">
        ← Back to dashboard
      </Link>
      <h1 className="mt-3 text-2xl font-semibold">Open projects for you</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Matched to your genres, platforms and country. Opt in to start testing.
      </p>

      {projects.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed border-neutral-300 p-6 text-sm text-neutral-500">
          No matching open projects right now. Check back later.
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-neutral-200 rounded-lg border border-neutral-200">
          {projects.map((p) => (
            <li key={p.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="font-medium">{p.title}</p>
                <p className="text-xs text-neutral-500">
                  {p.platform}
                  {p.targetGenres.length ? ` · ${p.targetGenres.join(", ")}` : ""}
                </p>
              </div>
              <OptInButton projectId={p.id} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
