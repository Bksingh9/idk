import Link from "next/link";
import { getSession } from "@/lib/auth/server";

export default async function Home() {
  const session = await getSession();

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">PlaytestPool</h1>
      <p className="mt-3 text-neutral-600">
        Match indie game &amp; app developers with real playtesters. Post a build,
        get matched with testers, and run a real feedback loop end to end.
      </p>

      {session ? (
        <div className="mt-8">
          <Link
            href="/dashboard"
            className="inline-block rounded-md bg-black px-4 py-2 text-sm text-white"
          >
            Go to your dashboard
          </Link>
        </div>
      ) : (
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-neutral-200 p-5">
            <h2 className="font-medium">I&apos;m a developer</h2>
            <p className="mt-1 text-sm text-neutral-600">
              Post your build, get matched with real playtesters, and read structured
              feedback — fun ratings, would-pay signal, and where players drop off.
            </p>
            <ol className="mt-3 list-decimal pl-5 text-sm text-neutral-600">
              <li>Post a project with target genres &amp; platforms</li>
              <li>We invite matching testers automatically</li>
              <li>Review aggregated feedback and rate its quality</li>
            </ol>
            <Link
              href="/signup?role=developer"
              className="mt-4 inline-block rounded-md bg-black px-4 py-2 text-sm text-white"
            >
              Sign up as developer
            </Link>
          </div>
          <div className="rounded-lg border border-neutral-200 p-5">
            <h2 className="font-medium">I&apos;m a tester</h2>
            <p className="mt-1 text-sm text-neutral-600">
              Get matched to games in your genres, give structured feedback, and build
              a reputation that developers can see.
            </p>
            <ol className="mt-3 list-decimal pl-5 text-sm text-neutral-600">
              <li>Tell us your genres, platforms &amp; languages</li>
              <li>Accept invitations or browse open projects</li>
              <li>Submit feedback and grow your reputation</li>
            </ol>
            <Link
              href="/signup?role=tester"
              className="mt-4 inline-block rounded-md bg-neutral-800 px-4 py-2 text-sm text-white"
            >
              Sign up as tester
            </Link>
          </div>
        </div>
      )}

      {!session && (
        <p className="mt-6 text-sm text-neutral-500">
          Already have an account?{" "}
          <Link href="/login" className="underline">
            Log in
          </Link>
        </p>
      )}
    </main>
  );
}
