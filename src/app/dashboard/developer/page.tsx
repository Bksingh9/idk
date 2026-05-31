import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/server";
import { getProfile } from "@/lib/services/profile-service";
import { listProjectsForDeveloper } from "@/lib/services/project-service";
import LogoutButton from "@/components/LogoutButton";

export const dynamic = "force-dynamic";

export default async function DeveloperDashboard() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "developer") redirect("/dashboard/tester");

  const [profile, projects] = await Promise.all([
    getProfile(session.userId),
    listProjectsForDeveloper(session.userId),
  ]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Developer dashboard</h1>
        <LogoutButton />
      </div>
      <p className="mt-2 text-neutral-600">
        Welcome, {profile?.displayName}. Plan: <strong>{profile?.plan}</strong>.
      </p>

      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-lg font-medium">Your projects</h2>
        <Link href="/projects/new" className="rounded-md bg-black px-4 py-2 text-sm text-white">
          Post a project
        </Link>
      </div>

      {projects.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed border-neutral-300 p-6 text-sm text-neutral-500">
          No projects yet. Post your first build to start collecting feedback.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-neutral-200 rounded-lg border border-neutral-200">
          {projects.map((p) => (
            <li key={p.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <Link href={`/projects/${p.id}`} className="font-medium hover:underline">
                  {p.title}
                </Link>
                <p className="text-xs text-neutral-500">
                  {p.feedbackCount} feedback {p.feedbackCount === 1 ? "response" : "responses"}
                </p>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  p.status === "open"
                    ? "bg-green-100 text-green-800"
                    : "bg-neutral-200 text-neutral-600"
                }`}
              >
                {p.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
