"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useToast } from "../feedback/toast-provider";
import { KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";
import {
  decryptVault,
  encryptVault,
  type EncryptedVault,
} from "@/lib/ai/vault";
import { saveUnlockedAiKeys, type AiProvider } from "@/lib/ai/unlocked-vault";
import { createClient } from "@/lib/supabase/client";

function toBytea(bytes: Uint8Array) {
  return `\\x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function fromBytea(value: string) {
  const encoded = value.startsWith("\\x") ? value.slice(2) : value;
  return Uint8Array.from(encoded.match(/.{1,2}/g) ?? [], (chunk) =>
    Number.parseInt(chunk, 16),
  );
}

export function AiVaultPanel({ connectedDataOptIn }: { connectedDataOptIn: boolean }) {
  const { toast } = useToast();
  const [provider, setProvider] = useState<AiProvider>("openai");
  const [apiKey, setApiKey] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [connectedDataAllowed, setConnectedDataAllowed] = useState(connectedDataOptIn);
  const [privacyBusy, setPrivacyBusy] = useState(false);

  useEffect(() => {
    if (!notice) return;
    toast(notice, /could not|failed|did not|error|blocked/i.test(notice) ? "error" : "success");
  }, [notice, toast]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Sign in again before saving your vault.");
      const { data: existing, error: existingError } = await supabase
        .from("encrypted_ai_vaults")
        .select("ciphertext, salt, iv")
        .eq("user_id", user.id)
        .maybeSingle();
      if (existingError) throw existingError;
      const savedValues = existing
        ? await decryptVault(passphrase, {
            ciphertext: fromBytea(existing.ciphertext),
            salt: fromBytea(existing.salt),
            iv: fromBytea(existing.iv),
          } satisfies EncryptedVault)
        : {};
      const values = { ...savedValues, [provider]: apiKey };
      const encrypted = await encryptVault(passphrase, values);
      saveUnlockedAiKeys(values);
      const { error } = await supabase.from("encrypted_ai_vaults").upsert(
        {
          user_id: user.id,
          ciphertext: toBytea(encrypted.ciphertext),
          salt: toBytea(encrypted.salt),
          iv: toBytea(encrypted.iv),
        },
        { onConflict: "user_id" },
      );
      if (error) throw error;
      setApiKey("");
      setPassphrase("");
      setNotice("Your API key is encrypted and unlocked for this browser tab.");
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Could not save the encrypted vault.",
      );
    }
    setBusy(false);
  }

  async function saveConnectedDataPrivacy() {
    setPrivacyBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/settings/ai-privacy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ connectedDataOptIn: connectedDataAllowed }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Could not save your AI privacy choice.");
      setNotice(connectedDataAllowed ? "Connected-data AI use is opted in. Scht will still never send it automatically." : "Connected-data AI use is off. AI receives only text you enter.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not save your AI privacy choice.");
    }
    setPrivacyBusy(false);
  }

  async function verify() {
    setBusy(true);
    setNotice("");
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Sign in again before unlocking your vault.");
      const { data, error } = await supabase
        .from("encrypted_ai_vaults")
        .select("ciphertext, salt, iv")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("No encrypted AI vault has been saved yet.");
      const values = await decryptVault(passphrase, {
        ciphertext: fromBytea(data.ciphertext),
        salt: fromBytea(data.salt),
        iv: fromBytea(data.iv),
      } satisfies EncryptedVault);
      saveUnlockedAiKeys(values);
      setNotice(
        `Vault unlocked for this browser tab. Saved providers: ${Object.keys(values).join(", ")}.`,
      );
      setPassphrase("");
    } catch {
      setNotice("The passphrase did not unlock this vault.");
    }
    setBusy(false);
  }

  return (
    <section aria-labelledby="ai-vault-heading" id="ai-vault">
      <div className="grid gap-5 rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm lg:grid-cols-[.8fr_1.2fr] lg:p-7">
        <div>
          <span className="grid size-11 place-items-center rounded-xl bg-[#e8eef9] text-[#345d9d]">
            <KeyRound className="size-5" aria-hidden="true" />
          </span>
          <p className="mt-5 text-sm font-semibold text-teal">AI vault</p>
          <h2
            className="mt-1 text-2xl font-black tracking-tight"
            id="ai-vault-heading"
          >
            Bring your own key, keep your boundary.
          </h2>
          <p className="mt-3 max-w-md leading-7 text-slate-700">
            Your provider key is encrypted in the browser before it reaches
            Supabase. Scht cannot recover a forgotten passphrase.
          </p>
          <p className="mt-5 flex items-start gap-2 text-sm font-semibold leading-6 text-[#345d9d]">
            <ShieldCheck
              className="mt-0.5 size-4 shrink-0"
              aria-hidden="true"
            />
            AI only makes proposals. You review every task before it reaches
            your planner.
          </p>
        </div>

        <form
          className="grid content-start gap-4 sm:grid-cols-2"
          onSubmit={save}
        >
          <label className="text-sm font-bold text-ink">
            Provider
            <select
              className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-ink focus:border-teal"
              onChange={(event) =>
                setProvider(event.target.value as AiProvider)
              }
              value={provider}
            >
              <option value="openai">OpenAI</option>
              <option value="hackclub">Hack Club AI</option>
            </select>
          </label>
          <label className="text-sm font-bold text-ink">
            Provider API key
            <input
              className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-ink focus:border-teal"
              onChange={(event) => setApiKey(event.target.value)}
              required
              type="password"
              value={apiKey}
            />
          </label>
          <label className="text-sm font-bold text-ink sm:col-span-2">
            Vault passphrase
            <input
              className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-ink focus:border-teal"
              minLength={12}
              onChange={(event) => setPassphrase(event.target.value)}
              required
              type="password"
              value={passphrase}
            />
          </label>
          <div className="flex flex-wrap gap-3 sm:col-span-2">
            <button
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-action px-4 py-2 font-bold text-white transition hover:bg-[#8d3909] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={busy}
              type="submit"
            >
              <LockKeyhole className="size-4" aria-hidden="true" />
              Encrypt and save
            </button>
            <button
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-teal px-4 py-2 font-bold text-teal transition hover:bg-[#e6f2f0] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={busy || !passphrase}
              onClick={() => void verify()}
              type="button"
            >
              Verify passphrase
            </button>
          </div>
          <div className="rounded-xl border border-[#cfdde8] bg-[#f5f8fc] p-4 text-sm leading-6 text-slate-700 sm:col-span-2">
            <label className="flex min-h-11 items-start gap-3 font-bold text-ink">
              <input checked={connectedDataAllowed} className="mt-1 size-4 accent-[#075e60]" onChange={(event) => setConnectedDataAllowed(event.target.checked)} type="checkbox" />
              <span>Allow connected data in a future AI request</span>
            </label>
            <p className="mt-2">I’m intentionally not sending Calendar/Gmail data into an external AI provider automatically; that should be an explicit opt-in privacy choice. Even when enabled, Scht will require a separate, visible action before any connected data is included.</p>
            <button className="mt-3 inline-flex min-h-11 items-center justify-center rounded-xl border border-teal px-4 py-2 font-bold text-teal transition hover:bg-[#e6f2f0] disabled:cursor-not-allowed disabled:opacity-60" disabled={privacyBusy} onClick={() => void saveConnectedDataPrivacy()} type="button">
              Save privacy choice
            </button>
            <p className="mt-4 border-t border-[#cfdde8] pt-3">Scht shows the tokens used by each AI response and this chat session. Remaining account credit is not exposed to normal provider keys; check it in your provider dashboard instead.</p>
          </div>
        </form>
      </div>
      {notice && (
        <p
          className="mt-4 rounded-xl bg-[#e6f2f0] px-4 py-3 text-sm font-semibold text-teal"
          role="status"
        >
          {notice}
        </p>
      )}
    </section>
  );
}
