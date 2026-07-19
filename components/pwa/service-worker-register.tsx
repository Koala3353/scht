"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let cancelled = false;
    void navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch(() => {
        if (!cancelled) {
          // Installation remains optional; the web app works without a worker.
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
