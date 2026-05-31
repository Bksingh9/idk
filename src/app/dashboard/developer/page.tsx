import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/server";
import { getProfile } from "@/lib/services/profile-service";
import LogoutButton from "@/components/LogoutButton";

export default async function DeveloperDashboard() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "developer") redirect("/dashboard/tester");

  const profile = await getProfile(session.userId);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Developer dashboard</h1>
        <LogoutButton />
      </div>
      <p className="mt-2 text-neutral-600">
        Welcome, {profile?.displayName}. Plan: <strong>{profile?.plan}</strong>.
      </p>

      <section className="mt-8 rounded-lg border border-dashed border-neutral-300 p-6 text-sm text-neutral-500">
        Posting projects and viewing feedback arrives in <strong>Phase 2</strong>.
        Your profile is set up and you&apos;re signed in as a developer.
      </section>
    </main>
  );
}
