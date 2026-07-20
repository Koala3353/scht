"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { z } from "zod";

const providerSchema = z.enum(["google", "canvas"]);
const serviceResultSchema = z.object({
  state: z.enum(["synced", "degraded", "needs_reauth"]),
  imported: z.number(),
  message: z.string(),
});
const googleResultSchema = z.object({
  calendar: serviceResultSchema,
  gmail: serviceResultSchema,
});
const canvasResultSchema = z.object({
  courses: z.number().optional(),
  assignments: z.number().optional(),
});
const errorResultSchema = z.object({ error: z.string().optional() });

export type Provider = z.infer<typeof providerSchema>;

type ProviderResult = {
  id: string;
  provider: Provider;
  message: string;
  tone: "success" | "warning";
};

function providerName(provider: Provider) {
  return provider === "google" ? "Google Calendar and Gmail" : "Canvas";
}

function refreshMessage(providers: Provider[]) {
  return `Refreshing ${providers.map(providerName).join(" and ")}…`;
}

function uniqueResults(results: ProviderResult[]) {
  return results.filter(
    (result, index) => results.findIndex(
      (candidate) => candidate.message === result.message && candidate.tone === result.tone,
    ) === index,
  );
}

function refreshOutcome(results: ProviderResult[]) {
  const warnings = results.filter((result) => result.tone === "warning").length;
  return warnings
    ? `Refresh complete with ${warnings} ${warnings === 1 ? "issue" : "issues"}.`
    : "Refresh complete.";
}

async function responseJson(response: Response): Promise<unknown> {
  return response.json().catch(() => ({}));
}

async function syncGoogle(): Promise<ProviderResult[]> {
  try {
    const response = await fetch("/api/integrations/google/sync", { method: "POST" });
    const body = await responseJson(response);
    const parsed = googleResultSchema.safeParse(body);
    if (!parsed.success) {
      const error = errorResultSchema.safeParse(body);
      return [{
        id: "google",
        provider: "google",
        message: error.success && error.data.error ? error.data.error : "Google could not be refreshed.",
        tone: "warning",
      }];
    }
    return [
      {
        id: "google-calendar",
        provider: "google",
        message: parsed.data.calendar.message,
        tone: parsed.data.calendar.state === "synced" ? "success" : "warning",
      },
      {
        id: "google-gmail",
        provider: "google",
        message: parsed.data.gmail.message,
        tone: parsed.data.gmail.state === "synced" ? "success" : "warning",
      },
    ];
  } catch {
    return [{
      id: "google",
      provider: "google",
      message: "Google could not be reached. Try again when your connection is available.",
      tone: "warning",
    }];
  }
}

async function syncCanvas(): Promise<ProviderResult[]> {
  try {
    const response = await fetch("/api/integrations/canvas", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "sync" }),
    });
    const body = await responseJson(response);
    const parsed = canvasResultSchema.safeParse(body);
    if (!response.ok || !parsed.success) {
      const error = errorResultSchema.safeParse(body);
      return [{
        id: "canvas",
        provider: "canvas",
        message: error.success && error.data.error ? error.data.error : "Canvas could not be refreshed.",
        tone: "warning",
      }];
    }
    const assignments = parsed.data.assignments ?? 0;
    return [{
      id: "canvas",
      provider: "canvas",
      message: `Canvas: ${assignments} assignment${assignments === 1 ? "" : "s"} imported.`,
      tone: "success",
    }];
  } catch {
    return [{
      id: "canvas",
      provider: "canvas",
      message: "Canvas could not be reached. Try again when your connection is available.",
      tone: "warning",
    }];
  }
}

export function ProviderResync({ providers }: { providers: Provider[] }) {
  const router = useRouter();
  const didAutoResync = useRef(false);
  const [busy, setBusy] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [results, setResults] = useState<ProviderResult[]>([]);
  const selectedProviders = z.array(providerSchema).catch([]).parse(providers).filter(
    (provider, index) => providers.indexOf(provider) === index,
  );

  const resync = useCallback(async () => {
    if (!selectedProviders.length || busy) return;
    setBusy(true);
    setAnnouncement(refreshMessage(selectedProviders));
    const responses = await Promise.all(
      selectedProviders.map((provider) => provider === "google" ? syncGoogle() : syncCanvas()),
    );
    const settledResults = uniqueResults(responses.flat());
    setResults(settledResults);
    setAnnouncement(refreshOutcome(settledResults));
    setBusy(false);
    router.refresh();
  }, [busy, router, selectedProviders]);

  useEffect(() => {
    if (didAutoResync.current) return;
    didAutoResync.current = true;
    void resync();
  }, [resync]);

  const buttonLabel = selectedProviders.length
    ? `Resync ${selectedProviders.map(providerName).join(" and ")}`
    : "Resync providers";

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <button
        aria-describedby="provider-resync-status"
        className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-teal/30 bg-white px-4 py-2 text-sm font-bold text-teal transition hover:bg-[#e6f2f0] disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-500"
        disabled={busy || !selectedProviders.length}
        onClick={() => void resync()}
        type="button"
      >
        <RefreshCw aria-hidden="true" className={busy ? "size-4 animate-spin" : "size-4"} />
        {buttonLabel}
      </button>
      <div aria-live="polite" className="sr-only" id="provider-resync-status" role="status">
        {announcement || (selectedProviders.length ? "Ready to refresh saved connections." : "Not connected")}
      </div>
      {results.length > 0 ? (
        <div className="w-full max-w-sm text-left sm:text-right" role="status">
          <p className={"text-xs font-bold uppercase tracking-wide " + (results.some((result) => result.tone === "warning") ? "text-action" : "text-teal")}>
            {results.some((result) => result.tone === "warning") ? "Integration refresh completed with issues" : "Integration refresh complete"}
          </p>
          <ul className="mt-1 space-y-1 text-sm" aria-label="Provider refresh results">
            {results.map((result) => (
              <li className={"break-words " + (result.tone === "success" ? "text-teal" : "text-action")} key={result.id}>
                {result.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
