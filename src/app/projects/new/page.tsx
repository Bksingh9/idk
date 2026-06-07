"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const GENRES = ["Action", "Adventure", "RPG", "Strategy", "Puzzle", "Simulation", "Shooter", "Platformer", "Casual", "Horror"];
const PLATFORMS = ["Windows", "macOS", "Linux", "iOS", "Android", "Web", "Console"];

const inputCls = "w-full rounded-md border border-neutral-300 px-3 py-2 text-sm";

function Chips({ options, selected, onToggle }: { options: string[]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = selected.includes(o);
        return (
          <button
            type="button"
            key={o}
            onClick={() => onToggle(o)}
            className={`rounded-full border px-3 py-1 text-sm ${on ? "border-black bg-black text-white" : "border-neutral-300 text-neutral-700"}`}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-neutral-700">{label}</span>
      {children}
    </label>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={label}>
      <span className="mb-1 block text-sm font-medium text-neutral-700">{label}</span>
      {children}
    </div>
  );
}

export default function NewProjectPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [platform, setPlatform] = useState("Windows");
  const [buildUrl, setBuildUrl] = useState("");
  const [targetGenres, setTargetGenres] = useState<string[]>([]);
  const [targetPlatforms, setTargetPlatforms] = useState<string[]>([]);
  const [targetCountries, setTargetCountries] = useState("");
  const [questions, setQuestions] = useState<string[]>([""]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const toggle = (list: string[], set: (v: string[]) => void, v: string) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  function updateQuestion(i: number, v: string) {
    setQuestions((qs) => qs.map((q, idx) => (idx === i ? v : q)));
  }
  function addQuestion() {
    setQuestions((qs) => (qs.length < 5 ? [...qs, ""] : qs));
  }
  function removeQuestion(i: number) {
    setQuestions((qs) => qs.filter((_, idx) => idx !== i));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const body = {
      title,
      description,
      platform,
      buildUrl: buildUrl || undefined,
      targetGenres,
      targetPlatforms,
      targetCountries: targetCountries.split(",").map((s) => s.trim()).filter(Boolean),
      feedbackQuestions: questions.map((q) => q.trim()).filter(Boolean),
    };
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (res.ok) {
      const data = await res.json();
      router.push(`/projects/${data.id}`);
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.message ?? "could not create project");
    }
  }

  return (
    <main className="mx-auto max-w-lg px-6 py-12">
      <Link href="/dashboard/developer" className="text-sm text-neutral-500 underline">
        ← Back to dashboard
      </Link>
      <h1 className="mt-3 text-2xl font-semibold">Post a project</h1>

      <form onSubmit={submit} className="mt-6 space-y-4">
        <Field label="Title">
          <input required value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Description">
          <textarea required rows={4} value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Platform (the build runs on)">
          <select value={platform} onChange={(e) => setPlatform(e.target.value)} className={inputCls}>
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Build URL">
          <input type="url" placeholder="https://…" value={buildUrl} onChange={(e) => setBuildUrl(e.target.value)} className={inputCls} />
        </Field>

        <FieldGroup label="Target genres">
          <Chips options={GENRES} selected={targetGenres} onToggle={(v) => toggle(targetGenres, setTargetGenres, v)} />
        </FieldGroup>
        <FieldGroup label="Target platforms">
          <Chips options={PLATFORMS} selected={targetPlatforms} onToggle={(v) => toggle(targetPlatforms, setTargetPlatforms, v)} />
        </FieldGroup>
        <Field label="Target countries (comma-separated)">
          <input placeholder="US, CA, GB" value={targetCountries} onChange={(e) => setTargetCountries(e.target.value)} className={inputCls} />
        </Field>

        <div role="group" aria-label="Custom feedback questions">
          <span className="mb-1 block text-sm font-medium text-neutral-700">
            Custom feedback questions (up to 5)
          </span>
          <div className="space-y-2">
            {questions.map((q, i) => (
              <div key={i} className="flex gap-2">
                <input
                  value={q}
                  onChange={(e) => updateQuestion(i, e.target.value)}
                  placeholder={`Question ${i + 1}`}
                  className={inputCls}
                />
                {questions.length > 1 && (
                  <button type="button" onClick={() => removeQuestion(i)} className="px-2 text-sm text-neutral-500">
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
          {questions.length < 5 && (
            <button type="button" onClick={addQuestion} className="mt-2 text-sm text-neutral-600 underline">
              + Add question
            </button>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button disabled={busy} className="rounded-md bg-black px-4 py-2 text-sm text-white disabled:opacity-50">
          {busy ? "Posting…" : "Post project"}
        </button>
      </form>
    </main>
  );
}
