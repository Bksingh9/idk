import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/server";
import { getPlanStatus, PLAN_LIMITS } from "@/lib/services/billing-service";
import { features } from "@/lib/config/env";
import BillingActions from "@/components/BillingActions";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "developer") redirect("/dashboard/tester");

  const status = await getPlanStatus(session.userId);
  const limitLabel = status.limit === Infinity ? "unlimited" : String(status.limit);

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <Link href="/dashboard/developer" className="text-sm text-neutral-500 underline">
        ← Back to dashboard
      </Link>
      <h1 className="mt-3 text-2xl font-semibold">Billing &amp; plan</h1>

      <div className="mt-6 rounded-lg border border-neutral-200 p-5">
        <p className="text-sm text-neutral-500">Current plan</p>
        <p className="text-xl font-semibold capitalize">{status.plan}</p>
        <p className="mt-1 text-sm text-neutral-600">
          {status.activeProjects} / {limitLabel} active projects used
          {status.subscriptionStatus ? ` · subscription: ${status.subscriptionStatus}` : ""}
        </p>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3 text-sm">
        <PlanCard name="Free" price="$0" detail={`${PLAN_LIMITS.free} active project`} active={status.plan === "free"} />
        <PlanCard name="Indie" price="$39/mo" detail={`${PLAN_LIMITS.indie} active projects`} active={status.plan === "indie"} />
        <PlanCard name="Studio" price="$99/mo" detail="Unlimited + priority matching" active={status.plan === "studio"} />
      </div>

      <BillingActions enabled={features.stripe} plan={status.plan} />
    </main>
  );
}

function PlanCard({ name, price, detail, active }: { name: string; price: string; detail: string; active: boolean }) {
  return (
    <div className={`rounded-lg border p-4 ${active ? "border-black" : "border-neutral-200"}`}>
      <p className="font-medium">{name}</p>
      <p className="text-neutral-700">{price}</p>
      <p className="mt-1 text-xs text-neutral-500">{detail}</p>
    </div>
  );
}
