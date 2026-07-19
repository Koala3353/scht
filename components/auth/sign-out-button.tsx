"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

import { createClient } from "../../lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function signOut() {
    setBusy(true);
    setError("");
    const { error: signOutError } = await createClient().auth.signOut({ scope: "local" });
    if (signOutError) {
      setError("Could not sign out. Check your connection and try again.");
      setBusy(false);
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="relative">
      <button
        aria-describedby={error ? "sign-out-error" : undefined}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-ink hover:border-teal hover:bg-[#e6f2f0] hover:text-teal disabled:opacity-60"
        disabled={busy}
        onClick={() => void signOut()}
        type="button"
      >
        <LogOut aria-hidden="true" className="size-4" />
        {busy ? "Signing out…" : "Sign out"}
      </button>
      {error ? <p className="absolute right-0 top-full z-20 mt-2 w-64 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-800 shadow-sm" id="sign-out-error" role="alert">{error}</p> : null}
    </div>
  );
}
