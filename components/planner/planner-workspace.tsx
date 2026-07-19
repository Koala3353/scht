"use client";

import { useMemo, useState } from "react";
import { FilterX, ListFilter } from "lucide-react";

export type PlannerTask = {
  id: string;
  title: string;
  source: string;
  priority: "low" | "normal" | "high";
  dueAt: string | null;
  subjectId: string | null;
  subjectLabel: string | null;
  termId: string | null;
  termLabel: string | null;
  projectLabel: string | null;
};

const sourceLabel = (source: string) => source === "google_calendar" ? "Google Calendar" : source === "gmail" ? "Gmail" : source === "canvas" ? "Canvas" : source === "ai" ? "AI proposal" : source === "manual" ? "Manual" : source;

export function PlannerWorkspace({ tasks }: { tasks: PlannerTask[] }) {
  const [source, setSource] = useState("all");
  const [priority, setPriority] = useState("all");
  const [subject, setSubject] = useState("all");
  const [term, setTerm] = useState("all");
  const sources = useMemo(() => [...new Set(tasks.map((task) => task.source))].sort(), [tasks]);
  const subjects = useMemo(() => [...new Map(tasks.filter((task) => task.subjectId && task.subjectLabel).map((task) => [task.subjectId!, task.subjectLabel!])).entries()], [tasks]);
  const terms = useMemo(() => [...new Map(tasks.filter((task) => task.termId && task.termLabel).map((task) => [task.termId!, task.termLabel!])).entries()], [tasks]);
  const visible = tasks.filter((task) => (source === "all" || task.source === source) && (priority === "all" || task.priority === priority) && (subject === "all" || task.subjectId === subject) && (term === "all" || task.termId === term));
  const filtered = [source, priority, subject, term].some((value) => value !== "all");

  return <section className="mx-auto mt-6 max-w-5xl px-4 sm:px-0">
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><ListFilter className="size-4 text-teal" aria-hidden="true" /><h2 className="font-bold text-ink">Filter your plan</h2></div><p className="text-sm text-slate-600">{visible.length} of {tasks.length} open tasks</p></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm font-semibold text-ink">Source<select className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-ink" value={source} onChange={(event) => setSource(event.target.value)}><option value="all">All sources</option>{sources.map((value) => <option key={value} value={value}>{sourceLabel(value)}</option>)}</select></label>
        <label className="text-sm font-semibold text-ink">Priority<select className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-ink" value={priority} onChange={(event) => setPriority(event.target.value)}><option value="all">All priorities</option><option value="high">High</option><option value="normal">Normal</option><option value="low">Low</option></select></label>
        <label className="text-sm font-semibold text-ink">Subject<select className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-ink" value={subject} onChange={(event) => setSubject(event.target.value)}><option value="all">All subjects</option>{subjects.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
        <label className="text-sm font-semibold text-ink">Term<select className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-ink" value={term} onChange={(event) => setTerm(event.target.value)}><option value="all">All terms</option>{terms.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
      </div>
      {filtered && <button className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-bold text-teal hover:bg-[#e6f2f0]" type="button" onClick={() => { setSource("all"); setPriority("all"); setSubject("all"); setTerm("all"); }}><FilterX className="size-4" aria-hidden="true" />Clear filters</button>}
    </div>
    <ol className="mt-5 space-y-3">{visible.map((task) => <li className="rounded-2xl border border-slate-200 bg-white p-4" key={task.id}><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-bold text-ink">{task.title}</h3><p className="mt-1 text-sm text-slate-600">{sourceLabel(task.source)} · {task.priority} priority{task.subjectLabel ? ` · ${task.subjectLabel}` : ""}{task.projectLabel ? ` · ${task.projectLabel}` : ""}</p></div><time className="text-sm font-semibold text-teal" dateTime={task.dueAt ?? undefined}>{task.dueAt ? new Date(task.dueAt).toLocaleString() : "No due date"}</time></div></li>)}</ol>
    {!visible.length && <p className="mt-5 rounded-xl bg-[#f7faf9] p-4 text-sm text-slate-700">No open tasks match these filters.</p>}
  </section>;
}
