"use client";

import { useState } from "react";
import { BellRing, SlidersHorizontal } from "lucide-react";

import { createClient } from "@/lib/supabase/client";

type Rule = { kind: "weighted_due" | "canvas_change" | "gmail_attention"; enabled: boolean; config: Record<string, unknown> };

export function NotificationRulesPanel({ initialRules }: { initialRules: Rule[] }) {
  const existing = new Map(initialRules.map((rule) => [rule.kind, rule]));
  const [weightedDue, setWeightedDue] = useState(existing.get("weighted_due")?.enabled ?? true);
  const [canvasChange, setCanvasChange] = useState(existing.get("canvas_change")?.enabled ?? true);
  const [gmailAttention, setGmailAttention] = useState(existing.get("gmail_attention")?.enabled ?? true);
  const [days, setDays] = useState(String(existing.get("weighted_due")?.config.daysBefore ?? 3));
  const [weight, setWeight] = useState(String(existing.get("weighted_due")?.config.minimumWeight ?? 15));
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  async function save() {
    const daysBefore = Number(days); const minimumWeight = Number(weight);
    if (!Number.isInteger(daysBefore) || daysBefore < 1 || daysBefore > 30 || !Number.isFinite(minimumWeight) || minimumWeight < 0 || minimumWeight > 100) { setNotice("Use a reminder window from 1–30 days and a grade weight from 0–100%. "); return; }
    setBusy(true); setNotice("");
    const supabase = createClient(); const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setNotice("Sign in again before saving notification rules."); setBusy(false); return; }
    const { error } = await supabase.from("notification_rules").upsert([
      { user_id: user.id, kind: "weighted_due", enabled: weightedDue, config: { daysBefore, minimumWeight } },
      { user_id: user.id, kind: "canvas_change", enabled: canvasChange, config: {} },
      { user_id: user.id, kind: "gmail_attention", enabled: gmailAttention, config: {} },
    ], { onConflict: "user_id,kind" });
    setNotice(error ? error.message : "Notification rules saved. They guide your briefing and upcoming reminders."); setBusy(false);
  }

  return <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm" id="notification-rules"><div className="flex flex-wrap items-start justify-between gap-4"><div><span className="grid size-11 place-items-center rounded-xl bg-[#e6f2f0] text-teal"><BellRing className="size-5" /></span><p className="mt-4 text-sm font-semibold text-teal">Notification rules</p><h2 className="mt-1 text-2xl font-black tracking-tight">Prompt the work worth noticing.</h2><p className="mt-3 max-w-2xl leading-7 text-slate-700">Set the thresholds that feed your daily briefing and email timeline—without turning Scht into a noisy notification feed.</p></div><SlidersHorizontal className="size-5 text-teal" /></div><div className="mt-6 grid gap-3"><label className="rounded-xl bg-[#f7faf9] p-4"><span className="flex min-h-11 items-center gap-3 text-sm font-bold text-ink"><input checked={weightedDue} className="size-4 accent-teal" onChange={(event) => setWeightedDue(event.target.checked)} type="checkbox" />Remind me about grade-heavy work</span><span className="mt-3 grid gap-3 sm:grid-cols-2"><span className="block text-sm font-semibold text-slate-700">Days before due<input className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2" disabled={!weightedDue} max="30" min="1" onChange={(event) => setDays(event.target.value)} type="number" value={days} /></span><span className="block text-sm font-semibold text-slate-700">Minimum grade impact (%)<input className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2" disabled={!weightedDue} max="100" min="0" onChange={(event) => setWeight(event.target.value)} type="number" value={weight} /></span></span></label><label className="flex min-h-11 items-center gap-3 rounded-xl bg-[#f7faf9] px-4 py-3 text-sm font-bold text-ink"><input checked={canvasChange} className="size-4 accent-teal" onChange={(event) => setCanvasChange(event.target.checked)} type="checkbox" />Show Canvas deadline and instruction changes in my briefing</label><label className="flex min-h-11 items-center gap-3 rounded-xl bg-[#f7faf9] px-4 py-3 text-sm font-bold text-ink"><input checked={gmailAttention} className="size-4 accent-teal" onChange={(event) => setGmailAttention(event.target.checked)} type="checkbox" />Include matched Gmail tasks in my daily briefing</label></div><button className="mt-5 min-h-11 rounded-xl bg-teal px-4 text-sm font-bold text-white disabled:opacity-60" disabled={busy} onClick={() => void save()} type="button">{busy ? "Saving…" : "Save notification rules"}</button>{notice ? <p className="mt-3 text-sm font-semibold text-teal" role="status">{notice}</p> : null}</section>;
}
