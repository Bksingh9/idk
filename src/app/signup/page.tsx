"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

const GENRES = ["Action", "Adventure", "RPG", "Strategy", "Puzzle", "Simulation", "Shooter", "Platformer", "Casual", "Horror"];
const PLATFORMS = ["Windows", "macOS", "Linux", "iOS", "Android", "Web", "Console"];
const EXPERIENCE = ["new", "casual", "experienced", "pro"] as const;

type Role = "developer" | "tester";

function Chips({
  options,
  selected,
  onToggle,
}: {
  options: string[];
  selected: string[];
  onToggle: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = selected.includes(o);
        return (
          <button
            type="button"
            key={o}
            onClick={() => onToggle(o)}
            className={`rounded-full border px-3 py-1 text-sm ${
              on ? "border-black bg-black text-white" : "border-neutral-300 text-neutral-700"
            }`}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const initialRole = (params.get("role") as Role) || null;

  const [role, setRole] = useState<Role | null>(
    initialRole === "developer" || initialRole === "tester" ? initialRole : null
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [country, setCountry] = useState("");
  const [genres, setGenres] = useState<string[]>([]);
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [languages, setLanguages] = useState("English");
  const [experienceLevel, setExperienceLevel] = useState<(typeof EXPERIENCE)[number]>("new");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const toggle = (list: string[], set: (v: string[]) => void, v: string) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const body =
      role === "tester"
        ? {
            role,
            email,
            password,
            displayName,
            country: country || undefined,
            tester: {
              genres,
              platforms,
              languages: languages.split(",").map((s) => s.trim()).filter(Boolean),
              experienceLevel,
            },
          }
        : { role, email, password, displayName, country: country || undefined };

    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (res.ok) {
      router.push("/dashboard");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.message ?? "signup failed");
    }
  }

  if (!role) {
    return (
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <button
          onClick={() => setRole("developer")}
          className="rounded-lg border border-neutral-200 p-5 text-left hover:border-black"
        >
          <span className="font-medium">Developer</span>
          <p className="mt-1 text-sm text-neutral-600">Post projects, get feedback.</p>
        </button>
        <button
          onClick={() => setRole("tester")}
          className="rounded-lg border border-neutral-200 p-5 text-left hover:border-black"
        >
          <span className="font-medium">Tester</span>
          <p className="mt-1 text-sm text-neutral-600">Get matched, give feedback, build reputation.</p>
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-4">
      <p className="text-sm text-neutral-500">
        Signing up as <strong>{role}</strong>.{" "}
        <button type="button" className="underline" onClick={() => setRole(null)}>
          change
        </button>
      </p>

      <Field label="Email">
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
      </Field>
      <Field label="Password (min 8 chars)">
        <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
      </Field>
      <Field label="Display name">
        <input required value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={inputCls} />
      </Field>
      <Field label="Country (optional)">
        <input value={country} onChange={(e) => setCountry(e.target.value)} className={inputCls} />
      </Field>

      {role === "tester" && (
        <>
          <Field label="Genres you play">
            <Chips options={GENRES} selected={genres} onToggle={(v) => toggle(genres, setGenres, v)} />
          </Field>
          <Field label="Platforms you have">
            <Chips options={PLATFORMS} selected={platforms} onToggle={(v) => toggle(platforms, setPlatforms, v)} />
          </Field>
          <Field label="Languages (comma-separated)">
            <input value={languages} onChange={(e) => setLanguages(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Experience level">
            <select value={experienceLevel} onChange={(e) => setExperienceLevel(e.target.value as never)} className={inputCls}>
              {EXPERIENCE.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </Field>
        </>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button disabled={busy} className="rounded-md bg-black px-4 py-2 text-sm text-white disabled:opacity-50">
        {busy ? "Creating…" : "Create account"}
      </button>
      <p className="text-sm text-neutral-500">
        Already have an account?{" "}
        <Link href="/login" className="underline">
          Log in
        </Link>
      </p>
    </form>
  );
}

const inputCls = "w-full rounded-md border border-neutral-300 px-3 py-2 text-sm";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-neutral-700">{label}</span>
      {children}
    </label>
  );
}

export default function SignupPage() {
  return (
    <main className="mx-auto max-w-lg px-6 py-12">
      <h1 className="text-2xl font-semibold">Create your account</h1>
      <Suspense fallback={null}>
        <SignupForm />
      </Suspense>
    </main>
  );
}
