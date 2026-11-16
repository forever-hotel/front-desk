"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useCentralAuthSession } from "../providers/central-auth-session-provider";

/**
 * UX gate only. The FDS backend must continue to validate tokens and roles.
 * Initial password changes and sign-in navigation follow the gateway session.
 */
export function CentralAuthGate({ children }: { children: ReactNode }) {
  const { status, session, refreshSession } = useCentralAuthSession();

  const router = useRouter();
  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
    if (status === "authenticated" && session.passwordChangeRequired)
      router.replace("/change-password");
  }, [status, session, router]);
  if (status === "authenticated" && !session.passwordChangeRequired) {
    return <>{children}</>;
  }

  if (status === "loading" || status === "authenticated") {
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
      {status === "unavailable" && (
        <button type="button" onClick={() => void refreshSession()}>
          Retry session
        </button>
      )}
    </main>
  );
}
