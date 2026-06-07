import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/server";
import { getProfile } from "@/lib/services/profile-service";
import { listInvites, listAccepted } from "@/lib/services/tester-service";
import LogoutButton from "@/components/LogoutButton";
import InviteActions from "@/components/InviteActions";

export const dynamic = "force-dynamic";

export default async function TesterDashboard() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "tester") redirect("/dashboard/developer");

  const [profile, invites, accepted] = await Promise.all([
    getProfile(session.userId),
    listInvites(session.userId),
    listAccepted(session.userId),
  ]);
  const t = profile?.tester;

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Tester dashboard</h1>
        <LogoutButton />
      </div>
      <p className="mt-2 text-neutral-600">Welcome, {profile?.displayName}.</p>

      {t && (
        <dl className="mt-6 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <Stat label="Reputation" value={t.reputationScore} />
          <Stat label="Tests done" value={t.testsCompleted} />
          <Stat label="Experience" value={t.experienceLevel} />
          <Stat label="Active" value={t.isActive ? "yes" : "no"} />
        </dl>
      )}

      {/* Pending invites */}
      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Invitations</h2>
          <Link href="/browse" className="text-sm underline">
            Browse open projects →
          </Link>
        </div>
        {invites.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-neutral-300 p-6 text-sm text-neutral-500">
            No pending invitations. Browse open projects to opt in.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-neutral-200 rounded-lg border border-neutral-200">
            {invites.map((i) => (
              <li key={i.inviteId} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="font-medium">{i.title}</p>
                  <p className="text-xs text-neutral-500">{i.platform}</p>
                </div>
                <InviteActions inviteId={i.inviteId} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Accepted projects */}
      <section className="mt-10">
        <h2 className="text-lg font-medium">Projects you&apos;re testing</h2>
        {accepted.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-neutral-300 p-6 text-sm text-neutral-500">
            Nothing accepted yet.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-neutral-200 rounded-lg border border-neutral-200">
            {accepted.map((a) => (
              <li key={a.inviteId} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="font-medium">{a.title}</p>
                  <p className="text-xs text-neutral-500">{a.platform}</p>
                </div>
                {a.feedbackSubmitted ? (
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">
                    feedback submitted
                  </span>
                ) : (
                  <Link
                    href={`/feedback/${a.projectId}`}
                    className="rounded-md bg-black px-3 py-1.5 text-sm text-white"
                  >
                    Give feedback
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
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
