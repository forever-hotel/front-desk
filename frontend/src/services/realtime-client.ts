import { io } from "socket.io-client";
import type {
  RealtimeConnectionState,
  RealtimeReadyEvent,
  RoomStatusUpdatedEvent,
  TaskEscalatedEvent,
} from "@/types/realtime";

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000"
).replace(/\/$/, "");

const REALTIME_NAMESPACE = "/realtime";

const REALTIME_EVENTS = {
  ready: "realtime.ready",
  roomStatusUpdated: "room.status.updated",
  taskEscalated: "task.escalated",
} as const;

interface RealtimeHandlers {
  onConnectionState?: (state: RealtimeConnectionState) => void;

  onReady?: (event: RealtimeReadyEvent) => void;

  onRoomStatusUpdated?: (event: RoomStatusUpdatedEvent) => void;

  onTaskEscalated?: (event: TaskEscalatedEvent) => void;

  onResyncRequired?: () => void;
}

export function connectRealtime(handlers: RealtimeHandlers): () => void {
  const socket = io(`${API_BASE_URL}${REALTIME_NAMESPACE}`, {
    autoConnect: false,

    /*
     * Socket.IO handles reconnect attempts after
     * temporary transport/network failure.
     */
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 5000,

    /*
     * Prefer WebSocket but permit HTTP polling as
     * the transport-level fallback.
     */
    transports: ["websocket", "polling"],
  });

  handlers.onConnectionState?.("connecting");

  socket.on("connect", () => {
    handlers.onConnectionState?.("connected");

    /*
     * Realtime messages are transient.
     *
     * Every initial connection/reconnection therefore performs
     * a REST resync so anything missed while disconnected is
     * recovered from the fallback endpoints.
     */
    handlers.onResyncRequired?.();
  });

  socket.on("disconnect", () => {
    handlers.onConnectionState?.("fallback");
  });

  socket.on("connect_error", () => {
    handlers.onConnectionState?.("fallback");
  });

  socket.io.on("reconnect_attempt", () => {
    handlers.onConnectionState?.("connecting");
  });

  socket.on(REALTIME_EVENTS.ready, (event: RealtimeReadyEvent) => {
    handlers.onReady?.(event);
  });

  socket.on(
    REALTIME_EVENTS.roomStatusUpdated,
    (event: RoomStatusUpdatedEvent) => {
      handlers.onRoomStatusUpdated?.(event);
    },
  );

  socket.on(REALTIME_EVENTS.taskEscalated, (event: TaskEscalatedEvent) => {
    handlers.onTaskEscalated?.(event);
  });

  socket.connect();

  return () => {
    socket.removeAllListeners();
    socket.io.removeAllListeners();
    socket.disconnect();
  };
}
