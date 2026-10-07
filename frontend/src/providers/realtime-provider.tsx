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

import type {
  RealtimeConnectionState,
  RoomStatusUpdatedEvent,
  TaskEscalatedEvent,
} from "@/lib/realtime/realtime.type";

import type { RoomStatusBoardItem } from "@/features/rooms";

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

    const handleRoomStatusUpdated = (event: RoomStatusUpdatedEvent) => {
      queryClient.setQueryData<RoomStatusBoardItem[]>(
        queryKeys.rooms.status,
        (currentRooms) => {
          if (!currentRooms) {
            return currentRooms;
          }

          return currentRooms.map((room) =>
            room.roomNumber === event.data.roomNumber
              ? {
                  ...room,
                  status: event.data.status,
                  updatedAt: event.occurredAt,
                }
              : room,
          );
        },
      );
    };

    const handleTaskEscalated = (event: TaskEscalatedEvent) => {
      queryClient.setQueryData<TaskEscalatedEvent[]>(
        queryKeys.escalations.recent,
        (currentEscalations = []) => {
          const withoutExistingTask = currentEscalations.filter(
            (item) => item.data.taskId !== event.data.taskId,
          );

          return [event, ...withoutExistingTask].slice(0, 100);
        },
      );
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);

    socket.io.on("reconnect_attempt", handleReconnectAttempt);
    socket.io.on("reconnect_failed", handleReconnectFailed);

    socket.on(REALTIME_EVENTS.roomStatusUpdated, handleRoomStatusUpdated);

    socket.on(REALTIME_EVENTS.taskEscalated, handleTaskEscalated);

    socket.connect();

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);

      socket.io.off("reconnect_attempt", handleReconnectAttempt);

      socket.io.off("reconnect_failed", handleReconnectFailed);

      socket.off(REALTIME_EVENTS.roomStatusUpdated, handleRoomStatusUpdated);

      socket.off(REALTIME_EVENTS.taskEscalated, handleTaskEscalated);

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
