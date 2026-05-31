import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth/server";
import { getProjectDetail } from "@/lib/services/project-service";
import { isAppError } from "@/lib/errors";
import ProjectStatusToggle from "@/components/ProjectStatusToggle";
import FeedbackRating from "@/components/FeedbackRating";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "developer") redirect("/dashboard/tester");

  const { id } = await params;
  let project;
  try {
    project = await getProjectDetail(session.userId, id);
  } catch (e) {
    if (isAppError(e) && e.category === "not_found") notFound();
    throw e;
  }

  const a = project.aggregate;

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/dashboard/developer" className="text-sm text-neutral-500 underline">
        ← Back to dashboard
      </Link>

      <div className="mt-3 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{project.title}</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {project.platform} · created {project.createdAt.toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`rounded-full px-2 py-0.5 text-xs ${
              project.status === "open" ? "bg-green-100 text-green-800" : "bg-neutral-200 text-neutral-600"
            }`}
          >
            {project.status}
          </span>
          <ProjectStatusToggle projectId={project.id} status={project.status} />
        </div>
      </div>

      <p className="mt-4 whitespace-pre-wrap text-neutral-700">{project.description}</p>

      {project.buildUrl && (
        <p className="mt-3 text-sm">
          Build:{" "}
          <a href={project.buildUrl} className="text-blue-700 underline" target="_blank" rel="noreferrer">
            {project.buildUrl}
          </a>
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2 text-xs text-neutral-600">
        {project.targetGenres.map((g) => (
          <span key={g} className="rounded bg-neutral-100 px-2 py-0.5">{g}</span>
        ))}
        {project.targetPlatforms.map((p) => (
          <span key={p} className="rounded bg-neutral-100 px-2 py-0.5">{p}</span>
        ))}
        {project.targetCountries.map((c) => (
          <span key={c} className="rounded bg-neutral-100 px-2 py-0.5">{c}</span>
        ))}
      </div>

      {project.feedbackQuestions.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-medium text-neutral-700">Custom questions asked</h2>
          <ul className="mt-2 list-disc pl-5 text-sm text-neutral-600">
            {project.feedbackQuestions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </section>
      )}

      {/* Aggregated feedback */}
      <section className="mt-10">
        <h2 className="text-lg font-medium">Feedback</h2>
        {a.count === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-neutral-300 p-6 text-sm text-neutral-500">
            No feedback yet. Once testers are matched (Phase 3) and submit responses
            (Phase 4), the aggregate will appear here.
          </p>
        ) : (
          <>
            <dl className="mt-4 grid grid-cols-3 gap-4 text-sm">
              <Stat label="Responses" value={String(a.count)} />
              <Stat
                label="Avg fun rating"
                value={a.avgFunRating != null ? `${a.avgFunRating.toFixed(1)} / 5` : "—"}
              />
              <Stat
                label="Would pay"
                value={a.wouldPayPct != null ? `${Math.round(a.wouldPayPct)}%` : "—"}
              />
            </dl>

            {a.dropOffPoints.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-medium text-neutral-700">Drop-off points</h3>
                <ul className="mt-2 list-disc pl-5 text-sm text-neutral-600">
                  {a.dropOffPoints.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-6 space-y-4">
              {a.responses.map((r) => (
                <div key={r.id} className="rounded-lg border border-neutral-200 p-4 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">
                      {r.testerName}{" "}
                      <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
                        rep {r.testerReputation}
                      </span>
                    </span>
                    <span className="text-neutral-500">
                      Fun: {r.funRating}/5
                      {r.wouldYouPay == null ? "" : r.wouldYouPay ? " · would pay" : " · wouldn't pay"}
                    </span>
                  </div>
                  <div className="mt-2">
                    <FeedbackRating feedbackId={r.id} current={r.stars} />
                  </div>
                  {r.bugsFound && <p className="mt-2"><span className="text-neutral-500">Bugs:</span> {r.bugsFound}</p>}
                  {r.whereDidYouDropOff && (
                    <p className="mt-1"><span className="text-neutral-500">Drop-off:</span> {r.whereDidYouDropOff}</p>
                  )}
                  {r.generalComments && (
                    <p className="mt-1"><span className="text-neutral-500">Comments:</span> {r.generalComments}</p>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-neutral-200 p-3">
      <dt className="text-xs uppercase tracking-wide text-neutral-400">{label}</dt>
      <dd className="mt-1 text-lg font-semibold text-neutral-800">{value}</dd>
    </div>
  );
}
