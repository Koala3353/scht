"use client";

import { useEffect } from "react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 sm:px-0">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-bold text-action">WORKSPACE UNAVAILABLE</p>
        <h1 className="mt-2 text-2xl font-bold text-ink">We could not load this page.</h1>
        <p className="mt-2 text-slate-600">Your saved tasks remain available in the loaded workspace. Try loading this page again.</p>
        <button className="mt-5 rounded-xl bg-teal px-4 py-2 font-bold text-white" onClick={reset} type="button">
          Reset and try again
        </button>
      </section>
    </main>
  );
}
