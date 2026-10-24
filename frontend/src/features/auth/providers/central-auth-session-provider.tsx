"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { UNAUTHORIZED_EVENT } from "@/lib/api/api-client";
import { getCentralAuthSession } from "../api/central-auth-session.api";
import type { CentralAuthSession } from "../types/central-auth-session";

type SessionState =
  | { status: "loading"; session: null }
  | { status: "authenticated"; session: CentralAuthSession }
  | { status: "unauthenticated" | "unavailable"; session: null };

export type CentralAuthSessionContextValue = SessionState & {
  refreshSession: () => Promise<void>;
};

const CentralAuthSessionContext =
  createContext<CentralAuthSessionContextValue | null>(null);

export function useOptionalCentralAuthSession() {
  return useContext(CentralAuthSessionContext);
}

export function useCentralAuthSession() {
  const value = useOptionalCentralAuthSession();
  if (!value) {
    throw new Error("CentralAuthSessionProvider is missing");
  }
  return value;
}

export function CentralAuthSessionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [state, setState] = useState<SessionState>({
    status: "loading",
    session: null,
  });
  const generation = useRef(0);

  const refreshSession = useCallback(async () => {
    const requestGeneration = ++generation.current;
    setState({ status: "loading", session: null });

    try {
      const session = await getCentralAuthSession();
      if (generation.current !== requestGeneration) return;

      setState(
        session
          ? { status: "authenticated", session }
          : { status: "unauthenticated", session: null },
      );
    } catch {
      if (generation.current !== requestGeneration) return;
      setState({ status: "unavailable", session: null });
    }
  }, []);

  useEffect(() => {
    void refreshSession();

    const onUnauthorized = () => {
      ++generation.current;
      setState({ status: "unauthenticated", session: null });
    };

    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => {
      ++generation.current;
      window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    };
  }, [refreshSession]);

  useEffect(() => {
    if (state.status !== "authenticated") return;

    const millisecondsLeft = Date.parse(state.session.expiresAt) - Date.now();
    // Browser timers accept at most a signed 32-bit millisecond delay.
    if (millisecondsLeft > 2_147_483_647) return;

    const timer = window.setTimeout(
      () => {
        ++generation.current;
        setState({ status: "unauthenticated", session: null });
      },
      Math.max(0, millisecondsLeft),
    );
    return () => window.clearTimeout(timer);
  }, [state]);

  const value = useMemo<CentralAuthSessionContextValue>(
    () => ({ ...state, refreshSession }),
    [state, refreshSession],
  );

  return (
    <CentralAuthSessionContext.Provider value={value}>
      {children}
    </CentralAuthSessionContext.Provider>
  );
}
