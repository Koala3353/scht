"use client";

import { ExternalLink, LogIn, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { createClient } from "../../lib/supabase/client";
import { SignOutButton } from "./sign-out-button";

type AdminSignInProps = {
  error?: string;
  googleAudienceUrl: string;
};

const errorMessages: Record<string, string> = {
  "sign-in-required": "Sign in with the owner-admin account to open this portal.",
  "google-access-denied":
    "Google rejected this account before Scht could sign you in. If the Google OAuth app is still in testing, add this exact email address to its Test users first.",
  "not-owner":
    "This account signed in successfully, but it is not approved as an owner admin for Scht.",
  "invite-required":
    "This account does not have access to the Scht workspace yet. Ask an existing owner admin to add it first.",
  "authentication-failed": "The sign-in exchange did not finish. Please try again.",
  "missing-auth-code": "Google did not return a sign-in code. Please try again.",
};

function adminCallbackUrl() {
  return `${window.location.origin}/auth/callback?next=/admin`;
}

export function AdminSignIn({ error, googleAudienceUrl }: AdminSignInProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const errorMessage = error ? errorMessages[error] : "";

  async function signInWithGoogle() {
    setIsSubmitting(true);
    setMessage("");
    const { data, error: signInError } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: adminCallbackUrl() },
    });
    if (signInError || !data.url) {
      setMessage(signInError?.message ?? "Google sign-in could not start.");
      setIsSubmitting(false);
      return;
    }
    window.location.assign(data.url);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl items-center p-4 sm:p-8">
      <section className="w-full rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-teal/10 text-teal">
          <ShieldCheck aria-hidden="true" className="size-6" />
        </div>
        <p className="mt-6 text-xs font-extrabold tracking-[.14em] text-teal">
          SCHT OWNER ADMIN
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.035em] text-slate-950">
          Sign in to the admin portal
        </h1>
        <p className="mt-3 leading-7 text-slate-700">
          This portal is only for accounts with Scht&apos;s owner-admin role.
        </p>

        {errorMessage ? (
          <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold leading-6 text-amber-950" role="alert">
            {errorMessage}
          </p>
        ) : null}

        <ol className="mt-6 space-y-3 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
          <li><span className="font-black text-slate-950">1.</span> Use the Google account that an existing owner admin has approved for Scht.</li>
          <li><span className="font-black text-slate-950">2.</span> If Google says the app is restricted or not verified, add that exact email under Google OAuth <strong>Test users</strong>.</li>
          <li><span className="font-black text-slate-950">3.</span> If Scht says the account is not an owner admin, an existing owner must add the account from this portal.</li>
        </ol>

        <div className="mt-6 space-y-3">
          <button
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-teal px-5 py-3 font-bold text-white hover:bg-teal/90 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
            onClick={() => void signInWithGoogle()}
            type="button"
          >
            <LogIn aria-hidden="true" className="size-4" />
            {isSubmitting ? "Opening Google…" : "Continue with Google"}
          </button>
          <a
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 font-bold text-ink hover:border-teal hover:bg-[#e6f2f0] hover:text-teal"
            href={googleAudienceUrl}
            rel="noreferrer"
            target="_blank"
          >
            Open Google Test users
            <ExternalLink aria-hidden="true" className="size-4" />
          </a>
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <Link className="text-sm font-bold text-teal hover:underline" href="/">
              Use student sign-in instead
            </Link>
            <SignOutButton />
          </div>
        </div>

        {message ? <p className="mt-4 text-sm font-semibold text-red-700" role="alert">{message}</p> : null}
      </section>
    </main>
  );
}
