import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/server";

/** Protected entry point — redirects to the role-specific dashboard. */
export default async function Dashboard() {
  const session = await getSession();
  if (!session) redirect("/login");
  redirect(session.role === "developer" ? "/dashboard/developer" : "/dashboard/tester");
}
