"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useToast } from "../feedback/toast-provider";
import { TaskEditor, type TaskProject, type TaskSubject, type TaskTerm } from "@/components/tasks/task-editor";
import { buildAiTaskPrompt } from "@/lib/ai/proposals";
import type { CachedTask } from "@/lib/sync/types";
import { AssignmentPrompt } from "./assignment-prompt";
import { ContextChat } from "./context-chat";
import { unlockedAiKey, type AiProvider } from "../../lib/ai/unlocked-vault";

type Proposal = {
  id: string;
  title: string;
  kind: CachedTask["kind"];
  dueAt: string | null;
  priority: CachedTask["priority"];
  termId: string | null;
  subjectId: string | null;
  projectId: string | null;
  weightPercent: number | null;
  description: string;
  links: string[];
  effortMinutes: number | null;
};

type AiWorkbenchProps = {
  userId: string;
  currentTermId: string | null;
  terms: TaskTerm[];
  subjects: TaskSubject[];
  projects: TaskProject[];
  approvedCategoryLabelsBySubject?: Record<string, string[]>;
  connectedDataOptIn: boolean;
};

export function AiWorkbench({ userId, currentTermId, terms, subjects, projects, approvedCategoryLabelsBySubject = {}, connectedDataOptIn }: AiWorkbenchProps) {
  const { toast } = useToast();
  const [provider, setProvider] = useState<AiProvider>("openai");
  const [hasUnlockedKey, setHasUnlockedKey] = useState(() => Boolean(unlockedAiKey("openai")));
  const [task, setTask] = useState("");
  const [proposal, setProposal] = useState<Proposal[]>([]);
  const [conversationId, setConversationId] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (notice) toast(notice, /could not|failed|did not|error|blocked/i.test(notice) ? "error" : "success"); }, [notice, toast]);

  function chooseProvider(nextProvider: AiProvider) {
    setProvider(nextProvider);
    setHasUnlockedKey(Boolean(unlockedAiKey(nextProvider)));
  }

  async function propose(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setNotice("");
    try {
      const apiKey = unlockedAiKey(provider);
      if (!apiKey) throw new Error("Unlock a saved provider key in Settings before generating a proposal.");
      const response = await fetch("/api/ai/propose", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ provider, apiKey, prompt: buildAiTaskPrompt({ title: task }) }) });
      const body = await response.json() as { error?: string; id?: string; proposal?: { proposals?: Array<{ title: string; dueAt?: string | null; priority?: CachedTask["priority"] }> } };
      if (!response.ok) setNotice(body.error ?? "AI request failed.");
      else {
        setConversationId(body.id ?? "");
        setProposal((body.proposal?.proposals ?? []).map((item) => ({ id: crypto.randomUUID(), title: item.title, kind: "school", dueAt: item.dueAt ?? null, priority: item.priority ?? "normal", termId: currentTermId, subjectId: null, projectId: null, weightPercent: null, description: "", links: [], effortMinutes: null })));
        setNotice("Review and edit each suggested task before applying it.");
      }
    } catch { setNotice("AI request failed."); }
    setBusy(false);
  }

  async function apply() {
    setBusy(true);
    try {
      const response = await fetch("/api/ai/apply", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ conversationId, confirmed: true, tasks: proposal.map((item) => ({ title: item.title, kind: item.kind, dueAt: item.dueAt, priority: item.priority, termId: item.termId, subjectId: item.subjectId, projectId: item.projectId, weightPercent: item.weightPercent, description: item.description, links: item.links, effortMinutes: item.effortMinutes })) }) });
      const body = await response.json() as { error?: string; applied?: number };
      setNotice(response.ok ? `${body.applied ?? 0} reviewed task(s) added to your tasks.` : (body.error ?? "Could not apply proposal."));
    } catch { setNotice("Could not apply proposal."); }
    setBusy(false);
  }

  function asCachedTask(item: Proposal): CachedTask {
    return { ...item, userId, completedAt: null, updatedAt: new Date().toISOString(), syncState: "synced", source: "ai", sourceId: null };
  }

  const subjectLabels = new Map(subjects.map((subject) => [subject.id, subject.label]));

  return <div className="mt-6 max-w-3xl space-y-6"><ContextChat connectedDataOptIn={connectedDataOptIn} /><section className="rounded-2xl border border-teal/20 bg-white p-5 shadow-sm">
    <form className="space-y-3" onSubmit={propose}>
      <label className="block text-sm font-semibold">Provider<select className="mt-1 w-full rounded-xl border border-slate-300 px-3" onChange={(event) => chooseProvider(event.target.value as AiProvider)} value={provider}><option value="openai">OpenAI</option><option value="hackclub">Hack Club AI</option></select></label>
      <p className={"rounded-xl px-3 py-2 text-xs font-semibold " + (hasUnlockedKey ? "bg-[#e6f2f0] text-teal" : "bg-[#fff0eb] text-[#702906]")}>{hasUnlockedKey ? "Using the key unlocked in Settings." : <>No saved key is unlocked. <a className="underline" href="/settings#ai-vault">Unlock it in Settings</a>.</>}</p>
      <label className="block text-sm font-semibold">What do you need help planning?<textarea className="mt-1 min-h-28 w-full rounded-xl border border-slate-300 p-3" maxLength={6000} onChange={(event) => setTask(event.target.value)} required value={task} /></label>
      <button className="rounded-xl bg-action px-4 py-2 font-bold text-white disabled:opacity-60" disabled={busy || !hasUnlockedKey} type="submit">Generate proposal</button>
    </form>
    {proposal.length > 0 && <div className="mt-5"><h2 className="font-bold">Review and edit before applying</h2><div className="mt-3 space-y-3">{proposal.map((item) => <div className="rounded-xl border border-slate-200 p-3" key={item.id}><AssignmentPrompt approvedCategoryLabels={item.subjectId ? (approvedCategoryLabelsBySubject[item.subjectId] ?? []) : []} subjectLabel={item.subjectId ? (subjectLabels.get(item.subjectId) ?? "Not assigned") : "Not assigned"} task={asCachedTask(item)} /><TaskEditor currentTermId={currentTermId} onSave={(nextTask) => setProposal((current) => current.map((candidate) => candidate.id === item.id ? { ...candidate, ...nextTask, id: candidate.id } : candidate))} projects={projects} subjects={subjects} submitLabel="Save draft" task={asCachedTask(item)} terms={terms} /></div>)}</div><button className="mt-4 rounded-xl border border-teal px-4 py-2 font-bold text-teal disabled:opacity-60" disabled={busy} onClick={() => void apply()} type="button">Apply reviewed tasks</button></div>}
    {notice && <p className="mt-4 text-sm text-teal" role="status">{notice}</p>}
  </section></div>;
}
