"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, CheckCircle2, Circle, Clock3, ExternalLink, ListChecks, Play, Sparkles, TimerReset } from "lucide-react";
import { useRouter } from "next/navigation";

import { saveTaskRemotely } from "@/lib/sync/task-client";
import type { CachedTask } from "@/lib/sync/types";
import { createClient } from "@/lib/supabase/client";
import { PriorityBadge } from "../tasks/priority-visual";

export type TaskSubtask = {
  id: string;
  title: string;
  position: number;
  estimated_minutes: number | null;
  completed_at: string | null;
};

type FocusSession = {
  id: string;
  planned_minutes: number;
  started_at: string;
  status: "active" | "completed" | "cancelled";
};

function checklistDraft(description: string, title: string) {
  const extracted = description
    .split(/\n|(?<=[.!?])\s+/)
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
    .filter((line) => line.length >= 12)
    .slice(0, 6);
  return extracted.length ? extracted : [
    `Read the brief for ${title} and note the exact deliverable.`,
    "Gather the materials, references, or course notes you need.",
    "Create a first working draft or solve the first section.",
    "Review against the requirements and submit or prepare the next step.",
  ];
}

function durationLabel(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export function TaskWorkspace({
  task: initialTask,
  userId,
  subjectLabel,
  subtasks: initialSubtasks,
  activeSession: initialSession,
  relatedTasks,
}: {
  task: CachedTask;
  userId: string;
  subjectLabel: string | null;
  subtasks: TaskSubtask[];
  activeSession: FocusSession | null;
  relatedTasks: Array<{ id: string; title: string; dueAt: string | null; source: string }>;
}) {
  const router = useRouter();
  const [task, setTask] = useState(initialTask);
  const [subtasks, setSubtasks] = useState(initialSubtasks);
  const [newSubtask, setNewSubtask] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const [session, setSession] = useState<FocusSession | null>(initialSession);
  const [now, setNow] = useState(0);
  const completedSubtasks = subtasks.filter((subtask) => subtask.completed_at).length;
  const remainingSeconds = useMemo(() => session ? (now ? Math.max(0, Math.round((new Date(session.started_at).getTime() + session.planned_minutes * 60_000 - now) / 1000)) : session.planned_minutes * 60) : 0, [now, session]);

  useEffect(() => {
    if (!session) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [session]);

  async function completeTask() {
    setBusy(true); setNotice("");
    try {
      const saved = await saveTaskRemotely(userId, { ...task, completedAt: task.completedAt ? null : new Date().toISOString(), updatedAt: new Date().toISOString() }, task.updatedAt);
      setTask(saved);
      if (!saved.completedAt) setNotice("Task reopened.");
      else {
        setCelebrating(true);
        setNotice("Done. That work is off your plate.");
        window.setTimeout(() => setCelebrating(false), 850);
      }
      router.refresh();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not update this task."); }
    finally { setBusy(false); }
  }

  async function addSubtask(title = newSubtask) {
    const trimmed = title.trim(); if (!trimmed) return;
    setBusy(true); setNotice("");
    const supabase = createClient();
    const { data, error } = await supabase.from("task_subtasks").insert({ user_id: userId, task_id: task.id, title: trimmed, position: subtasks.length, estimated_minutes: null }).select("id,title,position,estimated_minutes,completed_at").single();
    if (error || !data) setNotice(error?.message ?? "Could not add that checklist step.");
    else { setSubtasks((current) => [...current, data as TaskSubtask]); setNewSubtask(""); }
    setBusy(false);
  }

  async function toggleSubtask(subtask: TaskSubtask) {
    setBusy(true); setNotice("");
    const nextCompletedAt = subtask.completed_at ? null : new Date().toISOString();
    const { error } = await createClient().from("task_subtasks").update({ completed_at: nextCompletedAt }).eq("id", subtask.id).eq("user_id", userId);
    if (error) setNotice(error.message);
    else setSubtasks((current) => current.map((item) => item.id === subtask.id ? { ...item, completed_at: nextCompletedAt } : item));
    setBusy(false);
  }

  async function makeChecklist() {
    if (subtasks.length && !window.confirm("Add a drafted checklist below your existing steps?")) return;
    for (const line of checklistDraft(task.description, task.title)) await addSubtask(line);
    setNotice("Checklist draft added. Edit the steps until they match your work.");
  }

  async function startFocus(minutes: 25 | 50) {
    setBusy(true); setNotice("");
    const { data, error } = await createClient().from("focus_sessions").insert({ user_id: userId, task_id: task.id, planned_minutes: minutes }).select("id,planned_minutes,started_at,status").single();
    if (error || !data) setNotice(error?.message ?? "Could not start a focus session.");
    else { setSession(data as FocusSession); setNow(Date.now()); setNotice(`${minutes}-minute focus session started.`); }
    setBusy(false);
  }

  async function finishFocus(status: "completed" | "cancelled") {
    if (!session) return;
    setBusy(true);
    const { error } = await createClient().from("focus_sessions").update({ status, ended_at: new Date().toISOString() }).eq("id", session.id).eq("user_id", userId);
    if (error) setNotice(error.message); else { setSession(null); setNotice(status === "completed" ? "Focus block saved. Pick the next step when you are ready." : "Focus block paused."); }
    setBusy(false);
  }

  return <div className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(18rem,.7fr)]">
    <div className="space-y-6">
      <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-semibold text-teal">Assignment workspace</p><div className="mt-2 flex flex-wrap items-center gap-2">{subjectLabel ? <span className="rounded-lg bg-[#e6f2f0] px-2 py-1 text-xs font-bold text-teal">{subjectLabel}</span> : null}<PriorityBadge priority={task.priority} />{task.weightPercent !== null ? <span className="rounded-lg bg-[#f7ebe3] px-2 py-1 text-xs font-bold text-action">Grade impact · {task.weightPercent}%</span> : null}</div></div><button aria-busy={busy} className={`task-complete-button inline-flex min-h-12 items-center gap-2 rounded-xl px-4 py-2 font-black text-white shadow-sm disabled:opacity-60 ${task.completedAt ? "bg-slate-600" : "bg-teal"} ${celebrating ? "task-complete-button--celebrate" : ""}`} disabled={busy} onClick={() => void completeTask()} type="button">{task.completedAt ? <><TimerReset className="size-5" />Reopen task</> : <><CheckCircle2 className="size-5" />Mark as done</>}</button></div>
        {task.description ? <p className="mt-6 whitespace-pre-wrap leading-7 text-slate-700">{task.description}</p> : <p className="mt-6 rounded-xl bg-[#f7faf9] p-4 text-sm leading-6 text-slate-600">No written brief was imported. Add the exact requirements in the task editor or open its source below.</p>}
        {task.links.length ? <div className="mt-5 flex flex-wrap gap-2">{task.links.map((link, index) => <a className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-teal/30 px-3 text-sm font-bold text-teal hover:bg-[#e6f2f0]" href={link} key={link} rel="noreferrer" target="_blank">{index === 0 && task.source === "canvas" ? "Open in Canvas" : "Open source"}<ExternalLink aria-hidden="true" className="size-3.5" /></a>)}</div> : null}
      </section>

      <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-semibold text-teal">Break it down</p><h2 className="mt-1 text-xl font-black tracking-tight">A checklist you can finish.</h2></div><button className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-teal px-3 text-sm font-bold text-teal hover:bg-[#e6f2f0] disabled:opacity-60" disabled={busy} onClick={() => void makeChecklist()} type="button"><Sparkles className="size-4" />Draft from brief</button></div><p className="mt-2 text-sm leading-6 text-slate-600">{subtasks.length ? `${completedSubtasks} of ${subtasks.length} steps complete.` : "Add your own first step, or create a starting checklist from the assignment text."}</p><div className="mt-4 space-y-2">{subtasks.map((subtask) => <button className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-slate-200 px-3 text-left hover:border-teal/40 hover:bg-[#f7faf9] disabled:opacity-60" disabled={busy} key={subtask.id} onClick={() => void toggleSubtask(subtask)} type="button">{subtask.completed_at ? <Check aria-hidden="true" className="size-5 text-teal" /> : <Circle aria-hidden="true" className="size-5 text-slate-400" />}<span className={`flex-1 text-sm font-semibold ${subtask.completed_at ? "text-slate-500 line-through" : "text-ink"}`}>{subtask.title}</span>{subtask.estimated_minutes ? <span className="text-xs font-bold text-slate-500">{subtask.estimated_minutes} min</span> : null}</button>)}</div><form className="mt-4 flex gap-2" onSubmit={(event) => { event.preventDefault(); void addSubtask(); }}><label className="sr-only" htmlFor="new-subtask">Add a checklist step</label><input className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-300 px-3" id="new-subtask" maxLength={240} onChange={(event) => setNewSubtask(event.target.value)} placeholder="Add the next concrete step" value={newSubtask} /><button className="min-h-11 rounded-xl bg-teal px-4 text-sm font-bold text-white disabled:opacity-60" disabled={busy || !newSubtask.trim()} type="submit">Add</button></form></section>
    </div>
    <aside className="space-y-6">
      <section className="rounded-[1.5rem] bg-[#073f42] p-5 text-white shadow-[0_16px_34px_rgba(7,63,66,.16)]"><p className="flex items-center gap-2 text-sm font-bold text-[#c7e6dd]"><Clock3 className="size-4" />Focus session</p><h2 className="mt-2 text-xl font-black">{session ? durationLabel(remainingSeconds) : "Make time for it."}</h2><p className="mt-2 text-sm leading-6 text-[#d7ebe7]">{session ? `${session.planned_minutes}-minute block in progress. Keep the next checklist step small.` : "Start a quiet block from this task. Scht saves the session to your workspace."}</p>{session ? <div className="mt-5 flex gap-2"><button className="min-h-11 flex-1 rounded-xl bg-white px-3 text-sm font-black text-teal disabled:opacity-60" disabled={busy} onClick={() => void finishFocus("completed")} type="button">Finish block</button><button className="min-h-11 rounded-xl border border-white/25 px-3 text-sm font-bold text-white disabled:opacity-60" disabled={busy} onClick={() => void finishFocus("cancelled")} type="button">Pause</button></div> : <div className="mt-5 grid grid-cols-2 gap-2"><button className="min-h-11 rounded-xl bg-white px-3 text-sm font-black text-teal disabled:opacity-60" disabled={busy} onClick={() => void startFocus(25)} type="button"><Play className="mr-1 inline size-4" />25 min</button><button className="min-h-11 rounded-xl border border-white/25 px-3 text-sm font-bold text-white disabled:opacity-60" disabled={busy} onClick={() => void startFocus(50)} type="button"><Play className="mr-1 inline size-4" />50 min</button></div>}</section>
      <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-semibold text-teal">Connected context</p><h2 className="mt-1 text-lg font-black">Everything tied to this work.</h2><dl className="mt-4 space-y-3 text-sm"><div className="flex justify-between gap-4"><dt className="text-slate-600">Source</dt><dd className="font-bold capitalize text-ink">{task.source.replace("_", " ")}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-600">Due</dt><dd className="text-right font-bold text-ink">{task.dueAt ? new Date(task.dueAt).toLocaleString() : "No deadline"}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-600">Effort</dt><dd className="font-bold text-ink">{task.effortMinutes ? `${task.effortMinutes} min` : "Not estimated"}</dd></div></dl><a className="mt-5 inline-flex min-h-10 items-center gap-2 text-sm font-bold text-teal underline underline-offset-4" href="/ai"><Sparkles className="size-4" />Ask AI with this context</a></section>
      <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-semibold text-teal">Related work</p><h2 className="mt-1 text-lg font-black">Same subject, next up.</h2>{relatedTasks.length ? <ul className="mt-4 space-y-3">{relatedTasks.map((related) => <li key={related.id}><a className="block rounded-xl bg-[#f7faf9] p-3 text-sm font-bold text-ink hover:bg-[#e6f2f0]" href={`/assignments/${related.id}`}>{related.title}<span className="mt-1 block text-xs font-semibold text-slate-600">{related.dueAt ? new Date(related.dueAt).toLocaleDateString() : "No deadline"} · {related.source.replace("_", " ")}</span></a></li>)}</ul> : <p className="mt-3 text-sm leading-6 text-slate-600">No related open work has been linked yet.</p>}</section>
    </aside>
    {notice ? <p className="xl:col-span-2 rounded-xl bg-[#e6f2f0] px-4 py-3 text-sm font-semibold text-teal" role="status"><ListChecks className="mr-2 inline size-4" />{notice}</p> : null}
  </div>;
}
