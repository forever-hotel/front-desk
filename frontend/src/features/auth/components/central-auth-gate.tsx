"use client";

import type { ReactNode } from "react";
import { useCentralAuthSession } from "../providers/central-auth-session-provider";

/**
 * UX gate only. The FDS backend must continue to validate tokens and roles.
 * Sign-in navigation will be added after the Central Auth contract is approved.
 */
export function CentralAuthGate({ children }: { children: ReactNode }) {
  const { status } = useCentralAuthSession();

  if (status === "authenticated") {
    return <>{children}</>;
  }

  if (status === "loading") {
    return (
      <main className="fds-content" aria-busy="true">
        <p role="status">Checking staff session…</p>
      </main>
    );
  }

  return (
    <main className="fds-content">
      <h1>
        {status === "unauthenticated"
          ? "Sign-in required"
          : "Session unavailable"}
      </h1>
      <p>
        {status === "unauthenticated"
          ? "A verified staff session is required to use Front Desk."
          : "Unable to verify your session. Please try again later."}
      </p>
    </main>
  );
}
