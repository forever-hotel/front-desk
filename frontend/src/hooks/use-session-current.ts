"use client";

import { useCallback, useSyncExternalStore } from "react";

/** Expiry is an external clock value, observed without reading time in render. */
export function useSessionCurrent(expiresAt: string | undefined): boolean {
  const snapshot = useCallback(() => {
    const expiry = Date.parse(expiresAt ?? "");
    return Number.isFinite(expiry) && expiry > Date.now();
  }, [expiresAt]);
  const subscribe = useCallback(
    (changed: () => void) => {
      const expiry = Date.parse(expiresAt ?? "");
      if (!Number.isFinite(expiry)) return () => {};
      let timer: ReturnType<typeof setTimeout>;
      const schedule = () => {
        const remaining = expiry - Date.now();
        timer = setTimeout(
          () => {
            changed();
            if (expiry > Date.now()) schedule();
          },
          Math.max(0, Math.min(remaining, 2_147_483_647)),
        );
      };
      schedule();
      return () => clearTimeout(timer);
    },
    [expiresAt],
  );
  return useSyncExternalStore(subscribe, snapshot, () => false);
}
