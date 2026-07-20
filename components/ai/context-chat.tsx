"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Bot, Send, Sparkles } from "lucide-react";

import { useToast } from "../feedback/toast-provider";

type ChatMessage = { role: "user" | "assistant"; content: string };
const vaultKey = "scht-unlocked-ai-keys";

function unlockedKey(provider: "openai" | "hackclub") {
  try { return (JSON.parse(sessionStorage.getItem(vaultKey) ?? "{}") as Record<string, string>)[provider] ?? ""; } catch { return ""; }
}

export function ContextChat({ connectedDataOptIn }: { connectedDataOptIn: boolean }) {
  const { toast } = useToast();
  const [provider, setProvider] = useState<"openai" | "hackclub">("openai");
  const [apiKey, setApiKey] = useState(() => unlockedKey("openai"));
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [includeContext, setIncludeContext] = useState(connectedDataOptIn);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => { if (notice) toast(notice, /could not|failed|error|enable/i.test(notice) ? "error" : "success"); }, [notice, toast]);

  function changeProvider(next: "openai" | "hackclub") { setProvider(next); setApiKey(unlockedKey(next)); }
  async function ask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = question.trim();
    if (!content) return;
    const nextMessages = [...messages, { role: "user" as const, content }].slice(-12);
    setMessages(nextMessages); setQuestion(""); setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/ai/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ provider, apiKey, includeWorkspaceContext: includeContext, messages: nextMessages }) });
      const body = await response.json().catch(() => ({})) as { error?: string; message?: string; usedWorkspaceContext?: boolean };
      if (!response.ok || !body.message) throw new Error(body.error ?? "AI chat failed.");
      setMessages((current) => [...current, { role: "assistant" as const, content: body.message! }].slice(-12));
      if (body.usedWorkspaceContext) setNotice("Answered with your selected workspace context.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "AI chat failed."); }
    finally { setBusy(false); }
  }

  return <section className="rounded-[1.5rem] border border-teal/20 bg-white p-5 shadow-sm sm:p-6" aria-labelledby="context-chat-heading"><div className="flex flex-wrap items-start justify-between gap-4"><div><span className="grid size-11 place-items-center rounded-xl bg-[#e6f2f0] text-teal"><Bot aria-hidden="true" className="size-5" /></span><p className="mt-4 text-sm font-semibold text-teal">Workspace chat</p><h2 className="mt-1 text-2xl font-black tracking-tight" id="context-chat-heading">Ask about your actual semester.</h2><p className="mt-2 max-w-2xl leading-7 text-slate-700">Ask what is due, how to prioritize, or how a course is going. With your permission, Scht sends a compact, read-only snapshot of imported Calendar events, Gmail and Canvas task context, subjects, syllabus weights, and grades to your chosen AI provider.</p></div><span className="inline-flex items-center gap-2 rounded-full bg-[#f5f8fc] px-3 py-2 text-xs font-bold text-[#345d9d]"><Sparkles aria-hidden="true" className="size-3.5" />Your key, your provider</span></div><div className="mt-5 grid gap-4 rounded-2xl bg-slate-50 p-4 sm:grid-cols-2"><label className="text-sm font-bold text-ink">Provider<select className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5" onChange={(event) => changeProvider(event.target.value as "openai" | "hackclub")} value={provider}><option value="openai">OpenAI</option><option value="hackclub">Hack Club AI</option></select></label><label className="text-sm font-bold text-ink">Unlocked API key<input autoCapitalize="none" autoComplete="off" autoCorrect="off" className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5" maxLength={512} onChange={(event) => setApiKey(event.target.value)} placeholder="Stored only for this request" required spellCheck={false} type="password" value={apiKey} /></label><div className="sm:col-span-2"><label className="flex min-h-11 items-start gap-3 text-sm font-bold text-ink"><input checked={includeContext} className="mt-1 size-4 accent-teal" disabled={!connectedDataOptIn} onChange={(event) => setIncludeContext(event.target.checked)} type="checkbox" /><span>Include my connected workspace context</span></label><p className="mt-1 pl-7 text-xs leading-5 text-slate-600">{connectedDataOptIn ? "You can turn this off for any individual question. Your key and chat are not stored by Scht." : <>Enable this in <a className="font-bold text-teal underline" href="/settings#ai-vault">Settings → AI vault</a> before Scht can include Gmail, Calendar, or Canvas context.</>}</p></div></div>{messages.length > 0 && <ol aria-label="AI chat" className="mt-5 space-y-3">{messages.map((message, index) => <li className={message.role === "assistant" ? "rounded-2xl bg-[#e6f2f0] p-4 text-slate-800" : "ml-auto max-w-[85%] rounded-2xl bg-[#073f42] p-4 text-white"} key={`${message.role}-${index}`}><p className="mb-1 text-xs font-bold uppercase tracking-wide opacity-70">{message.role === "assistant" ? "Scht" : "You"}</p><p className="whitespace-pre-wrap leading-6">{message.content}</p></li>)}</ol>}<form className="mt-5" onSubmit={ask}><label className="text-sm font-bold text-ink">Ask Scht about your semester<textarea className="mt-1.5 min-h-28 w-full rounded-xl border border-slate-300 bg-white p-3 leading-6 focus:border-teal" maxLength={6000} onChange={(event) => setQuestion(event.target.value)} placeholder="What should I work on first this week, and why?" required value={question} /></label><button className="mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-teal px-4 py-2 font-bold text-white transition hover:bg-[#075e60] disabled:cursor-not-allowed disabled:opacity-60" disabled={busy || !apiKey.trim()} type="submit"><Send aria-hidden="true" className="size-4" />{busy ? "Thinking…" : "Ask with my context"}</button></form>{notice && <p className="mt-3 text-sm font-semibold text-teal" role="status">{notice}</p>}</section>;
}
