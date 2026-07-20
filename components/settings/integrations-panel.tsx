"use client";

import { useState, type FormEvent } from "react";
import { useToast } from "../feedback/toast-provider";
import { useRouter } from "next/navigation";
import { CalendarDays, CheckCircle2, Cloud, Link2, RefreshCw, TriangleAlert } from "lucide-react";
import { LocalDateTime } from "../format/local-date-time";
import { gmailTaskFilters } from "../../lib/integrations/gmail-filters";

type Notice = { kind: "error" | "success"; text: string } | null;
type IntegrationConnection = {
  status: string;
  last_synced_at: string | null;
  error_message: string | null;
  settings?: unknown;
} | null;

type ServiceResult = { state: "synced" | "degraded" | "needs_reauth"; imported: number; message: string };
type GoogleSyncResult = { calendar: ServiceResult; gmail: ServiceResult };
type CanvasCourse = { id: string; code: string; name: string; archived_at: string | null; canvas_course_id: string | null };

function settingsRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function isServiceResult(value: unknown): value is ServiceResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (record.state === "synced" || record.state === "degraded" || record.state === "needs_reauth")
    && typeof record.imported === "number"
    && typeof record.message === "string";
}

function googleSyncResult(value: unknown): GoogleSyncResult | null {
  const record = settingsRecord(value);
  const sync = settingsRecord(record.sync);
  return isServiceResult(sync.calendar) && isServiceResult(sync.gmail)
    ? { calendar: sync.calendar, gmail: sync.gmail }
    : null;
}

async function responseBody(response: Response) {
  return (await response.json().catch(() => ({}))) as {
    error?: string;
    courses?: number;
    assignments?: number;
    calendarEvents?: number;
    gmailTasks?: number;
    calendar?: ServiceResult;
    gmail?: ServiceResult;
  };
}

export function IntegrationsPanel({ initialGoogleConnection, initialCanvasConnection, canvasCourses = [] }: { initialGoogleConnection: IntegrationConnection; initialCanvasConnection: IntegrationConnection; canvasCourses?: CanvasCourse[] }) {
  const [canvasUrl, setCanvasUrl] = useState("");
  const [canvasToken, setCanvasToken] = useState("");
  const [googleConnection, setGoogleConnection] = useState(initialGoogleConnection);
  const [canvasConnection, setCanvasConnection] = useState(initialCanvasConnection);
  const { toast } = useToast();
  const router = useRouter();
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);
  const initialGmailFilters = gmailTaskFilters(settingsRecord(initialGoogleConnection?.settings).gmailTaskFilters);
  const [gmailTaskTriggers, setGmailTaskTriggers] = useState(initialGmailFilters.taskTriggers.join("\n"));
  const [gmailExcludedPhrases, setGmailExcludedPhrases] = useState(initialGmailFilters.excludedPhrases.join("\n"));
  const [gmailIncludedCategories, setGmailIncludedCategories] = useState(initialGmailFilters.includedCategories);
  const [savingGmailFilters, setSavingGmailFilters] = useState(false);
  const googleConnected = googleConnection?.status === "connected";
  const canvasConnected = canvasConnection?.status === "connected";
  const googleSync = googleSyncResult(googleConnection?.settings);
  const googleNeedsReconnect = googleConnection?.status === "error" || googleSync?.calendar.state === "needs_reauth" || googleSync?.gmail.state === "needs_reauth";
  const googleRetrying = googleSync?.calendar.state === "degraded" || googleSync?.gmail.state === "degraded";
  const configuredCanvasBaseUrl = settingsRecord(canvasConnection?.settings).baseUrl;
  const canvasBaseUrl = typeof configuredCanvasBaseUrl === "string" ? configuredCanvasBaseUrl : null;
  const canvasHost = canvasBaseUrl ? new URL(canvasBaseUrl).host : null;

  function updateNotice(next: Notice) {
    setNotice(next);
    if (next) toast(next.text, next.kind);
  }

  async function canvas(action: "connect" | "sync", event?: FormEvent) {
    event?.preventDefault();
    setBusy(true);
    updateNotice(null);
    try {
      const response = await fetch("/api/integrations/canvas", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(action === "connect" ? { action, baseUrl: canvasUrl, token: canvasToken } : { action }),
      });
      const body = await responseBody(response);
      const nextNotice = response.ok
        ? { kind: "success" as const, text: action === "connect" ? "Canvas connected. " + (body.courses ?? 0) + " active courses found." : "Canvas sync complete. " + (body.assignments ?? 0) + " assignments imported." }
        : { kind: "error" as const, text: body.error ?? "Canvas request failed." };
      if (response.ok) {
        setCanvasConnection((current) => ({ status: "connected", last_synced_at: new Date().toISOString(), error_message: null, settings: action === "connect" && canvasUrl ? { baseUrl: canvasUrl } : current?.settings }));
        if (action === "connect") { setCanvasToken(""); setCanvasUrl(""); }
      } else if (action === "sync") {
        setCanvasConnection((current) => current ? { ...current, status: "error", error_message: nextNotice.text } : current);
      }
      updateNotice(nextNotice);
    } catch {
      if (action === "sync") setCanvasConnection((current) => current ? { ...current, status: "error", error_message: "Canvas could not be reached. Check your connection and try again." } : current);
      updateNotice({ kind: "error", text: "Canvas could not be reached. Check the URL and try again." });
    } finally {
      setBusy(false);
      router.refresh();
    }
  }

  async function setCanvasCourseVisibility(course: CanvasCourse, hidden: boolean) {
    setBusy(true);
    updateNotice(null);
    try {
      const response = await fetch("/api/subjects/visibility", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subjectId: course.id, hidden }),
      });
      const body = await responseBody(response);
      if (!response.ok) throw new Error(body.error ?? "Could not update this course's visibility.");
      updateNotice({ kind: "success", text: hidden ? `${course.code} is hidden from your active workspace.` : `${course.code} is visible in your active workspace again.` });
    } catch (error) {
      updateNotice({ kind: "error", text: error instanceof Error ? error.message : "Could not update this course's visibility." });
    } finally {
      setBusy(false);
      router.refresh();
    }
  }

  async function syncGoogle() {
    if (!googleConnected) {
      updateNotice({ kind: "error", text: "Connect Google before syncing." });
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/integrations/google/sync", { method: "POST" });
      const body = await responseBody(response);
      if (!response.ok) {
        setGoogleConnection((current) => current ? { ...current, status: "error", error_message: body.error ?? "Google sync failed." } : current);
        return;
      }
      if (!body.calendar || !body.gmail) {
        setGoogleConnection((current) => current ? { ...current, status: "error", error_message: "Google returned an incomplete sync result." } : current);
        return;
      }
      const result: GoogleSyncResult = { calendar: body.calendar, gmail: body.gmail };
      const needsReauth = result.calendar.state === "needs_reauth" || result.gmail.state === "needs_reauth";
      const fullySynced = result.calendar.state === "synced" && result.gmail.state === "synced";
      setGoogleConnection((current) => ({
        ...current,
        status: needsReauth ? "error" : "connected",
        last_synced_at: fullySynced ? new Date().toISOString() : current?.last_synced_at ?? null,
        error_message: needsReauth ? (result.calendar.state === "needs_reauth" ? result.calendar.message : result.gmail.message) : null,
        settings: { ...settingsRecord(current?.settings), sync: result },
      }));
    } catch {
      setGoogleConnection((current) => current ? { ...current, status: "error", error_message: "Google could not be reached. Check your connection and try again." } : current);
    } finally {
      setBusy(false);
      router.refresh();
    }
  }

  function filterLines(value: string) {
    return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  }

  async function saveGmailFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingGmailFilters(true);
    const filters = { taskTriggers: filterLines(gmailTaskTriggers), excludedPhrases: filterLines(gmailExcludedPhrases), includedCategories: gmailIncludedCategories };
    try {
      const response = await fetch("/api/integrations/google/filters", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(filters),
      });
      const body = await responseBody(response);
      if (!response.ok) {
        updateNotice({ kind: "error", text: body.error ?? "Could not save Gmail task filters." });
        return;
      }
      setGoogleConnection((current) => current ? {
        ...current,
        settings: { ...settingsRecord(current.settings), gmailTaskFilters: filters },
      } : current);
      updateNotice({ kind: "success", text: "Gmail task filters saved. They will apply on your next sync." });
    } catch {
      updateNotice({ kind: "error", text: "Gmail task filters could not be saved. Check your connection and try again." });
    } finally {
      setSavingGmailFilters(false);
    }
  }

  const canvasStatus = canvasConnected
    ? { label: "Connected", icon: CheckCircle2, className: "bg-[#e6f2f0] text-teal" }
    : canvasConnection?.status === "error"
      ? { label: "Needs attention", icon: TriangleAlert, className: "bg-[#fff0eb] text-[#a94712]" }
      : { label: "Not connected", icon: Link2, className: "bg-[#eef3f2] text-slate-700" };
  const CanvasStatusIcon = canvasStatus.icon;

  const googleStatus = googleConnected
    ? { label: "Connected", icon: CheckCircle2, className: "bg-[#dff2ed] text-[#075e60]" }
    : googleConnection?.status === "error"
      ? { label: "Needs attention", icon: TriangleAlert, className: "bg-[#fff0eb] text-[#a94712]" }
      : { label: "Not connected", icon: Link2, className: "bg-white/10 text-[#d7ebe7]" };
  const GoogleStatusIcon = googleStatus.icon;

  return (
    <section aria-labelledby="connections-heading" id="connections">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold text-teal">Connections</p>
          <h2 className="mt-1 text-2xl font-black tracking-tight" id="connections-heading">Import only what helps.</h2>
          <p className="mt-2 leading-7 text-slate-700">Connections bring useful context into Scht. They never turn your workspace into an inbox or a feed.</p>
        </div>
        <p className="inline-flex w-fit items-center gap-2 rounded-full bg-[#e6f2f0] px-3 py-2 text-sm font-bold text-teal"><Link2 className="size-4" aria-hidden="true" />Connect on your terms</p>
      </div>

      <div className="mt-6 grid gap-5">
        <article className="rounded-[1.5rem] bg-[#083f42] p-6 text-white shadow-[0_18px_40px_rgba(7,63,66,.16)]">
          <span className="grid size-11 place-items-center rounded-xl bg-white/10 text-[#c7e6dd]"><CalendarDays className="size-5" aria-hidden="true" /></span>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <h3 className="text-xl font-black">Google Calendar + Gmail</h3>
            <span className={"inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold " + googleStatus.className}><GoogleStatusIcon className="size-3.5" aria-hidden="true" />{googleStatus.label}</span>
          </div>
          <p className="mt-3 max-w-md leading-7 text-[#d7ebe7]">
            {googleConnected
              ? "Google is linked. Sync whenever you want to refresh upcoming Calendar events and unread Gmail review tasks."
              : "Pull upcoming events into Calendar and unread message subjects into reviewable planner tasks when you choose to sync."}
          </p>
          {(googleConnection?.last_synced_at || googleSync) && <p className="mt-3 rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold leading-6 text-[#d7ebe7]" role={googleNeedsReconnect ? "alert" : "status"}>{googleConnection?.last_synced_at ? <>Last successful sync <LocalDateTime value={googleConnection.last_synced_at} />. </> : null}{googleSync ? <>Calendar: {googleSync.calendar.message} Gmail: {googleSync.gmail.message}</> : "Google sync complete."}</p>}
          {googleConnection?.status === "error" && googleConnection.error_message && !googleSync && <p className="mt-3 rounded-xl bg-[#fff0eb] px-3 py-2 text-sm font-semibold leading-6 text-[#702906]" role="alert">{googleConnection.error_message}</p>}
          <div className="mt-7 flex flex-wrap gap-3">
            {(!googleConnected || googleNeedsReconnect) && <a className="inline-flex min-h-11 items-center justify-center rounded-xl bg-white px-4 py-2 font-bold text-[#073f42] transition hover:bg-[#dff0ec]" href="/api/integrations/google/start">{googleConnection ? "Reconnect Google" : "Connect Google"}</a>}
            <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/25 px-4 py-2 font-bold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60" disabled={busy || !googleConnected} onClick={() => void syncGoogle()} type="button"><RefreshCw className="size-4" aria-hidden="true" />{busy ? "Syncing…" : googleRetrying ? "Retry Gmail" : "Sync now"}</button>
          </div>
          <form className="mt-6 rounded-2xl border border-white/15 bg-white/5 p-4" onSubmit={(event) => void saveGmailFilters(event)}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div><h4 className="font-bold">Gmail task filters</h4><p className="mt-1 text-sm leading-6 text-[#d7ebe7]">Only unread inbox messages matching a trigger become tasks. Choose whether Promotions, Social, or Updates can qualify; spam and trash are always skipped.</p></div>
              <span className="text-xs font-bold text-[#c7e6dd]">Editable per account</span>
            </div>
            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              <label className="text-sm font-bold text-white">Task triggers <span className="font-normal text-[#d7ebe7]">(one phrase per line)</span><textarea className="mt-1.5 min-h-36 w-full rounded-xl border border-white/20 bg-[#073f42] px-3 py-2 text-sm text-white placeholder:text-[#b8d2cd] focus:border-[#c7e6dd]" disabled={savingGmailFilters || !googleConnected} onChange={(event) => setGmailTaskTriggers(event.target.value)} value={gmailTaskTriggers} /></label>
              <label className="text-sm font-bold text-white">Never create a task when it contains <span className="font-normal text-[#d7ebe7]">(one phrase per line)</span><textarea className="mt-1.5 min-h-36 w-full rounded-xl border border-white/20 bg-[#073f42] px-3 py-2 text-sm text-white placeholder:text-[#b8d2cd] focus:border-[#c7e6dd]" disabled={savingGmailFilters || !googleConnected} onChange={(event) => setGmailExcludedPhrases(event.target.value)} value={gmailExcludedPhrases} /></label>
            </div>
            <div className="mt-4 flex flex-col gap-3 border-t border-white/15 pt-4 lg:flex-row lg:items-end lg:justify-between"><fieldset><legend className="text-sm font-bold text-white">Inbox categories allowed to create tasks</legend><div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-[#d7ebe7]">{([['promotions', 'Promotions'], ['social', 'Social'], ['updates', 'Updates']] as const).map(([category, label]) => <label className="inline-flex min-h-11 items-center gap-2" key={category}><input checked={gmailIncludedCategories[category]} className="size-4 accent-[#dff0ec]" disabled={savingGmailFilters || !googleConnected} onChange={(event) => setGmailIncludedCategories((current) => ({ ...current, [category]: event.target.checked }))} type="checkbox" />{label}</label>)}</div></fieldset><button className="inline-flex min-h-11 items-center justify-center rounded-xl bg-white px-4 py-2 text-sm font-bold text-[#073f42] transition hover:bg-[#dff0ec] disabled:cursor-not-allowed disabled:opacity-60" disabled={savingGmailFilters || !googleConnected} type="submit">{savingGmailFilters ? "Saving filters…" : "Save Gmail filters"}</button></div>
          </form>
        </article>

        <article className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm">
          <span className="grid size-11 place-items-center rounded-xl bg-[#f7ebe3] text-action"><Cloud className="size-5" aria-hidden="true" /></span>
          <div className="mt-5 flex flex-wrap items-center gap-3"><h3 className="text-xl font-black">Canvas</h3><span className={"inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold " + canvasStatus.className}><CanvasStatusIcon className="size-3.5" aria-hidden="true" />{canvasStatus.label}</span></div>
          <p className="mt-2 max-w-xl leading-7 text-slate-700">{canvasHost ? "Connected securely to " + canvasHost + ". " : ""}Your token is encrypted before it is stored and is never shown again. Active courses are matched to your selected term and assignments become useful tasks.</p>{canvasConnected && canvasConnection?.last_synced_at ? <p className="mt-3 text-sm font-semibold text-teal">Last checked <LocalDateTime value={canvasConnection.last_synced_at} />.</p> : null}{canvasConnection?.status === "error" && canvasConnection.error_message ? <p className="mt-3 rounded-xl bg-[#fff0eb] px-3 py-2 text-sm font-semibold leading-6 text-[#702906]">{canvasConnection.error_message}</p> : null}
          <form className="mt-5 grid gap-4 md:grid-cols-2" onSubmit={(event) => void canvas("connect", event)}>
            <label className="text-sm font-bold text-ink">Canvas base URL{canvasConnection ? " (enter only to replace)" : ""}<input autoCapitalize="none" autoCorrect="off" className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-ink placeholder:text-slate-600 focus:border-teal" inputMode="url" onChange={(event) => setCanvasUrl(event.target.value)} placeholder="https://canvas.example.edu" required spellCheck={false} type="url" value={canvasUrl} /></label>
            <label className="text-sm font-bold text-ink">Personal API token{canvasConnection ? " (enter only to replace)" : ""}<input autoCapitalize="none" autoComplete="off" autoCorrect="off" className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-ink focus:border-teal" maxLength={4096} onChange={(event) => setCanvasToken(event.target.value)} required spellCheck={false} type="password" value={canvasToken} /></label>
            <div className="flex flex-wrap gap-3 md:col-span-2"><button className="inline-flex min-h-11 items-center justify-center rounded-xl bg-action px-4 py-2 font-bold text-white transition hover:bg-[#8d3909] disabled:cursor-not-allowed disabled:opacity-60" disabled={busy} type="submit">{canvasConnection ? "Reconnect Canvas" : "Connect Canvas"}</button><button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-teal px-4 py-2 font-bold text-teal transition hover:bg-[#e6f2f0] disabled:cursor-not-allowed disabled:opacity-60" disabled={busy || !canvasConnected} onClick={() => void canvas("sync")} type="button"><RefreshCw className="size-4" aria-hidden="true" />Sync assignments</button></div>
          </form>
          {canvasCourses.length > 0 && <section className="mt-6 border-t border-slate-200 pt-5" aria-labelledby="canvas-course-visibility"><div className="flex flex-wrap items-baseline justify-between gap-2"><div><h4 className="font-bold text-ink" id="canvas-course-visibility">Canvas course visibility</h4><p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">Hide old or irrelevant courses without deleting their grade history. Hidden Canvas courses and their tasks stay out of your active pages and future syncs.</p></div><span className="text-xs font-bold text-slate-500">Restorable anytime</span></div><ul className="mt-4 divide-y divide-slate-200 rounded-xl border border-slate-200">{canvasCourses.map((course) => { const hidden = Boolean(course.archived_at); return <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3" key={course.id}><div><p className="font-bold text-ink">{course.code} <span className="font-normal text-slate-600">· {course.name}</span></p><p className={hidden ? "mt-1 text-xs font-bold text-slate-500" : "mt-1 text-xs font-bold text-teal"}>{hidden ? "Hidden from active pages" : "Visible in active pages"}</p></div><button className="inline-flex min-h-10 items-center justify-center rounded-lg border border-teal px-3 text-sm font-bold text-teal transition hover:bg-[#e6f2f0] disabled:cursor-not-allowed disabled:opacity-60" disabled={busy} onClick={() => void setCanvasCourseVisibility(course, !hidden)} type="button">{hidden ? "Show course" : "Hide course"}</button></li>; })}</ul></section>}
        </article>
      </div>
      {notice && <p className={"mt-4 rounded-xl px-4 py-3 text-sm font-semibold " + (notice.kind === "error" ? "bg-red-50 text-red-800" : "bg-[#e6f2f0] text-teal")} role={notice.kind === "error" ? "alert" : "status"}>{notice.text}</p>}
    </section>
  );
}
