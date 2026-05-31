import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/server";
import { getProfile } from "@/lib/services/profile-service";
import LogoutButton from "@/components/LogoutButton";

export default async function TesterDashboard() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "tester") redirect("/dashboard/developer");

  const profile = await getProfile(session.userId);
  const t = profile?.tester;

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Tester dashboard</h1>
        <LogoutButton />
      </div>
      <p className="mt-2 text-neutral-600">Welcome, {profile?.displayName}.</p>

      {t && (
        <dl className="mt-6 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <Stat label="Reputation" value={t.reputationScore} />
          <Stat label="Tests completed" value={t.testsCompleted} />
          <Stat label="Experience" value={t.experienceLevel} />
          <Stat label="Genres" value={t.genres.join(", ") || "—"} />
          <Stat label="Platforms" value={t.platforms.join(", ") || "—"} />
          <Stat label="Languages" value={t.languages.join(", ") || "—"} />
        </dl>
      )}

      <section className="mt-8 rounded-lg border border-dashed border-neutral-300 p-6 text-sm text-neutral-500">
        Browsing projects, invites, and submitting feedback arrive in{" "}
        <strong>Phase 3 &amp; 4</strong>. Your tester profile is set up.
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-neutral-200 p-3">
      <dt className="text-xs uppercase tracking-wide text-neutral-400">{label}</dt>
      <dd className="mt-1 font-medium text-neutral-800">{value}</dd>
    </div>
  );
}
