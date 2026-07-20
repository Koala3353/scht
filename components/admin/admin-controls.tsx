"use client";

import { FormEvent, useEffect, useState } from "react";
import { useToast } from "../feedback/toast-provider";

type Profile = { id: string; display_name?: string | null; displayName?: string | null; email?: string | null };
type ProvisionedAccount = { email: string; googleAudienceUrl: string };

export function AdminControls({ profiles }: { profiles: Profile[] }) {
  const { toast } = useToast();
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [userId, setUserId] = useState(profiles[0]?.id ?? "");
  useEffect(() => {
    if (!notice) return;
    toast(notice, /could not|failed|did not|error|blocked/i.test(notice) ? "error" : "success");
  }, [notice, toast]);
  const [provisionedAccount, setProvisionedAccount] =
    useState<ProvisionedAccount | null>(null);

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setNotice("");
    setProvisionedAccount(null);

    try {
      const response = await fetch("/api/admin/invites", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: form.get("email"),
          role: form.get("role"),
          expiresAt: form.get("expiresAt") || null,
        }),
      });
      const body = (await response.json()) as {
        error?: string;
        invite?: { email: string };
        googleAudienceUrl?: string;
      };

      if (!response.ok || !body.invite || !body.googleAudienceUrl) {
        setNotice(body.error ?? "Could not add the account.");
        return;
      }

      setProvisionedAccount({
        email: body.invite.email,
        googleAudienceUrl: body.googleAudienceUrl,
      });
      setNotice(`Account access is ready for ${body.invite.email}.`);
      event.currentTarget.reset();
    } catch {
      setNotice(
        "Could not reach the server. Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function copyEmail() {
    if (!provisionedAccount) return;

    try {
      await navigator.clipboard.writeText(provisionedAccount.email);
      setNotice(`Copied ${provisionedAccount.email}.`);
    } catch {
      setNotice(
        "Copy was blocked by this browser. Select the email and copy it manually.",
      );
    }
  }

  function downloadExport() {
    if (userId)
      window.location.assign(
        `/api/admin/export?userId=${encodeURIComponent(userId)}`,
      );
  }

  return (
    <section
      aria-label="Account administration"
      className="mt-6 grid gap-5 lg:grid-cols-[1.08fr_.92fr]"
    >
      <article className="rounded-[1.7rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-extrabold tracking-[.14em] text-teal">
              ACCOUNT ACCESS
            </p>
            <h2 className="mt-2 text-xl font-bold tracking-tight text-slate-950">
              Add an account
            </h2>
            <p className="mt-1 max-w-xl text-sm leading-6 text-slate-600">
              Creates an invite record for a student or owner. They can sign in
              once their invite is accepted.
            </p>
          </div>
          <span className="rounded-full bg-teal/10 px-3 py-1 text-xs font-bold text-teal">
            Invite-only
          </span>
        </div>

        <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={invite}>
          <label className="block text-sm font-bold text-slate-800 sm:col-span-2">
            School email
            <input
              autoComplete="email"
              className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-teal focus:ring-4 focus:ring-teal/10"
              name="email"
              placeholder="student@school.edu"
              required
              type="email"
            />
          </label>
          <label className="block text-sm font-bold text-slate-800">
            Role
            <select
              className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-950 outline-none transition focus:border-teal focus:ring-4 focus:ring-teal/10"
              name="role"
            >
              <option value="member">Student member</option>
              <option value="owner_admin">Owner admin</option>
            </select>
          </label>
          <label className="block text-sm font-bold text-slate-800">
            Expiry{" "}
            <span className="font-medium text-slate-500">(optional)</span>
            <input
              className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-950 outline-none transition focus:border-teal focus:ring-4 focus:ring-teal/10"
              name="expiresAt"
              type="datetime-local"
            />
          </label>
          <div className="sm:col-span-2">
            <button
              className="rounded-xl bg-action px-4 py-2.5 text-sm font-extrabold text-white shadow-sm transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={busy}
              type="submit"
            >
              {busy ? "Adding account…" : "Add account"}
            </button>
          </div>
        </form>

        {provisionedAccount ? (
          <div
            className="mt-5 rounded-2xl border border-teal/20 bg-teal/5 p-4"
            role="status"
          >
            <p className="font-bold text-slate-950">
              Invite saved for {provisionedAccount.email}
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-700">
              If Google OAuth is in testing, add this same email to Google Auth
              Platform&apos;s test-user list before the student connects Google.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                className="rounded-lg border border-teal/30 bg-white px-3 py-2 text-sm font-bold text-teal transition hover:bg-teal/5"
                onClick={copyEmail}
                type="button"
              >
                Copy email
              </button>
              <a
                className="rounded-lg bg-teal px-3 py-2 text-sm font-bold text-white transition hover:brightness-95"
                href={provisionedAccount.googleAudienceUrl}
                rel="noreferrer"
                target="_blank"
              >
                Open Google test users ↗
              </a>
            </div>
          </div>
        ) : null}
      </article>

      <article className="rounded-[1.7rem] border border-slate-200 bg-slate-50 p-5 shadow-sm sm:p-6">
        <p className="text-xs font-extrabold tracking-[.14em] text-blue-700">
          PRIVACY OPERATIONS
        </p>
        <h2 className="mt-2 text-xl font-bold tracking-tight text-slate-950">
          Export a user&apos;s data
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Download one workspace as JSON. Every export is recorded in the
          administrator audit log.
        </p>
        <label className="mt-5 block text-sm font-bold text-slate-800">
          User
          <select
            className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-950 outline-none transition focus:border-teal focus:ring-4 focus:ring-teal/10"
            onChange={(event) => setUserId(event.target.value)}
            value={userId}
          >
            {profiles.length === 0 ? (
              <option value="">No user profiles yet</option>
            ) : null}
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.displayName || profile.display_name || profile.email || profile.id}
              </option>
            ))}
          </select>
        </label>
        <button
          className="mt-4 rounded-xl border border-teal bg-white px-4 py-2.5 text-sm font-extrabold text-teal transition hover:bg-teal/5 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!userId}
          onClick={downloadExport}
          type="button"
        >
          Download JSON export
        </button>
      </article>

      {notice ? (
        <p
          className="text-sm font-medium text-slate-700 lg:col-span-2"
          role="status"
        >
          {notice}
        </p>
      ) : null}
    </section>
  );
}
