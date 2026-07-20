"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useToast } from "../feedback/toast-provider";
import { Archive, FolderPlus, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import type { CachedTask } from "../../lib/sync/types";

type Project = { id: string; name: string; status: "active" | "archived" };

export function WorkManager({ initialProjects, tasks, onSaveTask }: { initialProjects: Project[]; tasks: CachedTask[]; onSaveTask: (task: CachedTask, baseUpdatedAt: string | null) => Promise<void> }) {
  const router = useRouter();
  const { toast } = useToast();
  const [projects, setProjects] = useState(initialProjects);
  const [name, setName] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!notice) return;
    toast(notice, /could not|failed|did not|error|blocked/i.test(notice) ? "error" : "success");
  }, [notice, toast]);

  async function request(method: "POST" | "PATCH", body: Record<string, unknown>) {
    const response = await fetch("/api/projects", { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json() as { error?: string; project?: Project };
    if (!response.ok) throw new Error(result.error ?? "Could not save the project.");
    return result;
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;
    setBusy(true); setNotice("");
    try { const result = await request("POST", { name }); if (result.project) setProjects((current) => [...current, result.project!]); setName(""); setNotice("Project created."); router.refresh(); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Could not create the project."); }
    setBusy(false);
  }

  async function update(projectId: string, changes: Record<string, unknown>) {
    setBusy(true); setNotice("");
    try { const result = await request("PATCH", { projectId, ...changes }); if (result.project) setProjects((current) => current.map((project) => project.id === projectId ? result.project! : project)); setNotice("Project updated."); router.refresh(); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Could not update the project."); }
    setBusy(false);
  }

  async function assign(task: CachedTask, projectId: string) {
    setBusy(true); setNotice("");
    try { await onSaveTask({ ...task, projectId: projectId || null }, task.updatedAt); setNotice("Task project saved locally."); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Could not update the task."); }
    setBusy(false);
  }

  const activeProjects = projects.filter((project) => project.status === "active");
  return <section className="mx-auto mt-6 grid max-w-5xl gap-6 px-4 sm:px-0 lg:grid-cols-[1fr_.9fr] lg:items-start">
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold text-teal">Projects</p><h2 className="mt-1 text-xl font-black">Keep work in context.</h2></div><FolderPlus className="size-5 text-teal" aria-hidden="true" /></div>
      <form className="mt-5 flex gap-2" onSubmit={create}><label className="sr-only" htmlFor="project-name">Project name</label><input className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2.5 text-ink" id="project-name" maxLength={120} onChange={(event) => setName(event.target.value)} placeholder="e.g. Org recruitment" required value={name} /><button className="min-h-11 rounded-xl bg-teal px-4 font-bold text-white disabled:opacity-60" disabled={busy} type="submit">Add</button></form>
      <div className="mt-5 space-y-3">{activeProjects.map((project) => <ProjectEditor busy={busy} key={project.id} onArchive={() => void update(project.id, { status: "archived" })} onSave={(nextName) => void update(project.id, { name: nextName })} project={project} />)}{!activeProjects.length && <p className="rounded-xl bg-[#f7faf9] p-4 text-sm text-slate-700">Create a project, then attach the work that belongs to it.</p>}</div>
    </div>
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><p className="text-sm font-semibold text-teal">Open tasks</p><h2 className="mt-1 text-xl font-black">Place each task.</h2><p className="mt-2 text-sm leading-6 text-slate-700">Task assignment is optional. Unassigned tasks stay in your planner and Today view.</p><ul className="mt-5 space-y-3">{tasks.map((task) => <li className="rounded-xl border border-slate-200 p-3" key={task.id}><p className="font-bold text-ink">{task.title}</p><div className="mt-3 flex items-center gap-2"><label className="sr-only" htmlFor={`project-for-${task.id}`}>Project for {task.title}</label><select className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 text-sm text-ink" value={task.projectId ?? ""} disabled={busy} id={`project-for-${task.id}`} onChange={(event) => void assign(task, event.target.value)}><option value="">No project</option>{activeProjects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select>{task.dueAt && <time className="text-xs font-semibold text-slate-600">{new Date(task.dueAt).toLocaleDateString()}</time>}</div></li>)}{!tasks.length && <li className="rounded-xl bg-[#f7faf9] p-4 text-sm text-slate-700">No open tasks to assign.</li>}</ul></div>
    {notice && <p className="lg:col-span-2 rounded-xl bg-[#e6f2f0] px-4 py-3 text-sm font-semibold text-teal" role="status">{notice}</p>}
  </section>;
}

function ProjectEditor({ project, onSave, onArchive, busy }: { project: Project; onSave: (name: string) => void; onArchive: () => void; busy: boolean }) {
  const [name, setName] = useState(project.name);
  return <form className="flex flex-col gap-2 rounded-xl border border-slate-200 p-3 sm:flex-row sm:items-center" onSubmit={(event) => { event.preventDefault(); if (name.trim() && name.trim() !== project.name) onSave(name); }}><input aria-label={`Name for ${project.name}`} className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2.5 py-2 text-ink" maxLength={120} onChange={(event) => setName(event.target.value)} value={name} /><div className="flex gap-2"><button aria-label={`Save ${project.name}`} className="grid min-h-10 min-w-10 place-items-center rounded-lg border border-teal text-teal disabled:opacity-60" disabled={busy || !name.trim() || name.trim() === project.name} type="submit"><Save className="size-4" aria-hidden="true" /></button><button aria-label={`Archive ${project.name}`} className="grid min-h-10 min-w-10 place-items-center rounded-lg border border-slate-300 text-slate-700 disabled:opacity-60" disabled={busy} onClick={onArchive} type="button"><Archive className="size-4" aria-hidden="true" /></button></div></form>;
}
