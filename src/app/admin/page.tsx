import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth/server";
import { isAdmin, listTesters } from "@/lib/services/admin-service";
import AdminTesterToggle from "@/components/AdminTesterToggle";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!(await isAdmin(session.userId))) notFound();

  const testers = await listTesters();

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-semibold">Admin · testers</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Deactivating a tester removes them from matching and browse.
      </p>

      {testers.length === 0 ? (
        <p className="mt-6 text-sm text-neutral-500">No testers yet.</p>
      ) : (
        <table className="mt-6 w-full text-sm">
          <thead>
            <tr className="border-b text-left text-neutral-500">
              <th className="py-2">Tester</th>
              <th className="py-2">Reputation</th>
              <th className="py-2">Tests</th>
              <th className="py-2">Status</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {testers.map((t) => (
              <tr key={t.id} className="border-b">
                <td className="py-2">
                  <div className="font-medium">{t.displayName}</div>
                  <div className="text-xs text-neutral-500">{t.email}</div>
                </td>
                <td className="py-2">{t.reputationScore}</td>
                <td className="py-2">{t.testsCompleted}</td>
                <td className="py-2">
                  {t.isActive ? (
                    <span className="text-green-700">active</span>
                  ) : (
                    <span className="text-neutral-400">inactive</span>
                  )}
                </td>
                <td className="py-2 text-right">
                  <AdminTesterToggle testerId={t.id} active={t.isActive} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
