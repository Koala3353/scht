"use client";

import { FormEvent, useState } from "react";
import { buildAiTaskPrompt } from "@/lib/ai/proposals";

type Proposal = {
  action: "create_task";
  title: string;
  dueAt?: string | null;
  priority?: "low" | "normal" | "high";
};

export function AiWorkbench() {
  const [provider, setProvider] = useState<"openai" | "hackclub">("openai");
  const [apiKey, setApiKey] = useState(() => {
    try {
      return (
        (
          JSON.parse(
            sessionStorage.getItem("scht-unlocked-ai-keys") ?? "{}",
          ) as Record<string, string>
        ).openai ?? ""
      );
    } catch {
      return "";
    }
  });
  const [task, setTask] = useState("");
  const [proposal, setProposal] = useState<Proposal[]>([]);
  const [conversationId, setConversationId] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  function chooseProvider(nextProvider: "openai" | "hackclub") {
    setProvider(nextProvider);
    try {
      setApiKey(
        (
          JSON.parse(
            sessionStorage.getItem("scht-unlocked-ai-keys") ?? "{}",
          ) as Record<string, string>
        )[nextProvider] ?? "",
      );
    } catch {
      setApiKey("");
    }
  }
  async function propose(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    const response = await fetch("/api/ai/propose", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        provider,
        apiKey,
        prompt: buildAiTaskPrompt({ title: task }),
      }),
    });
    const body = (await response.json()) as {
      error?: string;
      id?: string;
      proposal?: { proposals?: Proposal[] };
    };
    if (!response.ok) setNotice(body.error ?? "AI request failed.");
    else {
      setConversationId(body.id ?? "");
      setProposal(body.proposal?.proposals ?? []);
      setNotice("Review each suggested task before applying it.");
    }
    setBusy(false);
  }
  async function apply() {
    setBusy(true);
    const response = await fetch("/api/ai/apply", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        conversationId,
        confirmed: true,
        tasks: proposal.map((item) => ({
          title: item.title,
          kind: "school",
          dueAt: item.dueAt ?? null,
          priority: item.priority ?? "normal",
        })),
      }),
    });
    const body = (await response.json()) as {
      error?: string;
      applied?: number;
    };
    setNotice(
      response.ok
        ? `${body.applied ?? 0} reviewed task(s) added to your planner.`
        : (body.error ?? "Could not apply proposal."),
    );
    setBusy(false);
  }
  return (
    <section className="mt-6 max-w-2xl rounded-2xl border border-teal/20 bg-white p-5 shadow-sm">
      <form className="space-y-3" onSubmit={propose}>
        <label className="block text-sm font-semibold">
          Provider
          <select
            className="mt-1 w-full rounded-xl border border-slate-300 px-3"
            onChange={(event) =>
              chooseProvider(event.target.value as "openai" | "hackclub")
            }
            value={provider}
          >
            <option value="openai">OpenAI</option>
            <option value="hackclub">Hack Club AI</option>
          </select>
        </label>
        <label className="block text-sm font-semibold">
          Unlocked API key
          <input
            autoCapitalize="none"
            autoComplete="off"
            autoCorrect="off"
            className="mt-1 w-full rounded-xl border border-slate-300 px-3"
            maxLength={512}
            onChange={(event) => setApiKey(event.target.value)}
            required
            spellCheck={false}
            type="password"
            value={apiKey}
          />
        </label>
        <p className="text-xs text-slate-600">
          Unlock a saved key in Settings to fill this field for the active
          browser tab, or enter a key directly.
        </p>
        <label className="block text-sm font-semibold">
          What do you need help planning?
          <textarea
            className="mt-1 min-h-28 w-full rounded-xl border border-slate-300 p-3"
            maxLength={6000}
            onChange={(event) => setTask(event.target.value)}
            required
            value={task}
          />
        </label>
        <button
          className="rounded-xl bg-action px-4 py-2 font-bold text-white disabled:opacity-60"
          disabled={busy}
          type="submit"
        >
          Generate proposal
        </button>
      </form>
      {proposal.length > 0 && (
        <div className="mt-5">
          <h2 className="font-bold">Review before applying</h2>
          <ul className="mt-2 space-y-2">
            {proposal.map((item, index) => (
              <li
                className="rounded-xl bg-teal/5 p-3"
                key={`${item.title}-${index}`}
              >
                {item.title}
                {item.dueAt
                  ? ` · ${new Date(item.dueAt).toLocaleString()}`
                  : ""}
              </li>
            ))}
          </ul>
          <button
            className="mt-3 rounded-xl border border-teal px-4 py-2 font-bold text-teal disabled:opacity-60"
            disabled={busy}
            onClick={() => void apply()}
            type="button"
          >
            Apply reviewed tasks
          </button>
        </div>
      )}
      {notice && (
        <p className="mt-4 text-sm text-teal" role="status">
          {notice}
        </p>
      )}
    </section>
  );
}
