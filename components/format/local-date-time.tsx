"use client";

import { useSyncExternalStore } from "react";

type LocalDateTimeProps = {
  value: string;
  fallback?: string;
};

/**
 * Dates are formatted only after hydration so Vercel's server locale cannot
 * disagree with a student's device locale during React hydration.
 */
export function LocalDateTime({ value, fallback = "recently" }: LocalDateTimeProps) {
  const hydrated = useHasHydrated();
  const date = new Date(value);
  const display = hydrated && !Number.isNaN(date.getTime())
    ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date)
    : fallback;

  return <time dateTime={value}>{display}</time>;
}

function subscribeAfterHydration(onStoreChange: () => void) {
  const timeout = window.setTimeout(onStoreChange, 0);
  return () => window.clearTimeout(timeout);
}

/** True after React has completed the server/client hydration pass. */
export function useHasHydrated() {
  return useSyncExternalStore(subscribeAfterHydration, () => true, () => false);
}
