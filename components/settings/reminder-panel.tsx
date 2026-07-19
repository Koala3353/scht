"use client";

import { useState, type FormEvent } from "react";
import { BellRing, Clock3, MailCheck, Sparkles } from "lucide-react";
import { useToast } from "../feedback/toast-provider";

type Task = { id: string; title: string; due_at: string | null };
type Preference = {
  timezone: string;
  quiet_start: string | null;
  quiet_end: string | null;
  enabled: boolean;
  digest_window_days: number | null;
  digest_enabled: boolean | null;
  digest_time: string | null;
  digest_frequency: "daily" | "weekly" | null;
  digest_weekday: number | null;
} | null;

export function ReminderPanel({
  preference,
  tasks,
}: {
  preference: Preference;
  tasks: Task[];
}) {
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(preference?.enabled ?? true);
  const [digestEnabled, setDigestEnabled] = useState(preference?.digest_enabled ?? false);
  const [digestFrequency, setDigestFrequency] = useState<"daily" | "weekly">(preference?.digest_frequency === "weekly" ? "weekly" : "daily");
  const [digestWindowDays, setDigestWindowDays] = useState(preference?.digest_window_days ?? 3);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    const response = await fetch("/api/reminders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        enabled,
        timezone: form.get("timezone"),
        quietStart: form.get("quietStart") || null,
        quietEnd: form.get("quietEnd") || null,
        digestWindowDays,
        digestEnabled,
        digestTime: form.get("digestTime"),
        digestFrequency,
        digestWeekday: Number(form.get("digestWeekday") ?? preference?.digest_weekday ?? 1),
      }),
    });
    const body = (await response.json()) as { error?: string };
    const message = response.ok ? "Reminder preferences and your email timeline are saved." : (body.error ?? "Could not save preferences.");
    setNotice(message);
    toast(message, response.ok ? "success" : "error");
    setBusy(false);
  }

  async function queue(taskId: string) {
    setBusy(true);
    const response = await fetch("/api/reminders", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ taskId }),
    });
    const body = (await response.json()) as { error?: string; sendAt?: string };
    const message = response.ok ? "Reminder scheduled for " + (body.sendAt ? new Date(body.sendAt).toLocaleString() : "your task deadline") + "." : (body.error ?? "Could not schedule reminder.");
    setNotice(message);
    toast(message, response.ok ? "success" : "error");
    setBusy(false);
  }

  return (
    <section aria-labelledby="reminders-heading" id="reminders">
      <div className="grid gap-7 rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm lg:grid-cols-[.8fr_1.2fr] lg:p-7">
        <div>
          <span className="grid size-11 place-items-center rounded-xl bg-[#f7ebe3] text-action">
            <BellRing className="size-5" aria-hidden="true" />
          </span>
          <p className="mt-5 text-sm font-semibold text-teal">Reminders</p>
          <h2 className="mt-1 text-2xl font-black tracking-tight" id="reminders-heading">
            Let the right prompt arrive.
          </h2>
          <p className="mt-3 max-w-md leading-7 text-slate-700">
            Schedule task reminders when you need them, or opt into a calm daily or weekly update. Each email draws only from Calendar, Gmail, Canvas, and tasks already imported into Scht.
          </p>
          <div className="mt-5 flex items-start gap-3 rounded-xl bg-[#f7faf9] p-4 text-sm leading-6 text-slate-700">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-teal" aria-hidden="true" />
            <p><strong className="text-ink">Your connections stay scoped.</strong> The digest only summarises items already imported into your workspace; it never grants Apps Script access to your Google or Canvas accounts.</p>
          </div>
        </div>

        <form className="grid content-start gap-4 sm:grid-cols-2" onSubmit={save}>
          <label className="text-sm font-bold text-ink sm:col-span-2">
            Time zone
            <input className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-ink focus:border-teal" defaultValue={preference?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone} name="timezone" required />
          </label>
          <label className="text-sm font-bold text-ink">
            Quiet hours start
            <input className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-ink focus:border-teal" defaultValue={preference?.quiet_start?.slice(0, 5) ?? ""} name="quietStart" type="time" />
          </label>
          <label className="text-sm font-bold text-ink">
            Quiet hours end
            <input className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-ink focus:border-teal" defaultValue={preference?.quiet_end?.slice(0, 5) ?? ""} name="quietEnd" type="time" />
          </label>
          <label className="text-sm font-bold text-ink sm:col-span-2">
            Email timeline
            <select className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-ink focus:border-teal" name="digestWindowDays" onChange={(event) => setDigestWindowDays(Number(event.target.value))} value={String(digestWindowDays)}>
              <option value="1">Next day</option>
              <option value="3">Next 3 days</option>
              <option value="7">Next 7 days</option>
              <option value="14">Next 14 days</option>
            </select>
            <span className="mt-1.5 block text-xs font-normal leading-5 text-slate-600">Used in scheduled reminders and your optional update. Choose how far ahead it looks; the email combines imported Calendar events, Canvas deadlines, Gmail follow-ups, and your own due-dated tasks.</span>
          </label>
          <div className="rounded-xl bg-[#f7faf9] p-3 sm:col-span-2">
            <label className="flex min-h-11 items-center gap-3 text-sm font-bold text-ink">
              <input checked={digestEnabled} className="size-4 accent-[#075e60]" onChange={(event) => setDigestEnabled(event.target.checked)} type="checkbox" />
              Send a scheduled email update
            </label>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-bold text-ink">Cadence
                <select className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-ink disabled:opacity-60" disabled={!digestEnabled} name="digestFrequency" onChange={(event) => { const next = event.target.value === "weekly" ? "weekly" : "daily"; setDigestFrequency(next); if (next === "weekly" && digestWindowDays < 7) setDigestWindowDays(7); }} value={digestFrequency}>
                  <option value="daily">Daily update</option>
                  <option value="weekly">Weekly update</option>
                </select>
              </label>
              <label className="block text-sm font-bold text-ink">Delivery time
                <input className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-ink disabled:opacity-60" defaultValue={preference?.digest_time?.slice(0, 5) ?? "07:00"} disabled={!digestEnabled} name="digestTime" type="time" />
              </label>
            </div>
            {digestFrequency === "weekly" && (
              <label className="mt-3 block text-sm font-bold text-ink">Weekly delivery day
                <select className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-ink disabled:opacity-60" defaultValue={String(preference?.digest_weekday ?? 1)} disabled={!digestEnabled} name="digestWeekday">
                  <option value="1">Monday</option><option value="2">Tuesday</option><option value="3">Wednesday</option><option value="4">Thursday</option><option value="5">Friday</option><option value="6">Saturday</option><option value="0">Sunday</option>
                </select>
              </label>
            )}
            <p className="mt-2 text-xs font-normal leading-5 text-slate-600">Daily sends one concise outlook each day. Weekly sends one seven- or fourteen-day update on the day you choose, always in your selected time zone.</p>
          </div>
          <label className="flex min-h-11 items-center gap-3 rounded-xl bg-[#f7faf9] px-3 text-sm font-bold text-ink sm:col-span-2">
            <input checked={enabled} className="size-4 accent-[#075e60]" onChange={(event) => setEnabled(event.target.checked)} type="checkbox" />
            Enable email reminders
          </label>
          <button className="inline-flex min-h-11 items-center justify-center rounded-xl border border-teal px-4 py-2 font-bold text-teal transition hover:bg-[#e6f2f0] disabled:cursor-not-allowed disabled:opacity-60 sm:col-span-2" disabled={busy} type="submit">
            Save delivery preferences
          </button>
        </form>
      </div>

      <div className="mt-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-teal">Ready to schedule</p>
            <h3 className="mt-1 text-xl font-black tracking-tight">Due-dated tasks</h3>
          </div>
          <MailCheck className="size-5 text-teal" aria-hidden="true" />
        </div>
        {tasks.length ? (
          <ul className="mt-4 divide-y divide-slate-200 border-y border-slate-200">
            {tasks.map((task) => (
              <li className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between" key={task.id}>
                <div>
                  <p className="font-bold text-ink">{task.title}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600"><Clock3 className="size-4" aria-hidden="true" />Due {task.due_at ? new Date(task.due_at).toLocaleString() : "unscheduled"}</p>
                </div>
                <button className="inline-flex min-h-11 items-center justify-center rounded-xl bg-teal px-4 py-2 text-sm font-bold text-white transition hover:bg-[#064c4e] disabled:cursor-not-allowed disabled:opacity-60" disabled={busy || !enabled} onClick={() => void queue(task.id)} type="button">
                  Schedule reminder
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 rounded-xl bg-[#f7faf9] px-4 py-4 text-sm leading-6 text-slate-700">No open tasks with due dates are ready to schedule yet.</p>
        )}
      </div>
      {notice && <p className="mt-4 rounded-xl bg-[#e6f2f0] px-4 py-3 text-sm font-semibold text-teal" role="status">{notice}</p>}
    </section>
  );
}
