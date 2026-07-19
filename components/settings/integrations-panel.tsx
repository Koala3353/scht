"use client";

import { useState, type FormEvent } from "react";
import { CalendarDays, Cloud, Link2, RefreshCw } from "lucide-react";

type Notice = { kind: "error" | "success"; text: string } | null;

export function IntegrationsPanel() {
  const [canvasUrl, setCanvasUrl] = useState("");
  const [canvasToken, setCanvasToken] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);

  async function canvas(action: "connect" | "sync", event?: FormEvent) {
    event?.preventDefault();
    setBusy(true);
    setNotice(null);
    const response = await fetch("/api/integrations/canvas", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, baseUrl: canvasUrl, token: canvasToken }),
    });
    const body = (await response.json()) as {
      error?: string;
      courses?: number;
      assignments?: number;
    };
    setNotice(
      response.ok
        ? {
            kind: "success",
            text:
              action === "connect"
                ? `Canvas connected. ${body.courses ?? 0} active courses found.`
                : `Canvas sync complete. ${body.assignments ?? 0} assignments imported.`,
          }
        : { kind: "error", text: body.error ?? "Canvas request failed." },
    );
    setBusy(false);
  }

  async function syncGoogle() {
    setBusy(true);
    setNotice(null);
    const response = await fetch("/api/integrations/google/sync", {
      method: "POST",
    });
    const body = (await response.json()) as {
      error?: string;
      calendarEvents?: number;
      gmailTasks?: number;
    };
    setNotice(
      response.ok
        ? {
            kind: "success",
            text: `Google sync complete. ${body.calendarEvents ?? 0} calendar events and ${body.gmailTasks ?? 0} Gmail tasks imported.`,
          }
        : { kind: "error", text: body.error ?? "Google sync failed." },
    );
    setBusy(false);
  }

  return (
    <section aria-labelledby="connections-heading" id="connections">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold text-teal">Connections</p>
          <h2
            className="mt-1 text-2xl font-black tracking-tight"
            id="connections-heading"
          >
            Import only what helps.
          </h2>
          <p className="mt-2 leading-7 text-slate-700">
            Connections bring useful context into Scht. They never turn your
            workspace into an inbox or a feed.
          </p>
        </div>
        <p className="inline-flex w-fit items-center gap-2 rounded-full bg-[#e6f2f0] px-3 py-2 text-sm font-bold text-teal">
          <Link2 className="size-4" aria-hidden="true" />
          Connect on your terms
        </p>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[.9fr_1.1fr]">
        <article className="rounded-[1.5rem] bg-[#083f42] p-6 text-white shadow-[0_18px_40px_rgba(7,63,66,.16)]">
          <span className="grid size-11 place-items-center rounded-xl bg-white/10 text-[#c7e6dd]">
            <CalendarDays className="size-5" aria-hidden="true" />
          </span>
          <h3 className="mt-7 text-xl font-black">Google Calendar + Gmail</h3>
          <p className="mt-3 max-w-md leading-7 text-[#d7ebe7]">
            Pull upcoming events into Calendar and unread message subjects into
            reviewable planner tasks when you choose to sync.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-white px-4 py-2 font-bold text-[#073f42] transition hover:bg-[#dff0ec]"
              href="/api/integrations/google/start"
            >
              Connect Google
            </a>
            <button
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/25 px-4 py-2 font-bold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={busy}
              onClick={syncGoogle}
              type="button"
            >
              <RefreshCw className="size-4" aria-hidden="true" />
              Sync now
            </button>
          </div>
        </article>

        <article className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm">
          <span className="grid size-11 place-items-center rounded-xl bg-[#f7ebe3] text-action">
            <Cloud className="size-5" aria-hidden="true" />
          </span>
          <h3 className="mt-5 text-xl font-black">Canvas</h3>
          <p className="mt-2 max-w-xl leading-7 text-slate-700">
            Your token is encrypted before it is stored. Active courses are
            matched to your selected term and assignments become useful tasks.
          </p>
          <form
            className="mt-5 grid gap-3 sm:grid-cols-2"
            onSubmit={(event) => void canvas("connect", event)}
          >
            <label className="text-sm font-bold text-ink">
              Canvas base URL
              <input
                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-ink placeholder:text-slate-600 focus:border-teal"
                onChange={(event) => setCanvasUrl(event.target.value)}
                placeholder="https://canvas.example.edu"
                required
                type="url"
                value={canvasUrl}
              />
            </label>
            <label className="text-sm font-bold text-ink">
              Personal API token
              <input
                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-ink focus:border-teal"
                onChange={(event) => setCanvasToken(event.target.value)}
                required
                type="password"
                value={canvasToken}
              />
            </label>
            <div className="flex flex-wrap gap-3 sm:col-span-2">
              <button
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-action px-4 py-2 font-bold text-white transition hover:bg-[#8d3909] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={busy}
                type="submit"
              >
                Connect Canvas
              </button>
              <button
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-teal px-4 py-2 font-bold text-teal transition hover:bg-[#e6f2f0] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={busy}
                onClick={() => void canvas("sync")}
                type="button"
              >
                <RefreshCw className="size-4" aria-hidden="true" />
                Sync assignments
              </button>
            </div>
          </form>
        </article>
      </div>
      {notice && (
        <p
          className={`mt-4 rounded-xl px-4 py-3 text-sm font-semibold ${
            notice.kind === "error"
              ? "bg-red-50 text-red-800"
              : "bg-[#e6f2f0] text-teal"
          }`}
          role="status"
        >
          {notice.text}
        </p>
      )}
    </section>
  );
}
