"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Cloud,
  GraduationCap,
  HelpCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Connection = { provider: "google" | "canvas"; status: string };

export function SetupWizard({
  userId,
  termLabel,
  connections,
}: {
  userId: string;
  termLabel: string;
  connections: Connection[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const connected = new Set(
    connections
      .filter((connection) => connection.status === "connected")
      .map((connection) => connection.provider),
  );

  async function finish() {
    setBusy(true);
    setError("");
    const { error: saveError } = await createClient()
      .from("profiles")
      .update({ onboarding_completed_at: new Date().toISOString() })
      .eq("id", userId);
    if (saveError) {
      setError("We could not finish setup. Please try again.");
      setBusy(false);
      return;
    }
    router.push("/today");
    router.refresh();
  }

  const steps = [
    {
      icon: BookOpen,
      title: "Your academic term",
      body: termLabel,
      action: "Ready",
      href: null,
      complete: true,
    },
    {
      icon: CalendarDays,
      title: "Google Calendar + Gmail",
      body: connected.has("google")
        ? "Connected and ready to sync."
        : "Bring in upcoming events and unread school messages when it helps.",
      action: connected.has("google") ? "Connected" : "Connect Google",
      href: connected.has("google") ? null : "/api/integrations/google/start",
      complete: connected.has("google"),
    },
    {
      icon: Cloud,
      title: "Canvas",
      body: connected.has("canvas")
        ? "Connected and ready to sync."
        : "Add a personal Canvas token to import active courses and assignments.",
      action: connected.has("canvas") ? "Connected" : "Set up Canvas",
      href: connected.has("canvas") ? null : "/settings#connections",
      complete: connected.has("canvas"),
    },
    {
      icon: GraduationCap,
      title: "Grades and QPI",
      body: "Add course units, then record results when your syllabus categories are ready.",
      action: "Open subjects",
      href: "/subjects",
      complete: false,
    },
  ];

  return (
    <section
      aria-labelledby="setup-wizard-heading"
      className="mt-6 rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-7"
    >
      <div className="max-w-2xl">
        <p className="text-xs font-extrabold tracking-[.14em] text-teal">
          YOUR STARTING POINT
        </p>
        <h1
          className="mt-2 text-3xl font-black tracking-[-.035em] text-slate-950 sm:text-4xl"
          id="setup-wizard-heading"
        >
          Make Scht useful in a few thoughtful choices.
        </h1>
        <p className="mt-3 leading-7 text-slate-700">
          Your term is ready. Choose only the tools that support your routine;
          everything else can wait.
        </p>
      </div>
      <ol className="mt-7 divide-y divide-slate-100 border-y border-slate-100">
        {steps.map(({ icon: Icon, title, body, action, href, complete }) => (
          <li
            className="flex flex-col gap-4 py-5 first:pt-4 sm:flex-row sm:items-center sm:justify-between"
            key={title}
          >
            <div className="flex min-w-0 gap-4">
              <span
                className={`grid size-11 shrink-0 place-items-center rounded-xl ${complete ? "bg-[#e6f2f0] text-teal" : "bg-slate-100 text-slate-600"}`}
              >
                {complete ? (
                  <CheckCircle2 aria-hidden="true" className="size-5" />
                ) : (
                  <Icon aria-hidden="true" className="size-5" />
                )}
              </span>
              <div>
                <h2 className="font-bold text-slate-950">{title}</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">{body}</p>
              </div>
            </div>
            {href ? (
              <a
                className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-teal/30 px-3 text-sm font-bold text-teal transition hover:bg-teal/5"
                href={href}
              >
                {action}
                <ArrowRight aria-hidden="true" className="size-4" />
              </a>
            ) : (
              <span className="text-sm font-bold text-teal">{action}</span>
            )}
          </li>
        ))}
      </ol>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <a
          className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-teal underline decoration-teal/30 underline-offset-4 hover:decoration-teal"
          href="/help"
        >
          <HelpCircle aria-hidden="true" className="size-4" />
          Open the help guide
        </a>
        <button
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-action px-4 py-2 text-sm font-extrabold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={busy}
          onClick={() => void finish()}
          type="button"
        >
          {busy ? "Finishing setup…" : "Start using Scht"}
          <ArrowRight aria-hidden="true" className="size-4" />
        </button>
      </div>
      {error ? (
        <p className="mt-4 text-sm font-semibold text-red-800" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
