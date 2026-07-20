import { MailCheck, ShieldCheck } from "lucide-react";

import { PageHeader } from "@/components/workspace/page-header";
import { requireUser } from "@/lib/auth/guards";
import { requireQuery } from "@/lib/queries/core-page-query-error";
import { createClient } from "@/lib/supabase/server";

export default async function InboxPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const tasks = requireQuery(
    await supabase.from("tasks").select("id,title,notes,due_at,priority,source,created_at,completed_at").eq("user_id", user.id).eq("source", "gmail").is("completed_at", null).order("created_at", { ascending: false }),
    "academic inbox",
  ) ?? [];
  return <main className="mx-auto max-w-5xl pb-10">
    <PageHeader eyebrow="SMART INBOX" title="Needs academic attention.">
      Only imported Gmail messages that match your editable task triggers appear here. Promotions, spam, and messages matching your exclusions stay out.
    </PageHeader>
    <section className="mt-7 overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[#e6f2f0] text-teal"><MailCheck className="size-5" /></span><div><h2 className="font-black">{tasks.length} message{tasks.length === 1 ? "" : "s"} to review</h2><p className="text-sm text-slate-600">Explainable, not a noisy inbox.</p></div></div><a className="text-sm font-bold text-teal underline underline-offset-4" href="/settings#connections">Edit Gmail filters</a></div>
      {tasks.length ? <ul className="divide-y divide-slate-100">{tasks.map((task) => <li className="p-5" key={task.id}><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-ink">{task.title}</h3><span className="rounded-md bg-[#fff8f3] px-2 py-1 text-xs font-bold text-action">Matched Gmail task trigger</span></div><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-700">{task.notes || "This unread message matched a course-work phrase in your Gmail task filters."}</p><p className="mt-2 flex items-center gap-2 text-xs font-semibold text-slate-500"><ShieldCheck className="size-3.5 text-teal" />Imported from unread Gmail; you can change the trigger rules in Settings.</p></div><a className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl border border-teal px-3 text-sm font-bold text-teal hover:bg-[#e6f2f0]" href={`/assignments/${task.id}`}>Open workspace</a></div></li>)}</ul> : <div className="p-7 text-center"><MailCheck className="mx-auto size-7 text-teal" /><h2 className="mt-3 text-lg font-black">Your academic inbox is clear.</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">Connect Gmail and save task triggers in Settings to pull in only the email that deserves a place in your study plan.</p><a className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-teal px-4 text-sm font-bold text-white" href="/settings#connections">Configure Gmail filters</a></div>}
    </section>
  </main>;
}
