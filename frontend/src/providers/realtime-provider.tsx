"use client";

import {
  createContext,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/api/query-keys";

import { REALTIME_EVENTS } from "@/lib/realtime/realtime-event-names";

import {
  disconnectRealtimeSocket,
  getRealtimeSocket,
} from "@/lib/realtime/socket-client";

import type { RealtimeConnectionState } from "@/lib/realtime/realtime.type";

export type RealtimeContextValue = {
  connectionState: RealtimeConnectionState;
};

export const RealtimeContext = createContext<RealtimeContextValue | null>(null);

type RealtimeProviderProps = {
  children: ReactNode;
};

export function RealtimeProvider({ children }: RealtimeProviderProps) {
  const queryClient = useQueryClient();

  const [connectionState, setConnectionState] =
    useState<RealtimeConnectionState>("connecting");

  useEffect(() => {
    const socket = getRealtimeSocket();

    const handleConnect = () => {
      setConnectionState("connected");

      /*
       * Socket.IO events are transient.
       * Re-fetch authoritative REST snapshots whenever the
       * transport reconnects.
       */
      void queryClient.invalidateQueries({
        queryKey: queryKeys.rooms.status,
      });

      void queryClient.invalidateQueries({
        queryKey: queryKeys.escalations.recent,
      });
    };

    const handleDisconnect = () => {
      setConnectionState("fallback");
    };

    const handleConnectError = () => {
      setConnectionState("fallback");
    };

    const handleReconnectAttempt = () => {
      setConnectionState("connecting");
    };

    const handleReconnectFailed = () => {
      setConnectionState("fallback");
    };

    // Shared sockets deliver safe invalidations, never room/worker records.
    const handleRoomStatusUpdated = () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.rooms.status });
    };
    const handleTaskEscalated = () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.escalations.recent,
      });
    };
    const handleTransport = (status: { healthy?: boolean }) => {
      if (status?.healthy === true) handleConnect();
      else setConnectionState("fallback");
    };
    socket.on("realtime.status", handleTransport);
    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);

    socket.io.on("reconnect_attempt", handleReconnectAttempt);
    socket.io.on("reconnect_failed", handleReconnectFailed);

    socket.on(REALTIME_EVENTS.roomStatusUpdated, handleRoomStatusUpdated);

    socket.on(REALTIME_EVENTS.taskEscalated, handleTaskEscalated);
    socket.on("task.changed", handleTaskEscalated);

    socket.connect();
    // Recover a missed invalidation without polling session validation.
    const resync = setInterval(() => {
      if (document.visibilityState === "visible") {
        handleRoomStatusUpdated();
        handleTaskEscalated();
      }
    }, 30000);

    return () => {
      clearInterval(resync);
      socket.off("realtime.status", handleTransport);
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);

      socket.io.off("reconnect_attempt", handleReconnectAttempt);

      socket.io.off("reconnect_failed", handleReconnectFailed);

      socket.off(REALTIME_EVENTS.roomStatusUpdated, handleRoomStatusUpdated);

      socket.off(REALTIME_EVENTS.taskEscalated, handleTaskEscalated);
      socket.off("task.changed", handleTaskEscalated);

      disconnectRealtimeSocket();
    };
  }, [queryClient]);

  const value = useMemo(
    () => ({
      connectionState,
    }),
    [connectionState],
  );

  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  );
}
