"use client";

import { useQuery } from "@tanstack/react-query";

import { useRealtimeStatus } from "@/hooks/use-realtime-status";

import { queryKeys } from "@/lib/api/query-keys";

import { REALTIME_FALLBACK_POLL_INTERVAL_MS } from "@/lib/realtime/realtime-event-names";

import { getRecentEscalations } from "../api/escalations.api";

export function useEscalations() {
  const { connectionState } = useRealtimeStatus();

  return useQuery({
    queryKey: queryKeys.escalations.recent,
    queryFn: getRecentEscalations,

    refetchInterval:
      connectionState === "connected"
        ? false
        : REALTIME_FALLBACK_POLL_INTERVAL_MS,

    refetchOnWindowFocus: true,
  });
}
