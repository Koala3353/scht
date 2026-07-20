"use client";

import { useEffect } from "react";

const RECOVERY_KEY = "scht-chunk-recovery-at";
const RECOVERY_WINDOW_MS = 30_000;

function reloadForNewDeployment() {
  const recoveredAt = Number(window.sessionStorage.getItem(RECOVERY_KEY) ?? 0);
  if (recoveredAt > Date.now() - RECOVERY_WINDOW_MS) return;
  window.sessionStorage.setItem(RECOVERY_KEY, String(Date.now()));
  window.location.reload();
}

/** Recover automatically when an old page shell requests a removed Next chunk. */
export function ChunkRecovery() {
  useEffect(() => {
    const handleResourceError = (event: Event) => {
      const target = event.target;
      if (target instanceof HTMLScriptElement && target.src.includes("/_next/static/")) reloadForNewDeployment();
    };
    const handleRejection = (event: PromiseRejectionEvent) => {
      const detail = event.reason instanceof Error ? `${event.reason.name} ${event.reason.message}` : String(event.reason ?? "");
      if (/chunkloaderror|loading chunk|_next\/static/i.test(detail)) reloadForNewDeployment();
    };
    window.addEventListener("error", handleResourceError, true);
    window.addEventListener("unhandledrejection", handleRejection);
    return () => {
      window.removeEventListener("error", handleResourceError, true);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  return null;
}
