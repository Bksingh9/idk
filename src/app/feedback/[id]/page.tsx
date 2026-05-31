import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth/server";
import { getFeedbackContext } from "@/lib/services/feedback-service";
import { isAppError } from "@/lib/errors";
import FeedbackForm from "@/components/FeedbackForm";

export const dynamic = "force-dynamic";

export default async function FeedbackPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "tester") redirect("/dashboard/developer");

  const { id: projectId } = await params;
  let ctx;
  try {
    ctx = await getFeedbackContext(session.userId, projectId);
  } catch (e) {
    if (isAppError(e) && (e.category === "not_found" || e.category === "forbidden")) notFound();
    throw e;
  }

  return (
    <main className="mx-auto max-w-lg px-6 py-12">
      <Link href="/dashboard/tester" className="text-sm text-neutral-500 underline">
        ← Back to dashboard
      </Link>
      <h1 className="mt-3 text-2xl font-semibold">Feedback: {ctx.title}</h1>
      <p className="mt-2 text-sm text-neutral-600">{ctx.description}</p>

      {ctx.questions.length > 0 && (
        <div className="mt-4 rounded-lg bg-neutral-50 p-4 text-sm">
          <p className="font-medium text-neutral-700">The developer also asks:</p>
          <ul className="mt-1 list-disc pl-5 text-neutral-600">
            {ctx.questions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-neutral-400">
            Address these in your general comments below.
          </p>
        </div>
      )}

      {ctx.alreadySubmitted ? (
        <p className="mt-6 rounded-lg border border-dashed border-neutral-300 p-6 text-sm text-neutral-500">
          You&apos;ve already submitted feedback for this project. Thank you!
        </p>
      ) : (
        <FeedbackForm projectId={projectId} />
      )}
    </main>
  );
}
