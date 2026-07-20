"use client";

import { useEffect, useState, type FormEvent, type KeyboardEvent } from "react";
import { Bot, Send, Sparkles } from "lucide-react";

import { useToast } from "../feedback/toast-provider";
import { unlockedAiKey, type AiProvider } from "../../lib/ai/unlocked-vault";

type ChatMessage = { role: "user" | "assistant"; content: string };
type TokenUsage = { inputTokens: number; outputTokens: number; totalTokens: number };

export function ContextChat({ connectedDataOptIn }: { connectedDataOptIn: boolean }) {
  const { toast } = useToast();
  const [provider, setProvider] = useState<AiProvider>("openai");
  const [hasUnlockedKey, setHasUnlockedKey] = useState(() => Boolean(unlockedAiKey("openai")));
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [includeContext, setIncludeContext] = useState(connectedDataOptIn);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [sessionTokens, setSessionTokens] = useState(0);
  const [lastUsage, setLastUsage] = useState<TokenUsage | null>(null);
  useEffect(() => { if (notice) toast(notice, /could not|failed|error|enable/i.test(notice) ? "error" : "success"); }, [notice, toast]);

  function changeProvider(next: AiProvider) { setProvider(next); setHasUnlockedKey(Boolean(unlockedAiKey(next))); }
  async function sendQuestion() {
    const content = question.trim();
    const apiKey = unlockedAiKey(provider);
    if (!content || busy) return;
    if (!apiKey) {
      setNotice("Unlock a saved provider key in Settings before using chat.");
      return;
    }
    const nextMessages = [...messages, { role: "user" as const, content }].slice(-12);
    setMessages(nextMessages); setQuestion(""); setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/ai/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ provider, apiKey, includeWorkspaceContext: includeContext, messages: nextMessages }) });
      const body = await response.json().catch(() => ({})) as { error?: string; message?: string; usedWorkspaceContext?: boolean; usage?: TokenUsage };
      if (!response.ok || !body.message) throw new Error(body.error ?? "AI chat failed.");
      setMessages((current) => [...current, { role: "assistant" as const, content: body.message! }].slice(-12));
      if (body.usage) {
        setLastUsage(body.usage);
        setSessionTokens((current) => current + body.usage!.totalTokens);
      }
      if (body.usedWorkspaceContext) setNotice("Answered with your selected workspace context.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "AI chat failed."); }
    finally { setBusy(false); }
  }

  function ask(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void sendQuestion(); }
  function sendWithShortcut(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void sendQuestion();
    }
  }

  return <section className="rounded-[1.5rem] border border-teal/20 bg-white p-5 shadow-sm sm:p-6" aria-labelledby="context-chat-heading"><div className="flex flex-wrap items-start justify-between gap-4"><div><span className="grid size-11 place-items-center rounded-xl bg-[#e6f2f0] text-teal"><Bot aria-hidden="true" className="size-5" /></span><p className="mt-4 text-sm font-semibold text-teal">Workspace chat</p><h2 className="mt-1 text-2xl font-black tracking-tight" id="context-chat-heading">Ask about your actual semester.</h2><p className="mt-2 max-w-2xl leading-7 text-slate-700">Ask what is due, how to prioritize, or how a course is going. With your permission, Scht sends a compact, read-only snapshot of imported Calendar events, Gmail and Canvas task context, subjects, syllabus weights, and grades to your chosen AI provider.</p></div><span className="inline-flex items-center gap-2 rounded-full bg-[#f5f8fc] px-3 py-2 text-xs font-bold text-[#345d9d]"><Sparkles aria-hidden="true" className="size-3.5" />Your key, your provider</span></div><div className="mt-5 grid gap-4 rounded-2xl bg-slate-50 p-4 sm:grid-cols-2"><label className="text-sm font-bold text-ink">Provider<select className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5" onChange={(event) => changeProvider(event.target.value as AiProvider)} value={provider}><option value="openai">OpenAI</option><option value="hackclub">Hack Club AI</option></select></label><div className="text-sm font-bold text-ink"><p>Saved key</p><p className={"mt-1.5 rounded-xl px-3 py-2.5 font-semibold " + (hasUnlockedKey ? "bg-[#e6f2f0] text-teal" : "bg-[#fff0eb] text-[#702906]")}>{hasUnlockedKey ? "Unlocked from Settings" : <>Locked — <a className="underline" href="/settings#ai-vault">unlock in Settings</a></>}</p></div><div className="sm:col-span-2"><label className="flex min-h-11 items-start gap-3 text-sm font-bold text-ink"><input checked={includeContext} className="mt-1 size-4 accent-teal" disabled={!connectedDataOptIn} onChange={(event) => setIncludeContext(event.target.checked)} type="checkbox" /><span>Include my connected workspace context</span></label><p className="mt-1 pl-7 text-xs leading-5 text-slate-600">{connectedDataOptIn ? "You can turn this off for any individual question. Your provider key is configured only in Settings." : <>Enable this in <a className="font-bold text-teal underline" href="/settings#ai-vault">Settings → AI vault</a> before Scht can include Gmail, Calendar, or Canvas context.</>}</p></div></div>{messages.length > 0 && <ol aria-label="AI chat" className="mt-5 space-y-3">{messages.map((message, index) => <li className={message.role === "assistant" ? "rounded-2xl bg-[#e6f2f0] p-4 text-slate-800" : "ml-auto max-w-[85%] rounded-2xl bg-[#073f42] p-4 text-white"} key={`${message.role}-${index}`}><p className="mb-1 text-xs font-bold uppercase tracking-wide opacity-70">{message.role === "assistant" ? "Scht" : "You"}</p><p className="whitespace-pre-wrap leading-6">{message.content}</p></li>)}</ol>}<form className="mt-5" onSubmit={ask}><label className="text-sm font-bold text-ink">Ask Scht about your semester<textarea className="mt-1.5 min-h-28 w-full rounded-xl border border-slate-300 bg-white p-3 leading-6 focus:border-teal" maxLength={6000} onChange={(event) => setQuestion(event.target.value)} onKeyDown={sendWithShortcut} placeholder="What should I work on first this week, and why?" required value={question} /></label><p className="mt-2 text-xs font-semibold text-slate-600">Press ⌘ Enter (or Ctrl Enter) to send.</p><button className="mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-teal px-4 py-2 font-bold text-white transition hover:bg-[#075e60] disabled:cursor-not-allowed disabled:opacity-60" disabled={busy || !hasUnlockedKey} type="submit"><Send aria-hidden="true" className="size-4" />{busy ? "Thinking…" : "Ask with my context"}</button></form>{lastUsage && <p className="mt-3 text-xs font-semibold text-slate-600" role="status">Last answer: {lastUsage.totalTokens.toLocaleString()} tokens ({lastUsage.inputTokens.toLocaleString()} input, {lastUsage.outputTokens.toLocaleString()} output) · This chat: {sessionTokens.toLocaleString()} tokens.</p>}{notice && <p className="mt-3 text-sm font-semibold text-teal" role="status">{notice}</p>}</section>;
}
