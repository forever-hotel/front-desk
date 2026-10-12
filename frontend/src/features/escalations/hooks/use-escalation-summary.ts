"use client";

import { useEscalations } from "./use-escalations";

export type EscalationSummaryState = "loading" | "ready" | "unavailable";

/**
 * Counts distinct tasks in the backend's recent-escalation snapshot.
 * This is NOT the count of all currently unclaimed WKMS tasks.
 * The shared React Query cache keeps the header, sidebar, and page in sync.
 */
export function useEscalationSummary(): {
  count: number | null;
  state: EscalationSummaryState;
} {
  const { data, isError } = useEscalations();

  if (isError) {
    return { count: null, state: "unavailable" };
  }

  if (data === undefined) {
    return { count: null, state: "loading" };
  }

  return {
    count: new Set(data.map((event) => event.data.taskId)).size,
    state: "ready",
  };
}
