"use client";

import { useEffect } from "react";

export function PwaRegistration() {
  useEffect(() => {
    // In dev the worker serves stale _next assets after code changes, so skip it.
    if (process.env.NODE_ENV !== "production") return;
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // The app still works without offline shell caching.
      });
    }
  }, []);

  return null;
}
