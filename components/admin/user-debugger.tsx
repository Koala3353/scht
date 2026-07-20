"use client";

import { useEffect, useMemo, useState } from "react";
import { useToast } from "../feedback/toast-provider";
import type { DeliveryEvent } from "./delivery-log";

export type AdminUserSummary = {
  id: string;
  email: string | null;
  displayName: string | null;
  role: "member" | "owner_admin";
  currentTerm: string | null;
  taskCount: number;
  openTaskCount: number;
  subjectCount: number;
  syncErrorCount: number;
  connectionStatus: "healthy" | "attention" | "not-connected";
};

type UserDiagnostics = {
  profile: {
    id: string;
    email: string | null;
    displayName: string | null;
    role: "member" | "owner_admin";
    currentTerm: string | null;
    createdAt: string;
    updatedAt: string;
    lastSignInAt: string | null;
    academicScale: string;
    connectedDataOptIn: boolean;
  } | null;
  connections: Array<{ provider: string; status: string; lastSyncedAt: string | null; errorMessage: string | null }>;
  tasks: Array<{ id: string; title: string; dueAt: string | null; completedAt: string | null; source: string; priority: string; updatedAt: string }>;
  subjects: Array<{ id: string; code: string; name: string; units: number; syllabusStatus: string }>;
  syncErrors: Array<{ id: string; source: string; message: string; createdAt: string }>;
  deliveries: DeliveryEvent[];
};

const connectionStyle = {
  healthy: "bg-[#e6f2f0] text-teal",
  attention: "bg-red-50 text-red-800",
  "not-connected": "bg-slate-100 text-slate-700",
};

function when(value: string | null) {
  return value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";
}

export function UserDebugger({ users }: { users: AdminUserSummary[] }) {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(users[0]?.id ?? "");
  const [diagnostics, setDiagnostics] = useState<UserDiagnostics | null>(null);
  const [loadedId, setLoadedId] = useState("");
  const [error, setError] = useState<{ userId: string; message: string } | null>(null);
  const visible = useMemo(() => users.filter((user) => `${user.displayName ?? ""} ${user.email ?? ""} ${user.id}`.toLowerCase().includes(query.trim().toLowerCase())), [query, users]);

  useEffect(() => {
    if (!selectedId) return;
    const controller = new AbortController();
    fetch(`/api/admin/users/${encodeURIComponent(selectedId)}`, { signal: controller.signal })
      .then(async (response) => {
        const body = (await response.json()) as UserDiagnostics & { error?: string };
        if (!response.ok) throw new Error(body.error ?? "Could not load this user’s workspace data.");
        setDiagnostics(body); setLoadedId(selectedId); setError(null);
      })
      .catch((reason: unknown) => { if ((reason as { name?: string })?.name !== "AbortError") { setLoadedId(selectedId); setError({ userId: selectedId, message: reason instanceof Error ? reason.message : "Could not load this user’s workspace data." }); } });
    return () => controller.abort();
  }, [selectedId]);

  async function copy(value: string, label: string) {
    try { await navigator.clipboard.writeText(value); toast(`${label} copied.`, "success"); }
    catch { toast("Copy was blocked by this browser.", "error"); }
  }

  const loading = Boolean(selectedId && loadedId !== selectedId && error?.userId !== selectedId);
  const selectedError = error?.userId === selectedId ? error.message : "";
  const selectedDiagnostics = loadedId === selectedId ? diagnostics : null;

  return (
    <section aria-labelledby="user-debug-heading" className="mt-6 rounded-[1.7rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-extrabold tracking-[.14em] text-blue-700">USER DEBUGGER</p>
          <h2 className="mt-2 text-xl font-bold tracking-tight text-slate-950" id="user-debug-heading">Inspect an individual workspace</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">Select a user to inspect their account state, integrations, recent tasks, sync errors, and latest email delivery records.</p>
        </div>
        <label className="block text-sm font-bold text-slate-800">Search users<input className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 px-3 font-normal outline-none transition focus:border-teal focus:ring-4 focus:ring-teal/10 lg:w-72" onChange={(event) => setQuery(event.target.value)} placeholder="Name or email" value={query} /></label>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[.9fr_1.4fr]">
        <div className="max-h-[34rem] overflow-auto rounded-2xl border border-slate-200">
          {visible.length === 0 ? <p className="p-4 text-sm text-slate-600">No user matches that search.</p> : <ul className="divide-y divide-slate-100">
            {visible.map((user) => <li key={user.id}><button aria-pressed={selectedId === user.id} className={`w-full px-4 py-4 text-left transition hover:bg-slate-50 focus-visible:outline-teal ${selectedId === user.id ? "bg-[#e6f2f0]" : "bg-white"}`} onClick={() => setSelectedId(user.id)} type="button"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-bold text-slate-950">{user.displayName || user.email || "Unnamed account"}</p><p className="mt-1 truncate text-sm text-slate-600">{user.email || user.id}</p></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-extrabold ${connectionStyle[user.connectionStatus]}`}>{user.connectionStatus === "healthy" ? "Healthy" : user.connectionStatus === "attention" ? "Attention" : "No links"}</span></div><p className="mt-3 text-xs font-semibold text-slate-500">{user.openTaskCount}/{user.taskCount} open tasks · {user.subjectCount} subjects · {user.syncErrorCount} sync alerts</p></button></li>)}
          </ul>}
        </div>

        <div className="rounded-2xl bg-slate-50 p-4 sm:p-5" aria-live="polite">
          {loading ? <div className="space-y-4" aria-busy="true"><div className="h-7 w-52 animate-pulse rounded bg-slate-200" /><div className="h-28 animate-pulse rounded-xl bg-slate-200" /><div className="h-40 animate-pulse rounded-xl bg-slate-200" /></div> : null}
          {!loading && selectedError ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800" role="alert">{selectedError}</p> : null}
          {!loading && !selectedError && selectedDiagnostics?.profile ? <UserDetail diagnostics={selectedDiagnostics} onCopy={copy} /> : null}
          {!loading && !selectedError && !selectedDiagnostics?.profile ? <p className="text-sm text-slate-600">Select a user to inspect their workspace.</p> : null}
        </div>
      </div>
    </section>
  );
}

function UserDetail({ diagnostics, onCopy }: { diagnostics: UserDiagnostics; onCopy: (value: string, label: string) => Promise<void> }) {
  const profile = diagnostics.profile!;
  return <div>
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-extrabold tracking-[.14em] text-teal">WORKSPACE SNAPSHOT</p><h3 className="mt-2 text-2xl font-black tracking-tight text-slate-950">{profile.displayName || profile.email || "Unnamed account"}</h3><p className="mt-1 text-sm text-slate-600">{profile.email || "Auth email unavailable"}</p></div><span className="w-fit rounded-full bg-[#e8eef9] px-3 py-1.5 text-xs font-extrabold text-[#345d9d]">{profile.role === "owner_admin" ? "Owner admin" : "Student member"}</span></div>
    <div className="mt-5 grid gap-3 sm:grid-cols-2"><Info label="Current term" value={profile.currentTerm || "None selected"} /><Info label="Last Google sign-in" value={when(profile.lastSignInAt)} /><Info label="Academic scale" value={profile.academicScale.toUpperCase()} /><Info label="Connected-data AI" value={profile.connectedDataOptIn ? "Opted in" : "Off"} /></div>
    <div className="mt-4 flex flex-wrap gap-2"><button className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:border-teal hover:text-teal" onClick={() => void onCopy(profile.id, "User ID")} type="button">Copy user ID</button>{profile.email ? <button className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:border-teal hover:text-teal" onClick={() => void onCopy(profile.email!, "Email")} type="button">Copy email</button> : null}</div>
    <DetailSection title="Connections"><div className="flex flex-wrap gap-2">{diagnostics.connections.length ? diagnostics.connections.map((connection) => <span className={`rounded-full px-3 py-1.5 text-xs font-extrabold ${connection.status === "error" ? "bg-red-50 text-red-800" : connection.status === "connected" ? "bg-[#e6f2f0] text-teal" : "border border-slate-200 bg-white text-slate-950"}`} key={connection.provider}>{connection.provider} · {connection.status}{connection.lastSyncedAt ? ` · ${when(connection.lastSyncedAt)}` : ""}</span>) : <p className="text-sm text-slate-600">No provider connections.</p>}</div>{diagnostics.connections.filter((connection) => connection.errorMessage).map((connection) => <p className="mt-2 text-sm text-red-800" key={`${connection.provider}-error`}>{connection.provider}: {connection.errorMessage}</p>)}</DetailSection>
    <DetailSection title="Recent tasks"><CompactTable columns={["Task", "Source", "Due", "State"]} rows={diagnostics.tasks.map((task) => [task.title, task.source, task.dueAt ? when(task.dueAt) : "No due date", task.completedAt ? "Completed" : "Open"])} empty="No tasks yet." /></DetailSection>
    <DetailSection title="Sync errors"><CompactTable columns={["Source", "Message", "Recorded"]} rows={diagnostics.syncErrors.map((error) => [error.source, error.message, when(error.createdAt)])} empty="No unresolved sync errors." /></DetailSection>
    <DetailSection title="Latest email activity"><CompactTable columns={["Message", "Status", "Time"]} rows={diagnostics.deliveries.map((delivery) => [delivery.kind, delivery.status, when(delivery.occurredAt)])} empty="No email delivery records yet." /></DetailSection>
  </div>;
}

function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 break-words text-sm font-bold text-slate-950">{value}</p></div>; }
function DetailSection({ title, children }: { title: string; children: React.ReactNode }) { return <section className="mt-5 border-t border-slate-200 pt-5"><h4 className="text-sm font-extrabold text-slate-950">{title}</h4><div className="mt-3">{children}</div></section>; }
function CompactTable({ columns, rows, empty }: { columns: string[]; rows: string[][]; empty: string }) { return rows.length ? <div className="overflow-x-auto"><table className="w-full min-w-[30rem] text-left text-xs"><thead className="text-slate-500"><tr>{columns.map((column) => <th className="pb-2 pr-3 font-extrabold" key={column}>{column}</th>)}</tr></thead><tbody className="divide-y divide-slate-200">{rows.slice(0, 8).map((row, index) => <tr key={`${row.join("-")}-${index}`}>{row.map((value, cell) => <td className="py-2 pr-3 text-slate-700" key={`${value}-${cell}`}>{value}</td>)}</tr>)}</tbody></table></div> : <p className="text-sm text-slate-600">{empty}</p>; }
