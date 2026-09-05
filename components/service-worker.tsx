"use client";

import { useEffect } from "react";

export function ServiceWorker() {
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      window.location.hostname === "localhost"
    ) {
      return;
    }
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* install just won't be offered — not fatal */
    });
  }, []);

  return null;
}
